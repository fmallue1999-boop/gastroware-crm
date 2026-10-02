import { firmarLote } from "@/lib/core/storage";
import { ordenNatural } from "@/lib/contenidos";
import type { AmbitoEspacio, DuenoArchivo, NodoCategoria, NodoMarca, NodoProducto, VideoTipo } from "@/lib/material";
import type { SupabaseServidor } from "@/lib/actions/comun";

/** Material (v1.11): lecturas con la sesión del usuario. */

export type Marca = NodoMarca & { orden: number };
export type Categoria = NodoCategoria & { orden: number };
export type ProductoMaterial = NodoProducto & { orden: number; producto_id: string | null };
export type Arbol = { marcas: Marca[]; categorias: Categoria[]; productos: ProductoMaterial[] };

export type ArchivoMaterial = {
  id: string;
  dueno: string;
  dueno_id: string;
  espacio: string;
  video_tipo: string | null;
  nombre: string;
  mime: string | null;
  tamano: number | null;
  path: string;
  url: string | null;
};

export async function puedeGestionarMaterial(supabase: SupabaseServidor): Promise<boolean> {
  const { data } = await supabase.rpc("fn_gestiona_material");
  return Boolean(data);
}

/** Todas las marcas, categorías y productos (son pocos), en orden. */
export async function cargarArbol(supabase: SupabaseServidor): Promise<Arbol> {
  const [{ data: marcas }, { data: categorias }, { data: productos }] = await Promise.all([
    supabase.from("material_marcas").select("id, nombre, slug, orden").order("orden").order("nombre"),
    supabase.from("material_categorias").select("id, marca_id, nombre, seccion, orden").order("orden").order("nombre"),
    supabase.from("material_productos").select("id, categoria_id, nombre, slug, orden, producto_id").order("orden").order("nombre"),
  ]);
  return {
    marcas: (marcas ?? []) as Marca[],
    categorias: (categorias ?? []) as Categoria[],
    productos: (productos ?? []) as ProductoMaterial[],
  };
}

export type Resumen = { videos: number; imagenes: number; ficha: boolean; tipos: VideoTipo[] };

/** Cuántos videos e imágenes tiene cada producto, si tiene ficha y qué tipos de video. */
export async function resumenPorProducto(supabase: SupabaseServidor, productoIds: string[]): Promise<Map<string, Resumen>> {
  const out = new Map<string, Resumen>();
  if (!productoIds.length) return out;
  const { data } = await supabase
    .from("material_archivos")
    .select("dueno_id, espacio, video_tipo")
    .eq("dueno", "producto")
    .in("dueno_id", productoIds);
  for (const a of (data ?? []) as { dueno_id: string; espacio: string; video_tipo: string | null }[]) {
    const r = out.get(a.dueno_id) ?? { videos: 0, imagenes: 0, ficha: false, tipos: [] };
    if (a.espacio === "videos") {
      r.videos++;
      if (a.video_tipo && !r.tipos.includes(a.video_tipo as VideoTipo)) r.tipos.push(a.video_tipo as VideoTipo);
    } else if (a.espacio === "imagenes") r.imagenes++;
    else if (a.espacio === "ficha") r.ficha = true;
    out.set(a.dueno_id, r);
  }
  return out;
}

/** Archivos de una marca, un producto, un espacio propio o un pedido, en orden natural por nombre, con links firmados. */
export async function archivosDe(supabase: SupabaseServidor, dueno: DuenoArchivo, duenoId: string): Promise<ArchivoMaterial[]> {
  const { data } = await supabase
    .from("material_archivos")
    .select("id, dueno, dueno_id, espacio, video_tipo, nombre, mime, tamano, path")
    .eq("dueno", dueno)
    .eq("dueno_id", duenoId);
  const lista = ordenNatural((data ?? []) as Omit<ArchivoMaterial, "url">[]);
  const urls = await firmarLote("material", lista.map((a) => a.path));
  return lista.map((a) => ({ ...a, url: urls.get(a.path) ?? null }));
}

/** Para la tabla "Material por producto": el primer video de cada tipo por producto. */
export async function videosPorTipo(supabase: SupabaseServidor): Promise<Map<string, Partial<Record<VideoTipo, ArchivoMaterial>>>> {
  const { data } = await supabase
    .from("material_archivos")
    .select("id, dueno, dueno_id, espacio, video_tipo, nombre, mime, tamano, path")
    .eq("dueno", "producto")
    .eq("espacio", "videos");
  const lista = ordenNatural((data ?? []) as Omit<ArchivoMaterial, "url">[]);
  const primeros = new Map<string, Partial<Record<VideoTipo, Omit<ArchivoMaterial, "url">>>>();
  for (const a of lista) {
    const tipo = a.video_tipo as VideoTipo;
    const p = primeros.get(a.dueno_id) ?? {};
    if (!p[tipo]) p[tipo] = a;
    primeros.set(a.dueno_id, p);
  }
  const todos = [...primeros.values()].flatMap((p) => Object.values(p)) as Omit<ArchivoMaterial, "url">[];
  const urls = await firmarLote("material", todos.map((a) => a.path));
  const out = new Map<string, Partial<Record<VideoTipo, ArchivoMaterial>>>();
  for (const [id, p] of primeros)
    out.set(id, Object.fromEntries(Object.entries(p).map(([t, a]) => [t, { ...a!, url: urls.get(a!.path) ?? null }])) as Partial<Record<VideoTipo, ArchivoMaterial>>);
  return out;
}

// ---------------------------------------------------------------------
// Espacios propios (v1.23)
// ---------------------------------------------------------------------

export type EspacioPropio = {
  id: string;
  ambito: AmbitoEspacio;
  ambito_id: string | null;
  nombre: string;
  descripcion: string | null;
  orden: number;
  /** Cuántos archivos tiene. */
  cantidad: number;
};

/** Los espacios propios de un lugar (general, una marca o un producto), con cuántos archivos tiene cada uno. */
export async function espaciosDe(supabase: SupabaseServidor, ambito: AmbitoEspacio, ambitoId: string | null = null): Promise<EspacioPropio[]> {
  let q = supabase.from("material_espacios").select("id, ambito, ambito_id, nombre, descripcion, orden").eq("ambito", ambito).order("orden").order("nombre");
  q = ambitoId ? q.eq("ambito_id", ambitoId) : q.is("ambito_id", null);
  const { data } = await q;
  const lista = (data ?? []) as Omit<EspacioPropio, "cantidad">[];
  if (!lista.length) return [];
  const { data: archivos } = await supabase.from("material_archivos").select("dueno_id").eq("dueno", "espacio").in("dueno_id", lista.map((e) => e.id));
  const cuenta = new Map<string, number>();
  for (const a of (archivos ?? []) as { dueno_id: string }[]) cuenta.set(a.dueno_id, (cuenta.get(a.dueno_id) ?? 0) + 1);
  return lista.map((e) => ({ ...e, cantidad: cuenta.get(e.id) ?? 0 }));
}

/** Los archivos de varios espacios propios, por espacio, con links firmados. */
export async function archivosDeEspacios(supabase: SupabaseServidor, ids: string[]): Promise<Map<string, ArchivoMaterial[]>> {
  const out = new Map<string, ArchivoMaterial[]>();
  if (!ids.length) return out;
  const { data } = await supabase
    .from("material_archivos")
    .select("id, dueno, dueno_id, espacio, video_tipo, nombre, mime, tamano, path")
    .eq("dueno", "espacio")
    .in("dueno_id", ids);
  const lista = ordenNatural((data ?? []) as Omit<ArchivoMaterial, "url">[]);
  const urls = await firmarLote("material", lista.map((a) => a.path));
  for (const a of lista) out.set(a.dueno_id, [...(out.get(a.dueno_id) ?? []), { ...a, url: urls.get(a.path) ?? null }]);
  return out;
}
