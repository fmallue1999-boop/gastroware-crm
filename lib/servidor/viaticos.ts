import { firmarLote } from "@/lib/core/storage";
import type { SupabaseServidor } from "@/lib/actions/comun";

/** Viáticos (v1.25): lecturas con la sesión del usuario (cada uno ve lo suyo; dirección y administración, todo). */

export type Gasto = {
  id: string;
  usuario_id: string;
  rendicion_id: string | null;
  fecha: string;
  categoria: string;
  importe: number;
  moneda: string;
  medio_pago: string;
  comercio: string | null;
  cuit: string | null;
  tipo_comprobante: string | null;
  numero_comprobante: string | null;
  iva: number | null;
  detalle: string | null;
  cliente_id: string | null;
  archivo_path: string | null;
  leido_por_ia: boolean;
  decision: string | null;
  motivo_rechazo: string | null;
  decidido_por: string | null;
  decidido_at: string | null;
  created_at: string;
  cliente: { nombre_comercial: string } | null;
  usuario: { nombre: string | null } | null;
};

export type Rendicion = {
  id: string;
  numero: number;
  usuario_id: string;
  estado: string;
  nota: string | null;
  enviada_at: string;
  revisada_por: string | null;
  revisada_at: string | null;
  reintegrada_por: string | null;
  reintegrada_at: string | null;
  reintegro_fecha: string | null;
  reintegro_nota: string | null;
  usuario: { nombre: string | null } | null;
  gastos: { id: string; importe: number; moneda: string; medio_pago: string; decision: string | null }[];
};

export const COLS_GASTO =
  "id, usuario_id, rendicion_id, fecha, categoria, importe, moneda, medio_pago, comercio, cuit, tipo_comprobante, numero_comprobante, iva, detalle, cliente_id, archivo_path, leido_por_ia, decision, motivo_rechazo, decidido_por, decidido_at, created_at, cliente:clientes(nombre_comercial), usuario:usuarios!gastos_usuario_id_fkey(nombre)";
const COLS_RENDICION =
  "id, numero, usuario_id, estado, nota, enviada_at, revisada_por, revisada_at, reintegrada_por, reintegrada_at, reintegro_fecha, reintegro_nota, usuario:usuarios!rendiciones_usuario_id_fkey(nombre), gastos(id, importe, moneda, medio_pago, decision)";

const numeros = <T extends { importe: number | string; iva?: number | string | null }>(g: T): T => ({
  ...g,
  importe: Number(g.importe),
  ...("iva" in g ? { iva: g.iva == null ? null : Number(g.iva) } : {}),
});

/** Los gastos propios todavía sin rendir, lo más nuevo primero. */
export async function gastosSinRendir(supabase: SupabaseServidor, usuarioId: string): Promise<Gasto[]> {
  const { data } = await supabase
    .from("gastos")
    .select(COLS_GASTO)
    .eq("usuario_id", usuarioId)
    .is("rendicion_id", null)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);
  return ((data ?? []) as unknown as Gasto[]).map(numeros);
}

/** Rendiciones (de una persona o de todos, según el filtro), lo más nuevo primero. */
export async function cargarRendiciones(
  supabase: SupabaseServidor,
  filtro: { usuarioId?: string; estados?: string[]; limite?: number } = {}
): Promise<Rendicion[]> {
  let q = supabase.from("rendiciones").select(COLS_RENDICION).order("enviada_at", { ascending: false }).limit(filtro.limite ?? 100);
  if (filtro.usuarioId) q = q.eq("usuario_id", filtro.usuarioId);
  if (filtro.estados?.length) q = q.in("estado", filtro.estados);
  const { data } = await q;
  return ((data ?? []) as unknown as Rendicion[]).map((r) => ({ ...r, gastos: (r.gastos ?? []).map(numeros) }));
}

/** Una rendición con sus gastos completos y los links firmados de los comprobantes. */
export async function cargarRendicion(
  supabase: SupabaseServidor,
  id: string
): Promise<{ rendicion: Rendicion; gastos: Gasto[]; urls: Map<string, string> } | null> {
  const { data } = await supabase.from("rendiciones").select(COLS_RENDICION).eq("id", id).maybeSingle();
  if (!data) return null;
  const { data: gs } = await supabase.from("gastos").select(COLS_GASTO).eq("rendicion_id", id).order("fecha").order("created_at");
  const gastos = ((gs ?? []) as unknown as Gasto[]).map(numeros);
  const urls = await firmarLote("viaticos", gastos.map((g) => g.archivo_path).filter((p): p is string => Boolean(p)));
  return { rendicion: data as unknown as Rendicion, gastos, urls };
}

/** Los gastos con fecha en el mes (para el resumen y el Excel). */
export async function gastosDelMes(supabase: SupabaseServidor, desde: string, hasta: string, usuarioId?: string): Promise<(Gasto & { rendicion: { numero: number; estado: string; reintegro_fecha: string | null } | null })[]> {
  let q = supabase
    .from("gastos")
    .select(`${COLS_GASTO}, rendicion:rendiciones(numero, estado, reintegro_fecha)`)
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .order("fecha")
    .limit(5000);
  if (usuarioId) q = q.eq("usuario_id", usuarioId);
  const { data } = await q;
  return ((data ?? []) as unknown as (Gasto & { rendicion: { numero: number; estado: string; reintegro_fecha: string | null } | null })[]).map(numeros);
}
