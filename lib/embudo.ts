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
  proximo_nota: string | null;
  ultimo_movimiento_at: string | null;
  monto: number | null;
  moneda: string;
  pedido_estado: string | null;
  closed_at: string | null;
  created_at: string;
  comercial_id: string | null;
};

export type ColumnaEmbudo = "nueva" | "cotizada" | "seguimiento" | "espera" | "ganada";
export const COLUMNAS_EMBUDO: { key: ColumnaEmbudo; label: string }[] = [
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
  "id, cliente_id, comercial_id, etapa, temperatura, proximo_contacto, proximo_nota, ultimo_movimiento_at, mensaje_inicial, monto_estimado, moneda, pedido_estado, closed_at, created_at, producto:productos(nombre), cliente:clientes!inner(nombre_comercial, telefono, deleted_at)";

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

/** "2026-09" → [inicio, fin) en ISO. */
export function rangoMes(mes: string): { desde: string; hasta: string } {
  const [a, m] = mes.split("-").map(Number);
  const desde = new Date(Date.UTC(a, m - 1, 1)).toISOString();
  const hasta = new Date(Date.UTC(a, m, 1)).toISOString();
  return { desde, hasta };
}

export function mesActual(): string {
  return hoyISO().slice(0, 7);
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
    .is("cliente.deleted_at", null)
    .gte("closed_at", desde)
    .lt("closed_at", hasta)
    .order("closed_at", { ascending: false })
    .limit(300);
  if (opciones.comercialId) qVend = qVend.eq("comercial_id", opciones.comercialId);
  const { data: vendData } = await qVend;
  const vendidos = ((vendData ?? []) as unknown as Fila[]).map(aTarjeta);

  const columnas: Record<ColumnaEmbudo, TarjetaEmbudo[]> = {
    nueva: [],
    cotizada: [],
    seguimiento: [],
    espera: [],
    ganada: vendidos,
  };
  for (const f of abiertos) {
    const t = aTarjeta(f);
    if (t.etapa in columnas) columnas[t.etapa as ColumnaEmbudo].push(t);
  }
  // Orden dentro de cada columna: primero lo que tiene fecha (más urgente arriba), después por nivel
  const ORDEN_NIVEL: Record<string, number> = { caliente: 0, tibio: 1, frio: 2 };
  const ordenar = (a: TarjetaEmbudo, b: TarjetaEmbudo) => {
    const fa = a.proximo_contacto ?? "9999";
    const fb = b.proximo_contacto ?? "9999";
    if (fa !== fb) return fa < fb ? -1 : 1;
    return (ORDEN_NIVEL[a.nivel ?? ""] ?? 3) - (ORDEN_NIVEL[b.nivel ?? ""] ?? 3);
  };
  for (const k of ["nueva", "cotizada", "seguimiento", "espera"] as ColumnaEmbudo[]) columnas[k].sort(ordenar);

  const montos = (lista: TarjetaEmbudo[]) =>
    sumarPorMoneda(lista.map((t) => ({ monto: t.monto, moneda: t.moneda })));
  const totales = {
    nueva: montos(columnas.nueva),
    cotizada: montos(columnas.cotizada),
    seguimiento: montos(columnas.seguimiento),
    espera: montos(columnas.espera),
    ganada: montos(columnas.ganada),
  };
  const abiertasTarjetas = [...columnas.nueva, ...columnas.cotizada, ...columnas.seguimiento, ...columnas.espera];
  const productosEspera = Array.from(new Set(columnas.espera.map((t) => t.interes))).slice(0, 3);

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
      enEspera: columnas.espera.length,
      productosEspera,
    },
    mes,
  };
}
