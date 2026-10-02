import type { createClient } from "@/lib/supabase/server";

export type InfoStock = {
  /** Unidades que hay físicamente. */
  stock: number;
  /** v1.22: vendidas y todavía no entregadas (apartadas para esos clientes). */
  apartado: number;
  /** Lo que se puede vender: stock − apartado (negativo = faltan para cumplir lo vendido). */
  disponible: number;
  /** Próximo ingreso previsto (el más cercano), si hay. */
  proximo: { cantidad: number; fecha: string | null } | null;
  /** Cuántas consultas están en lista de espera por este producto. */
  enEspera: number;
};

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Una venta todavía no entregada, con sus productos y cantidades. */
export type VentaSinEntregar = {
  producto_id: string | null;
  productos_extra?: unknown;
  items?: { producto_id: string; cantidad: number | string }[] | null;
};

/** Unidades de cada producto de una venta: la cantidad de sus ítems, o 1 si no tiene (misma regla que al entregar). */
export function unidadesDeVenta(v: VentaSinEntregar): { productoId: string; cantidad: number }[] {
  const ids = [v.producto_id, ...((Array.isArray(v.productos_extra) ? v.productos_extra : []) as string[])].filter(Boolean) as string[];
  const items = v.items ?? [];
  return [...new Set(ids)].map((id) => ({
    productoId: id,
    cantidad: Math.max(1, Math.round(items.filter((i) => i.producto_id === id).reduce((s, i) => s + Number(i.cantidad), 0)) || 1),
  }));
}

/** Cuántas unidades de cada producto están vendidas y sin entregar (apartadas). */
export function apartadoPorProducto(ventas: VentaSinEntregar[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of ventas) for (const u of unidadesDeVenta(v)) out[u.productoId] = (out[u.productoId] ?? 0) + u.cantidad;
  return out;
}

/** Ventas cerradas que todavía no se entregaron (el stock está apartado para ellas). */
export const SELECT_SIN_ENTREGAR = "id, cliente_id, pedido_estado, producto_id, productos_extra, items:oportunidad_items(producto_id, cantidad)";
export function ventasSinEntregar(supabase: Supabase, select = SELECT_SIN_ENTREGAR) {
  return supabase
    .from("oportunidades")
    .select(select)
    .eq("etapa", "ganada")
    .is("deleted_at", null)
    .or("pedido_estado.is.null,pedido_estado.neq.entregado");
}

/**
 * Stock, próximo ingreso y lista de espera de cada producto activo, en un
 * solo mapa por id. Lo usan el alta, la ficha, las ventas y la pantalla
 * de stock para mostrar siempre lo mismo.
 */
export async function infoStockPorProducto(
  supabase: Supabase
): Promise<Record<string, InfoStock>> {
  const [{ data: prods }, { data: ingresos }, { data: esperas }, { data: sinEntregar }] = await Promise.all([
    supabase.from("productos").select("id, stock").eq("activo", true),
    supabase
      .from("ingresos_stock")
      .select("producto_id, cantidad, fecha_estimada")
      .is("recibido_at", null)
      .order("fecha_estimada", { ascending: true, nullsFirst: false }),
    supabase.from("oportunidades").select("producto_id").eq("etapa", "espera"),
    ventasSinEntregar(supabase),
  ]);

  const apartado = apartadoPorProducto((sinEntregar ?? []) as unknown as VentaSinEntregar[]);
  const info: Record<string, InfoStock> = {};
  for (const p of (prods ?? []) as { id: string; stock: number | null }[]) {
    const stock = p.stock ?? 0;
    const a = apartado[p.id] ?? 0;
    info[p.id] = { stock, apartado: a, disponible: stock - a, proximo: null, enEspera: 0 };
  }
  for (const i of (ingresos ?? []) as {
    producto_id: string;
    cantidad: number;
    fecha_estimada: string | null;
  }[]) {
    const x = info[i.producto_id];
    if (x && !x.proximo) x.proximo = { cantidad: i.cantidad, fecha: i.fecha_estimada };
  }
  for (const o of (esperas ?? []) as { producto_id: string | null }[]) {
    if (o.producto_id && info[o.producto_id]) info[o.producto_id].enEspera++;
  }
  return info;
}

/**
 * Texto corto para mostrar al lado de un producto, contando lo apartado para
 * ventas sin entregar (v1.22): "Hay 3" / "Hay 3 disponibles (2 apartadas)" /
 * "Sin disponibles (2 apartadas), llegan 5 el 20 oct" / "Sin stock, llegan 10
 * el 15 nov (4 ya vendidas)" / "Sin stock, sin ingreso previsto".
 */
const cuantas = (n: number, palabra: string) => `${n} ${palabra}${n === 1 ? "" : "s"}`;

export function textoStock(i: InfoStock | undefined, fechaCorta: (iso: string | null) => string): string {
  if (!i) return "";
  const apartado = i.apartado ?? 0;
  const disponible = i.disponible ?? i.stock - apartado;
  if (disponible > 0) return apartado > 0 ? `Hay ${disponible} disponible${disponible === 1 ? "" : "s"} (${cuantas(apartado, "apartada")})` : `Hay ${disponible}`;
  const base = i.stock > 0 ? `Sin disponibles (${cuantas(i.stock, "apartada")})` : "Sin stock";
  // Lo vendido que el stock no cubre sale de lo que llega
  const faltan = Math.max(0, apartado - i.stock);
  if (i.proximo)
    return `${base}, llegan ${i.proximo.cantidad}${i.proximo.fecha ? ` el ${fechaCorta(i.proximo.fecha)}` : " (fecha a confirmar)"}${faltan > 0 ? ` (${faltan} ya vendida${faltan === 1 ? "" : "s"})` : ""}`;
  return `${base}, sin ingreso previsto${faltan > 0 ? ` (faltan ${faltan} para lo vendido)` : ""}`;
}
