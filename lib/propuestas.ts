import { precioEn } from "@/lib/precios";

/**
 * Propuestas fuera de lista (manual, reglas generales): toda cotización con
 * descuento sobre la lista (más allá de lo que el vendedor puede dar solo) o
 * con condición especial pasa por dirección general antes de presentarse.
 */

export type ItemPropuesta = { productoId: string | null; descripcion: string; cantidad: number; precioUnit: number };
export type PrecioLista = {
  id: string;
  nombre: string;
  precio_referencia: number | null;
  moneda: string;
  precio_ars?: number | null;
  precio_usd?: number | null;
};

export function evaluarFueraDeLista(
  items: ItemPropuesta[],
  lista: PrecioLista[],
  moneda: string,
  descuentoLibrePct: number,
  condicionEspecial: boolean
): { requiere: boolean; motivos: string[] } {
  const motivos: string[] = [];
  const tope = Math.max(0, descuentoLibrePct) / 100;
  for (const it of items) {
    if (!it.productoId) continue;
    const p = lista.find((x) => x.id === it.productoId);
    // Contra el precio de lista en la moneda de la cotización (pesos o dólares)
    const precioLista = precioEn(p, moneda);
    if (!p || !precioLista) continue;
    const minimo = precioLista * (1 - tope);
    if (it.precioUnit < minimo - 0.5) {
      const pct = Math.round((1 - it.precioUnit / precioLista) * 1000) / 10;
      motivos.push(`${p.nombre}: ${pct}% por debajo de lista`);
    }
  }
  if (condicionEspecial) motivos.push("Condición especial de pago o entrega");
  return { requiere: motivos.length > 0, motivos };
}

export const TEXTO_APROBACION: Record<string, string> = {
  no_requiere: "",
  pendiente: "Esperando aprobación de dirección",
  aprobada: "Aprobada por dirección",
  rechazada: "Rechazada por dirección",
};
