import { dinero } from "@/lib/format";

/**
 * Suma montos separándolos por moneda. Nunca se mezclan monedas: una venta
 * en USD y otra en ARS son dos totales distintos.
 *
 *   sumarPorMoneda([{ monto: 100, moneda: "USD" }, { monto: 5, moneda: "ARS" }])
 *   // → { USD: 100, ARS: 5 }
 */
export function sumarPorMoneda(
  items: { monto: number | null | undefined; moneda?: string | null }[]
): Record<string, number> {
  const totales: Record<string, number> = {};
  for (const i of items) {
    if (i.monto == null || Number.isNaN(Number(i.monto))) continue;
    const m = i.moneda || "ARS";
    totales[m] = (totales[m] ?? 0) + Number(i.monto);
  }
  return totales;
}

/** Monedas en orden fijo (USD primero, después ARS, después el resto). */
export function ordenarMonedas(totales: Record<string, number>): [string, number][] {
  const orden = (m: string) => (m === "USD" ? 0 : m === "ARS" ? 1 : 2);
  return Object.entries(totales).sort(
    ([a], [b]) => orden(a) - orden(b) || a.localeCompare(b)
  );
}

/** "USD 48.200 · ARS 12.400.000" (o "$0" si no hay nada). */
export function textoMontos(totales: Record<string, number>): string {
  const partes = ordenarMonedas(totales).map(([m, n]) => dinero(n, m));
  return partes.length ? partes.join(" · ") : dinero(0);
}
