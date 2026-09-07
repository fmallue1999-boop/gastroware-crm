import type { createClient } from "@/lib/supabase/server";

export type InfoStock = {
  /** Unidades disponibles ahora. */
  stock: number;
  /** Próximo ingreso previsto (el más cercano), si hay. */
  proximo: { cantidad: number; fecha: string | null } | null;
  /** Cuántas consultas están en lista de espera por este producto. */
  enEspera: number;
};

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Stock, próximo ingreso y lista de espera de cada producto activo, en un
 * solo mapa por id. Lo usan el alta, la ficha, las ventas y la pantalla
 * de stock para mostrar siempre lo mismo.
 */
export async function infoStockPorProducto(
  supabase: Supabase
): Promise<Record<string, InfoStock>> {
  const [{ data: prods }, { data: ingresos }, { data: esperas }] = await Promise.all([
    supabase.from("productos").select("id, stock").eq("activo", true),
    supabase
      .from("ingresos_stock")
      .select("producto_id, cantidad, fecha_estimada")
      .is("recibido_at", null)
      .order("fecha_estimada", { ascending: true, nullsFirst: false }),
    supabase.from("oportunidades").select("producto_id").eq("etapa", "espera"),
  ]);

  const info: Record<string, InfoStock> = {};
  for (const p of (prods ?? []) as { id: string; stock: number | null }[])
    info[p.id] = { stock: p.stock ?? 0, proximo: null, enEspera: 0 };
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

/** Texto corto para mostrar al lado de un producto: "Hay 3" / "Sin stock, llegan 5 el 20 sep". */
export function textoStock(i: InfoStock | undefined, fechaCorta: (iso: string | null) => string): string {
  if (!i) return "";
  if (i.stock > 0) return `Hay ${i.stock} en stock`;
  if (i.proximo)
    return `Sin stock, llegan ${i.proximo.cantidad}${i.proximo.fecha ? ` el ${fechaCorta(i.proximo.fecha)}` : " (fecha a confirmar)"}`;
  return "Sin stock y sin ingreso previsto";
}
