"use server";

// Material, la biblioteca comercial (v1.11): archivos de marcas y productos
// y la estructura (categorías y productos). Cargan marketing y dirección;
// la base también lo controla (fn_gestiona_material).

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { esEspacio, esVideoTipo, slugDe, type Espacio } from "@/lib/material";
import { puestoActual, type SupabaseServidor } from "./comun";

const GESTIONAN = ["marketing", "direccion", "admin"];

async function conPermiso(): Promise<{ supabase: SupabaseServidor } | { error: string }> {
  const supabase = await createClient();
  if (!GESTIONAN.includes(await puestoActual(supabase))) return { error: "El material lo cargan marketing y dirección" };
  return { supabase };
}

const listo = () => {
  revalidatePath("/material", "layout");
  return { ok: true as const };
};

/** Borra objetos del almacenamiento y sus filas. */
async function borrarArchivos(supabase: SupabaseServidor, filas: { id: string; path: string }[]) {
  if (!filas.length) return null;
  const { error } = await supabase.storage.from("material").remove(filas.map((f) => f.path));
  if (error) return error.message;
  const { error: e2 } = await supabase.from("material_archivos").delete().in("id", filas.map((f) => f.id));
  return e2?.message ?? null;
}

// ---------------------------------------------------------------------
// Archivos
// ---------------------------------------------------------------------

/** Registra archivos ya subidos al bucket. La ficha reemplaza a la anterior. */
export async function registrarArchivosMaterial(input: {
  dueno: "marca" | "producto";
  duenoId: string;
  espacio: Espacio;
  videoTipo?: string | null;
  archivos: { path: string; nombre: string; mime: string | null; tamano: number }[];
}) {
  const p = await conPermiso();
  if ("error" in p) return p;
  if (!esEspacio(input.espacio)) return { error: "Espacio inválido" };
  if (input.espacio === "videos" && !esVideoTipo(input.videoTipo)) return { error: "Elegí de qué es el video" };
  if (input.archivos.some((a) => !a.path.startsWith(`${input.dueno}/${input.duenoId}/`))) return { error: "Archivo inválido" };
  const { supabase } = p;

  const { data: anteriores } =
    input.espacio === "ficha"
      ? await supabase.from("material_archivos").select("id, path").eq("dueno", input.dueno).eq("dueno_id", input.duenoId).eq("espacio", "ficha")
      : { data: [] };
  const { error } = await supabase.from("material_archivos").insert(
    input.archivos.map((a) => ({
      dueno: input.dueno,
      dueno_id: input.duenoId,
      espacio: input.espacio,
      video_tipo: input.espacio === "videos" ? input.videoTipo : null,
      path: a.path,
      nombre: a.nombre.slice(0, 200),
      mime: a.mime,
      tamano: a.tamano,
    }))
  );
  if (error) {
    await supabase.storage.from("material").remove(input.archivos.map((a) => a.path));
    return { error: error.message };
  }
  // Una sola ficha por producto: la nueva reemplaza a la anterior
  const errBorrar = await borrarArchivos(supabase, (anteriores ?? []) as { id: string; path: string }[]);
  if (errBorrar) return { error: `La ficha nueva quedó, pero no se pudo borrar la anterior: ${errBorrar}` };
  return listo();
}

export async function borrarArchivoMaterial(id: string) {
  const p = await conPermiso();
  if ("error" in p) return p;
  const { data } = await p.supabase.from("material_archivos").select("id, path").eq("id", id).maybeSingle();
  if (!data) return { error: "No se encontró el archivo" };
  const error = await borrarArchivos(p.supabase, [data as { id: string; path: string }]);
  return error ? { error } : listo();
}

export async function cambiarTipoVideo(id: string, tipo: string) {
  if (!esVideoTipo(tipo)) return { error: "Tipo inválido" };
  const p = await conPermiso();
  if ("error" in p) return p;
  const { error } = await p.supabase.from("material_archivos").update({ video_tipo: tipo }).eq("id", id).eq("espacio", "videos");
  return error ? { error: error.message } : listo();
}

// ---------------------------------------------------------------------
// Estructura: categorías y productos
// ---------------------------------------------------------------------

export async function guardarCategoriaMaterial(input: { id?: string | null; marcaId: string; nombre: string; seccion: "productos" | "accesorios" }) {
  const nombre = input.nombre.trim().slice(0, 80);
  if (!nombre) return { error: "Poné el nombre de la categoría" };
  if (!["productos", "accesorios"].includes(input.seccion)) return { error: "Sección inválida" };
  const p = await conPermiso();
  if ("error" in p) return p;
  if (input.id) {
    const { error } = await p.supabase.from("material_categorias").update({ nombre }).eq("id", input.id);
    return error ? { error: error.message } : listo();
  }
  const { data: ultimas } = await p.supabase
    .from("material_categorias")
    .select("orden")
    .eq("marca_id", input.marcaId)
    .eq("seccion", input.seccion)
    .order("orden", { ascending: false })
    .limit(1);
  const { error } = await p.supabase
    .from("material_categorias")
    .insert({ marca_id: input.marcaId, nombre, seccion: input.seccion, orden: ((ultimas?.[0]?.orden as number) ?? 0) + 1 });
  return error ? { error: error.message } : listo();
}

export async function borrarCategoriaMaterial(id: string) {
  const p = await conPermiso();
  if ("error" in p) return p;
  const { count } = await p.supabase.from("material_productos").select("id", { count: "exact", head: true }).eq("categoria_id", id);
  if (count) return { error: "La categoría tiene productos: movelos o borralos primero" };
  const { error } = await p.supabase.from("material_categorias").delete().eq("id", id);
  return error ? { error: error.message } : listo();
}

/** Sube o baja una categoría (o un producto) un lugar entre sus hermanos. */
async function mover(supabase: SupabaseServidor, tabla: "material_categorias" | "material_productos", id: string, paso: 1 | -1) {
  const { data: fila } = await supabase.from(tabla).select("*").eq("id", id).maybeSingle();
  if (!fila) return { error: "No se encontró" };
  const f = fila as { marca_id?: string; seccion?: string; categoria_id?: string };
  let q = supabase.from(tabla).select("id, orden").order("orden").order("nombre");
  q = tabla === "material_categorias" ? q.eq("marca_id", f.marca_id!).eq("seccion", f.seccion!) : q.eq("categoria_id", f.categoria_id!);
  const { data: hermanos } = await q;
  const lista = ((hermanos ?? []) as { id: string }[]).map((h) => h.id);
  const i = lista.indexOf(id);
  const j = i + paso;
  if (i < 0 || j < 0 || j >= lista.length) return listo();
  [lista[i], lista[j]] = [lista[j], lista[i]];
  const resultados = await Promise.all(lista.map((hid, k) => supabase.from(tabla).update({ orden: k + 1 }).eq("id", hid)));
  const error = resultados.find((r) => r.error)?.error;
  return error ? { error: error.message } : listo();
}

export async function moverCategoriaMaterial(id: string, paso: 1 | -1) {
  const p = await conPermiso();
  if ("error" in p) return p;
  return mover(p.supabase, "material_categorias", id, paso);
}

export async function moverProductoMaterial(id: string, paso: 1 | -1) {
  const p = await conPermiso();
  if ("error" in p) return p;
  return mover(p.supabase, "material_productos", id, paso);
}

/** Slug libre a partir del nombre (gx18, gx18-2…). */
async function slugLibre(supabase: SupabaseServidor, nombre: string, excepto?: string | null) {
  const base = slugDe(nombre);
  const { data } = await supabase.from("material_productos").select("id, slug").like("slug", `${base}%`);
  const usados = new Set(((data ?? []) as { id: string; slug: string }[]).filter((x) => x.id !== excepto).map((x) => x.slug));
  if (!usados.has(base)) return base;
  for (let n = 2; ; n++) if (!usados.has(`${base}-${n}`)) return `${base}-${n}`;
}

/** Crea o edita un producto de Material (nombre, categoría y vínculo con el Catálogo). */
export async function guardarProductoMaterial(input: { id?: string | null; categoriaId: string; nombre: string; productoId?: string | null }) {
  const nombre = input.nombre.trim().slice(0, 80);
  if (!nombre) return { error: "Poné el nombre del producto" };
  const p = await conPermiso();
  if ("error" in p) return p;
  const { supabase } = p;
  const slug = await slugLibre(supabase, nombre, input.id);
  const fila = { nombre, slug, categoria_id: input.categoriaId, producto_id: input.productoId || null };
  if (input.id) {
    const { error } = await supabase.from("material_productos").update(fila).eq("id", input.id);
    return error ? { error: error.message } : { ...listo(), slug };
  }
  const { data: ultimos } = await supabase
    .from("material_productos")
    .select("orden")
    .eq("categoria_id", input.categoriaId)
    .order("orden", { ascending: false })
    .limit(1);
  const { error } = await supabase.from("material_productos").insert({ ...fila, orden: ((ultimos?.[0]?.orden as number) ?? 0) + 1 });
  return error ? { error: error.message } : { ...listo(), slug };
}

/** Borra el producto con todos sus archivos (también del almacenamiento). */
export async function borrarProductoMaterial(id: string) {
  const p = await conPermiso();
  if ("error" in p) return p;
  const { data: archivos } = await p.supabase.from("material_archivos").select("id, path").eq("dueno", "producto").eq("dueno_id", id);
  const errArch = await borrarArchivos(p.supabase, (archivos ?? []) as { id: string; path: string }[]);
  if (errArch) return { error: errArch };
  const { error } = await p.supabase.from("material_productos").delete().eq("id", id);
  return error ? { error: error.message } : listo();
}
