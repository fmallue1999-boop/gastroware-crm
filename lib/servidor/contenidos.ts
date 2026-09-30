import { firmarLote } from "@/lib/core/storage";
import { cuentasDelFiltro, esEstado, esTipo, esImagen, ordenNatural } from "@/lib/contenidos";
import type { SupabaseServidor } from "@/lib/actions/comun";

/** Calendario de contenidos (v1.10): lecturas con la sesión del usuario (RLS). */

export type Contenido = {
  id: string;
  nombre: string;
  cuenta: string;
  fecha: string;
  tipo: string;
  objetivo: string | null;
  copy: string | null;
  estado: string;
  correccion: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type ArchivoContenido = { id: string; nombre: string; mime: string | null; tamano: number | null; path: string; url: string | null };

export type Acceso = { ve: boolean; carga: boolean; aprueba: boolean };

export async function accesoContenidos(supabase: SupabaseServidor): Promise<Acceso> {
  const [{ data: ve }, { data: carga }, { data: rol }] = await Promise.all([
    supabase.rpc("fn_ve_contenidos"),
    supabase.rpc("fn_carga_contenidos"),
    supabase.rpc("fn_rol"),
  ]);
  return { ve: Boolean(ve), carga: Boolean(carga), aprueba: rol === "direccion" };
}

const COLUMNAS = "id, nombre, cuenta, fecha, tipo, objetivo, copy, estado, correccion, created_at, updated_at, created_by, updated_by";

/** Fichas de un rango de fechas (el calendario), con los filtros de cuenta y estado. */
export async function contenidosDelRango(
  supabase: SupabaseServidor,
  f: { desde: string; hasta: string; cuenta?: string | null; estado?: string | null }
): Promise<Contenido[]> {
  let q = supabase.from("contenidos").select(COLUMNAS).gte("fecha", f.desde).lte("fecha", f.hasta).order("fecha").limit(2000);
  const cuentas = cuentasDelFiltro(f.cuenta);
  if (cuentas) q = q.in("cuenta", cuentas);
  if (esEstado(f.estado)) q = q.eq("estado", f.estado);
  const { data } = await q;
  return (data ?? []) as Contenido[];
}

/** El listado: búsqueda por nombre, orden por fecha y filtros. */
export async function contenidosListado(
  supabase: SupabaseServidor,
  f: { q?: string | null; orden?: string | null; cuenta?: string | null; tipo?: string | null; estado?: string | null }
): Promise<Contenido[]> {
  let q = supabase
    .from("contenidos")
    .select(COLUMNAS)
    .order("fecha", { ascending: f.orden !== "desc" })
    .order("created_at")
    .limit(1000);
  const texto = f.q?.trim().replace(/[%,()]/g, " ");
  if (texto) q = q.ilike("nombre", `%${texto}%`);
  const cuentas = cuentasDelFiltro(f.cuenta);
  if (cuentas) q = q.in("cuenta", cuentas);
  if (esTipo(f.tipo)) q = q.eq("tipo", f.tipo);
  if (esEstado(f.estado)) q = q.eq("estado", f.estado);
  const { data } = await q;
  return (data ?? []) as Contenido[];
}

/** Miniatura de cada ficha: el primer archivo en orden natural (imagen firmada o "video"). */
export async function miniaturas(supabase: SupabaseServidor, ids: string[]): Promise<Map<string, { url: string | null; video: boolean }>> {
  if (!ids.length) return new Map();
  const { data } = await supabase.from("contenido_archivos").select("contenido_id, nombre, mime, path").in("contenido_id", ids);
  const por = new Map<string, { nombre: string; mime: string | null; path: string }[]>();
  for (const a of (data ?? []) as { contenido_id: string; nombre: string; mime: string | null; path: string }[]) {
    por.set(a.contenido_id, [...(por.get(a.contenido_id) ?? []), a]);
  }
  const primeros = new Map([...por.entries()].map(([id, lista]) => [id, ordenNatural(lista)[0]]));
  const urls = await firmarLote(
    "contenidos",
    [...primeros.values()].filter((a) => esImagen(a.mime)).map((a) => a.path)
  );
  return new Map([...primeros.entries()].map(([id, a]) => [id, { url: esImagen(a.mime) ? urls.get(a.path) ?? null : null, video: !esImagen(a.mime) }]));
}

/** Una ficha con sus archivos (links firmados, en orden natural) y quién la cargó. */
export async function cargarFicha(
  supabase: SupabaseServidor,
  id: string
): Promise<{ contenido: Contenido; archivos: ArchivoContenido[]; cargadoPor: string | null; editadoPor: string | null } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [{ data: c }, { data: archivos }] = await Promise.all([
    supabase.from("contenidos").select(COLUMNAS).eq("id", id).maybeSingle(),
    supabase.from("contenido_archivos").select("id, nombre, mime, tamano, path").eq("contenido_id", id),
  ]);
  if (!c) return null;
  const contenido = c as Contenido;
  const lista = ordenNatural((archivos ?? []) as Omit<ArchivoContenido, "url">[]);
  const urls = await firmarLote("contenidos", lista.map((a) => a.path));
  const ids = [contenido.created_by, contenido.updated_by].filter(Boolean) as string[];
  const { data: usuarios } = ids.length ? await supabase.from("usuarios").select("id, nombre").in("id", ids) : { data: [] };
  const nombre = new Map(((usuarios ?? []) as { id: string; nombre: string }[]).map((u) => [u.id, u.nombre]));
  return {
    contenido,
    archivos: lista.map((a) => ({ ...a, url: urls.get(a.path) ?? null })),
    cargadoPor: contenido.created_by ? nombre.get(contenido.created_by) ?? null : null,
    editadoPor: contenido.updated_by ? nombre.get(contenido.updated_by) ?? null : null,
  };
}
