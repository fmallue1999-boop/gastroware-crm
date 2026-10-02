/**
 * Pedidos de contenido a marketing (v1.23): estados, cómo se muestran y en
 * qué orden se agrupan. Funciones puras.
 */

export type EstadoPedido = "pedido" | "en_curso" | "para_aprobar" | "cambios" | "aprobado" | "entregado" | "cancelado";

export const ESTADOS_PEDIDO: Record<EstadoPedido, { label: string; clase: string; detalle: string }> = {
  para_aprobar: { label: "Para aprobar", clase: "bg-violeta-soft text-violeta", detalle: "Marketing lo terminó: dirección lo aprueba o pide cambios." },
  cambios: { label: "Con cambios", clase: "bg-naranja-soft text-naranja", detalle: "Dirección pidió cambios: marketing lo corrige y lo vuelve a mandar." },
  pedido: { label: "Pedido", clase: "bg-azul-soft text-azul", detalle: "Esperando que marketing lo tome." },
  en_curso: { label: "En curso", clase: "bg-ambar-soft text-ambar", detalle: "Marketing lo está haciendo." },
  aprobado: { label: "Aprobado", clase: "bg-verde-soft text-verde", detalle: "Aprobado: quedó en Material." },
  entregado: { label: "Entregado", clase: "bg-verde-soft text-verde", detalle: "Entregado (antes de que hubiera aprobación)." },
  cancelado: { label: "Cancelado", clase: "bg-crema-deep text-piedra", detalle: "No se hace." },
};

/** Orden de los grupos en la lista: lo que hay que mirar primero, arriba. */
export const ORDEN_ESTADOS: EstadoPedido[] = ["para_aprobar", "cambios", "pedido", "en_curso", "aprobado", "entregado", "cancelado"];

export const estadoDe = (e: string | null | undefined): EstadoPedido => (e && e in ESTADOS_PEDIDO ? (e as EstadoPedido) : "pedido");

/** Abierto = marketing todavía lo puede trabajar (subir, cambiar, mandar a aprobar). */
export const sePuedeTrabajar = (e: string) => ["pedido", "en_curso", "cambios"].includes(e);
export const estaCerrado = (e: string) => ["aprobado", "entregado", "cancelado"].includes(e);

/** Agrupa los pedidos por estado en el orden de la lista. */
export function agruparPedidos<T extends { estado: string }>(pedidos: T[]): { estado: EstadoPedido; pedidos: T[] }[] {
  return ORDEN_ESTADOS.map((estado) => ({ estado, pedidos: pedidos.filter((p) => estadoDe(p.estado) === estado) })).filter((g) => g.pedidos.length > 0);
}
