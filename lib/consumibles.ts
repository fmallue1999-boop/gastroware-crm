/**
 * Consumibles (migración 031): el plan de reposición de cada cliente,
 * sucursal y producto. La reposición estimada es la última compra más la
 * frecuencia; el contacto es unos días antes (anticipación). Si todavía no
 * se sabe la frecuencia, se pone directo la fecha de contacto.
 */

import { masDias } from "@/lib/agenda";

export const UNIDADES = ["unidades", "cajas", "bidones", "paquetes", "kg", "litros"] as const;

export const MOTIVOS_SUSPENSION = [
  "Todavía tiene stock de sobra",
  "Dejó de usar el equipo",
  "Compra a otro proveedor",
  "Cerró o vendió el local",
  "Otro",
] as const;

export const ANTICIPACION_POR_DEFECTO = 10;

/** Fecha de contacto: reposición estimada menos la anticipación (nunca antes del día siguiente a la compra). */
export function fechaContacto(compra: string, frecuencia: number | null | undefined, anticipacion = ANTICIPACION_POR_DEFECTO): string {
  const dias = (frecuencia ?? 30) - anticipacion;
  return masDias(compra, Math.max(1, dias));
}

/** Cuándo se estima que se le termina (null si no se sabe la frecuencia). */
export const reposicionEstimada = (compra: string | null | undefined, frecuencia: number | null | undefined) =>
  compra && frecuencia ? masDias(compra, frecuencia) : null;

export type EstadoPlan = "suspendido" | "vencido" | "hoy" | "pronto" | "programado";

/** vencido (ya había que contactar) · hoy · pronto (en 7 días) · programado. */
export function estadoPlan(plan: { activa: boolean; proxima_alerta: string }, hoy: string): EstadoPlan {
  if (!plan.activa) return "suspendido";
  if (plan.proxima_alerta < hoy) return "vencido";
  if (plan.proxima_alerta === hoy) return "hoy";
  if (plan.proxima_alerta <= masDias(hoy, 7)) return "pronto";
  return "programado";
}

/**
 * Agrupa los planes por cliente: si un cliente tiene varios productos para
 * contactar en fechas cercanas (dentro de `ventana` días del primero), van
 * en una sola gestión. Ordenado por la fecha más próxima.
 */
export function agruparPorCliente<T extends { cliente_id: string; proxima_alerta: string }>(planes: T[], ventana = 7): T[][] {
  const porCliente = new Map<string, T[]>();
  for (const p of [...planes].sort((a, b) => a.proxima_alerta.localeCompare(b.proxima_alerta))) {
    porCliente.set(p.cliente_id, [...(porCliente.get(p.cliente_id) ?? []), p]);
  }
  const grupos: T[][] = [];
  for (const lista of porCliente.values()) {
    let actual: T[] = [];
    for (const p of lista) {
      if (actual.length && p.proxima_alerta > masDias(actual[0].proxima_alerta, ventana)) {
        grupos.push(actual);
        actual = [];
      }
      actual.push(p);
    }
    if (actual.length) grupos.push(actual);
  }
  return grupos.sort((a, b) => a[0].proxima_alerta.localeCompare(b[0].proxima_alerta));
}

/** "6 cajas" / "6 u." para mostrar. */
export function cantidadTexto(cantidad: number | null | undefined, unidad: string | null | undefined): string {
  if (cantidad == null) return "";
  const n = Number.isInteger(cantidad) ? String(cantidad) : cantidad.toLocaleString("es-AR");
  return unidad && unidad !== "unidades" ? `${n} ${unidad}` : `${n} u.`;
}
