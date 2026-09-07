import { VENTA_PASOS } from "@/lib/constants";
import type { PedidoEstado } from "@/lib/types";

/** Índice de columna del tablero de ventas para un estado de pedido. */
export function pasoDe(estado: PedidoEstado | null): number {
  const e = estado ?? "comprometido";
  const i = VENTA_PASOS.findIndex((p) =>
    (p.estados as readonly string[]).includes(e)
  );
  return i < 0 ? 0 : i;
}
