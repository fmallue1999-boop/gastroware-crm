/**
 * Precios en pesos y en dólares (migración 033) y a qué apartado pertenece
 * cada producto. Funciones puras: las usan los formularios y las acciones.
 */

export type Moneda = "ARS" | "USD";
export type ConPrecios = {
  precio_ars?: number | null;
  precio_usd?: number | null;
  precio_referencia?: number | null;
  moneda?: string | null;
};

/** Precio de lista en esa moneda (null si no tiene precio en esa moneda). */
export function precioEn(p: ConPrecios | null | undefined, moneda: string): number | null {
  if (!p) return null;
  const usd = moneda === "USD";
  const directo = usd ? p.precio_usd : p.precio_ars;
  if (directo != null) return Number(directo);
  // Productos cargados antes de la 033: solo el precio de su moneda
  const principal = (p.moneda ?? "ARS") === "USD";
  if (p.precio_referencia != null && principal === usd) return Number(p.precio_referencia);
  return null;
}

/** Monedas en las que tiene precio, la principal primero. */
export function monedasConPrecio(p: ConPrecios): Moneda[] {
  const lista = (["ARS", "USD"] as Moneda[]).filter((m) => precioEn(p, m) != null);
  return lista.sort((a) => (a === (p.moneda ?? "ARS") ? -1 : 1));
}

/** "$ 1.200.000 · USD 950" con lo que tenga cargado. */
export function textoPrecios(p: ConPrecios, dinero: (n: number, m: string) => string): string {
  return monedasConPrecio(p)
    .map((m) => dinero(precioEn(p, m)!, m))
    .join(" · ");
}

/** Moneda en la que conviene arrancar: la pedida si hay precio, si no la principal. */
export function monedaSugerida(p: ConPrecios, pedida: string): Moneda {
  if (precioEn(p, pedida) != null) return pedida === "USD" ? "USD" : "ARS";
  return (p.moneda ?? "ARS") === "USD" ? "USD" : "ARS";
}

// ---------------------------------------------------------------------------
// Apartado de cada producto: equipos, consumibles o repuestos
// ---------------------------------------------------------------------------
export type LineaProducto = "equipos" | "consumibles" | "repuestos";
export type ConCategoria = { es_consumible?: boolean | null; categoria?: string | null };

export function lineaDeProducto(p: ConCategoria): LineaProducto {
  if (p.es_consumible) return "consumibles";
  if (p.categoria === "repuesto" || p.categoria === "refaccion") return "repuestos";
  return "equipos";
}

export const productosDeLinea = <T extends ConCategoria>(lista: T[], linea: string | null | undefined): T[] =>
  lista.filter((p) => lineaDeProducto(p) === (linea === "consumibles" || linea === "repuestos" ? linea : "equipos"));
