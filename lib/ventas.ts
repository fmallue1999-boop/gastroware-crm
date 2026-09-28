import { VENTA_PASOS } from "@/lib/constants";
import type { PedidoEstado } from "@/lib/types";

/**
 * Circuito de la venta después de vender (manual, cadena 1.1, pasos 4 a 10):
 * el vendedor informa la venta → administración factura → registra el cobro
 * (o dirección aprueba despachar sin cobro) → se prepara → se despacha →
 * se entrega. Nada se prepara ni se despacha sin factura y cobro.
 */

/** Índice del paso (0 a 4) para un estado de la venta. */
export function pasoDe(estado: PedidoEstado | string | null): number {
  const e = estado ?? "comprometido";
  const i = VENTA_PASOS.findIndex((p) => (p.estados as readonly string[]).includes(e));
  return i < 0 ? 0 : i;
}

export type VentaMin = {
  pedido_estado: PedidoEstado | string | null;
  forma_pago?: string | null;
};

/** El vendedor ya pasó forma de pago y entrega: administración puede facturar. */
export const ventaInformada = (v: VentaMin) => Boolean(v.forma_pago);

export type QuienSigue = "vendedor" | "administracion" | "direccion" | "deposito" | "nadie";

/** Qué falta y de quién es el próximo paso (lo usan "Mi día" y la tarjeta de la venta). */
export function proximoPasoVenta(
  v: VentaMin,
  factura?: { cobro_estado: string; condicion_aprobada_at?: string | null } | null
): { quien: QuienSigue; texto: string } {
  const estado = v.pedido_estado ?? "comprometido";
  switch (estado) {
    case "comprometido":
      return ventaInformada(v)
        ? { quien: "administracion", texto: "Facturar" }
        : { quien: "vendedor", texto: "Completar los datos de la venta" };
    case "facturado":
      if (factura && factura.cobro_estado !== "cobrado" && !factura.condicion_aprobada_at)
        return { quien: "administracion", texto: "Registrar el cobro (o pedir condición a dirección)" };
      return { quien: "administracion", texto: "Pasar a preparar" };
    case "preparar_envio":
      return { quien: "deposito", texto: "Preparar y despachar" };
    case "despachado":
      return { quien: "vendedor", texto: "Confirmar la entrega" };
    default:
      return { quien: "nadie", texto: "Entregado" };
  }
}

/**
 * Días de atraso más grande entre las facturas impagas de un cliente
 * (0 si no hay vencidas). Si supera la regla "días de atraso que frenan un
 * despacho", la venta nueva no pasa a preparar sin aprobación.
 */
export function atrasoMaximo(
  facturas: { vencimiento: string | null; cobro_estado: string }[],
  hoy: string
): number {
  let max = 0;
  const h = Date.parse(hoy + "T12:00:00Z");
  for (const f of facturas) {
    if (f.cobro_estado === "cobrado" || !f.vencimiento) continue;
    const dias = Math.round((h - Date.parse(f.vencimiento + "T12:00:00Z")) / 86400000);
    if (dias > max) max = dias;
  }
  return max;
}

/** Postventa que agenda la entrega (manual, 1.1 pasos 11-12): día 10 siempre; 2 y 30 con instalación. */
export function diasPostventa(llevaInstalacion: boolean): { dias: number; titulo: string }[] {
  const base = [{ dias: 10, titulo: "Postventa día 10: ¿cómo anda el equipo? ¿Necesita algo?" }];
  if (!llevaInstalacion) return base;
  return [
    { dias: 2, titulo: "Postventa día 2: ¿quedó bien instalado? ¿Lo están usando?" },
    ...base,
    { dias: 30, titulo: "Postventa día 30: uso, consumibles y próxima compra" },
  ];
}
