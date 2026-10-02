import type { createClient } from "@/lib/supabase/server";
import { ETAPAS_ABIERTAS } from "@/lib/constants";
import { sumarPorMoneda } from "@/lib/dinero";
import { hoyISO } from "@/lib/format";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Una tarjeta del embudo: lo justo para mostrarla y actuar. */
export type TarjetaEmbudo = {
  id: string;
  cliente_id: string;
  nombre: string;
  telefono: string | null;
  interes: string;
  nivel: string | null;
  etapa: string;
  proximo_contacto: string | null;
  proximo_hora: string | null;
  proxima_accion: string | null;
  proximo_nota: string | null;
  ultimo_movimiento_at: string | null;
  monto: number | null;
  moneda: string;
  pedido_estado: string | null;
  closed_at: string | null;
  created_at: string;
  comercial_id: string | null;
  /** v1.21: ya tuvo una nota hoy (contactado) pero sigue vencido: falta el próximo paso. */
  contactado_hoy?: boolean;
};

export type ColumnaEmbudo = "hoy" | "nueva" | "cotizada" | "seguimiento" | "espera" | "ganada";
export const COLUMNAS_EMBUDO: { key: ColumnaEmbudo; label: string }[] = [
  { key: "hoy", label: "Para hoy" },
  { key: "nueva", label: "Interesados" },
  { key: "cotizada", label: "Cotizados" },
  { key: "seguimiento", label: "En seguimiento" },
  { key: "espera", label: "Lista de espera" },
  { key: "ganada", label: "Vendidos" },
];

export type DatosEmbudo = {
  columnas: Record<ColumnaEmbudo, TarjetaEmbudo[]>;
  totales: Record<ColumnaEmbudo, Record<string, number>>;
  kpis: {
    paraHoy: number;
    atrasados: number;
    abiertos: number;
    montoAbierto: Record<string, number>;
    vendidosMes: number;
    montoVendidoMes: Record<string, number>;
    enEspera: number;
    productosEspera: string[];
  };
  mes: string;
};

type Fila = {
  id: string;
  cliente_id: string;
  comercial_id: string | null;
  etapa: string;
  temperatura: string | null;
  proximo_contacto: string | null;
  proximo_hora: string | null;
  proxima_accion: string | null;
  proximo_nota: string | null;
  ultimo_movimiento_at: string | null;
  mensaje_inicial: string | null;
  monto_estimado: number | null;
  moneda: string | null;
  pedido_estado: string | null;
  closed_at: string | null;
  created_at: string;
  producto: { nombre: string } | null;
  cliente: { nombre_comercial: string; telefono: string | null; deleted_at: string | null } | null;
};

const SELECT =
  "id, cliente_id, comercial_id, etapa, temperatura, proximo_contacto, proximo_hora, proxima_accion, proximo_nota, ultimo_movimiento_at, mensaje_inicial, monto_estimado, moneda, pedido_estado, closed_at, created_at, producto:productos(nombre), cliente:clientes!inner(nombre_comercial, telefono, deleted_at)";

function aTarjeta(f: Fila): TarjetaEmbudo {
  return {
    id: f.id,
    cliente_id: f.cliente_id,
    nombre: f.cliente?.nombre_comercial ?? "Contacto",
    telefono: f.cliente?.telefono ?? null,
    interes: f.producto?.nombre ?? f.mensaje_inicial ?? "Interés",
    nivel: f.temperatura,
    etapa: f.etapa,
    proximo_contacto: f.proximo_contacto,
    proximo_hora: f.proximo_hora ?? null,
    proxima_accion: f.proxima_accion ?? null,
    proximo_nota: f.proximo_nota,
    ultimo_movimiento_at: f.ultimo_movimiento_at,
    monto: f.monto_estimado,
    moneda: f.moneda ?? "ARS",
    pedido_estado: f.pedido_estado,
    closed_at: f.closed_at,
    created_at: f.created_at,
    comercial_id: f.comercial_id,
  };
}

/**
 * "2026-09" → [inicio, fin) en ISO, en hora de Argentina (UTC−3). Antes era
 * en UTC: una venta marcada el último día del mes después de las 21 h caía
 * en el mes siguiente y no aparecía en Vendidos.
 */
export function rangoMes(mes: string): { desde: string; hasta: string } {
  const [a, m] = mes.split("-").map(Number);
  const siguiente = m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
  return {
    desde: new Date(`${mes}-01T00:00:00-03:00`).toISOString(),
    hasta: new Date(`${siguiente}-01T00:00:00-03:00`).toISOString(),
  };
}

export function mesActual(): string {
  return hoyISO().slice(0, 7);
}

const ORDEN_NIVEL: Record<string, number> = { caliente: 0, tibio: 1, frio: 2 };
const porNivel = (a: TarjetaEmbudo, b: TarjetaEmbudo) => (ORDEN_NIVEL[a.nivel ?? ""] ?? 3) - (ORDEN_NIVEL[b.nivel ?? ""] ?? 3);

/** Le toca hoy: vencido (hoy o antes) o en lista de espera con "Llegó stock". */
export function tocaHoy(t: Pick<TarjetaEmbudo, "etapa" | "proximo_contacto" | "proximo_nota">, hoy: string): boolean {
  if (t.etapa === "espera" && t.proximo_nota === "Llegó stock") return true;
  return Boolean(t.proximo_contacto && t.proximo_contacto <= hoy);
}

/**
 * Reparte los intereses abiertos en columnas (v1.21): lo que toca hoy va a
 * "Para hoy" (y sale de su etapa hasta que se reprograma); arriba lo más
 * atrasado, después los de hoy por hora y nivel, y al final los que ya se
 * contactaron hoy pero no tienen próximo paso. El resto, por etapa: primero
 * lo que tiene fecha (lo más cercano arriba), después por nivel.
 */
export function repartirColumnas(abiertas: TarjetaEmbudo[], hoy: string): Omit<Record<ColumnaEmbudo, TarjetaEmbudo[]>, "ganada"> {
  const col: Omit<Record<ColumnaEmbudo, TarjetaEmbudo[]>, "ganada"> = { hoy: [], nueva: [], cotizada: [], seguimiento: [], espera: [] };
  for (const t of abiertas) {
    if (tocaHoy(t, hoy)) col.hoy.push(t);
    else if (t.etapa in col && t.etapa !== "hoy") col[t.etapa as Exclude<ColumnaEmbudo, "ganada" | "hoy">].push(t);
  }
  col.hoy.sort((a, b) => {
    if (Boolean(a.contactado_hoy) !== Boolean(b.contactado_hoy)) return a.contactado_hoy ? 1 : -1;
    const fa = a.proximo_contacto ?? hoy;
    const fb = b.proximo_contacto ?? hoy;
    if (fa !== fb) return fa < fb ? -1 : 1;
    const ha = a.proximo_hora ?? "";
    const hb = b.proximo_hora ?? "";
    if (ha !== hb) return ha < hb ? -1 : 1;
    return porNivel(a, b);
  });
  const ordenar = (a: TarjetaEmbudo, b: TarjetaEmbudo) => {
    const fa = a.proximo_contacto ?? "9999";
    const fb = b.proximo_contacto ?? "9999";
    if (fa !== fb) return fa < fb ? -1 : 1;
    return porNivel(a, b);
  };
  for (const k of ["nueva", "cotizada", "seguimiento", "espera"] as const) col[k].sort(ordenar);
  return col;
}

/**
 * Todo lo que muestra el embudo: los intereses abiertos por etapa, los
 * vendidos del mes, y los números de arriba. Filtrado por vendedor si se
 * pide. Pagina de a 1000 porque la base ya pasa ese tope.
 */
export async function cargarEmbudo(
  supabase: Supabase,
  opciones: { comercialId: string | null; mes?: string | null }
): Promise<DatosEmbudo> {
  const hoy = hoyISO();
  const mes = /^\d{4}-\d{2}$/.test(opciones.mes ?? "") ? (opciones.mes as string) : mesActual();
  const { desde, hasta } = rangoMes(mes);

  const abiertos: Fila[] = [];
  for (let inicio = 0; inicio < 3000; inicio += 1000) {
    let q = supabase
      .from("oportunidades")
      .select(SELECT)
      .in("etapa", [...ETAPAS_ABIERTAS])
      .eq("linea", "equipos")
      .is("cliente.deleted_at", null)
      .order("id")
      .range(inicio, inicio + 999);
    if (opciones.comercialId) q = q.eq("comercial_id", opciones.comercialId);
    const { data } = await q;
    const pagina = (data ?? []) as unknown as Fila[];
    abiertos.push(...pagina);
    if (pagina.length < 1000) break;
  }

  let qVend = supabase
    .from("oportunidades")
    .select(SELECT)
    .eq("etapa", "ganada")
    .eq("linea", "equipos")
    .is("cliente.deleted_at", null)
    .gte("closed_at", desde)
    .lt("closed_at", hasta)
    .order("closed_at", { ascending: false })
    .limit(300);
  if (opciones.comercialId) qVend = qVend.eq("comercial_id", opciones.comercialId);
  const { data: vendData } = await qVend;
  const vendidos = ((vendData ?? []) as unknown as Fila[]).map(aTarjeta);

  const todas = abiertos.map(aTarjeta);
  // Los que tocan hoy y ya tuvieron una nota hoy: contactados, falta el próximo paso
  const vencidas = todas.filter((t) => tocaHoy(t, hoy)).map((t) => t.id);
  const contactadas = new Set<string>();
  const desdeHoy = new Date(`${hoy}T00:00:00-03:00`).toISOString();
  for (let i = 0; i < vencidas.length; i += 150) {
    const { data } = await supabase
      .from("actividades")
      .select("oportunidad_id")
      .in("oportunidad_id", vencidas.slice(i, i + 150))
      .eq("tipo", "nota")
      .not("created_by", "is", null)
      .gte("created_at", desdeHoy);
    for (const a of (data ?? []) as { oportunidad_id: string }[]) contactadas.add(a.oportunidad_id);
  }
  for (const t of todas) if (contactadas.has(t.id)) t.contactado_hoy = true;

  const columnas: Record<ColumnaEmbudo, TarjetaEmbudo[]> = { ...repartirColumnas(todas, hoy), ganada: vendidos };

  const montos = (lista: TarjetaEmbudo[]) =>
    sumarPorMoneda(lista.map((t) => ({ monto: t.monto, moneda: t.moneda })));
  const totales = {
    hoy: montos(columnas.hoy),
    nueva: montos(columnas.nueva),
    cotizada: montos(columnas.cotizada),
    seguimiento: montos(columnas.seguimiento),
    espera: montos(columnas.espera),
    ganada: montos(columnas.ganada),
  };
  const abiertasTarjetas = todas;
  const enEspera = todas.filter((t) => t.etapa === "espera");
  const productosEspera = Array.from(new Set(enEspera.map((t) => t.interes))).slice(0, 3);

  return {
    columnas,
    totales,
    kpis: {
      paraHoy: abiertasTarjetas.filter((t) => t.proximo_contacto && t.proximo_contacto <= hoy).length,
      atrasados: abiertasTarjetas.filter((t) => t.proximo_contacto && t.proximo_contacto < hoy).length,
      abiertos: abiertasTarjetas.length,
      montoAbierto: montos(abiertasTarjetas),
      vendidosMes: vendidos.length,
      montoVendidoMes: totales.ganada,
      enEspera: enEspera.length,
      productosEspera,
    },
    mes,
  };
}
