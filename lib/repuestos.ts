/**
 * Repuestos (migración 032): cada solicitud es una operación comercial del
 * apartado repuestos. Su estado sale de la etapa de la operación y de la
 * validación técnica:
 * Recibida → Validación técnica (si hace falta) → Cotización enviada →
 * Esperando confirmación → Ganada / Perdida.
 */

export type Validacion = "no_requiere" | "pendiente" | "validada" | "no_se_pudo";
export type Disponibilidad = "en_stock" | "a_pedir" | "sin_disponibilidad";
export type EstadoRepuesto = "validacion" | "para_cotizar" | "cotizada" | "esperando" | "ganada" | "perdida";

export const ESTADOS_REPUESTO: { value: EstadoRepuesto; label: string; ayuda: string }[] = [
  { value: "validacion", label: "Validación técnica", ayuda: "Servicio técnico confirma qué pieza es" },
  { value: "para_cotizar", label: "Para cotizar", ayuda: "Pieza identificada: falta precio y disponibilidad" },
  { value: "cotizada", label: "Cotización enviada", ayuda: "Se le pasó el precio al cliente" },
  { value: "esperando", label: "Esperando confirmación", ayuda: "Hubo contacto después de cotizar" },
  { value: "ganada", label: "Ganada", ayuda: "Sigue el circuito de la venta" },
  { value: "perdida", label: "Perdida", ayuda: "Con el motivo" },
];

export const nombreEstadoRepuesto = (e: EstadoRepuesto) => ESTADOS_REPUESTO.find((x) => x.value === e)?.label ?? e;

export const DISPONIBILIDADES: { value: Disponibilidad; label: string }[] = [
  { value: "en_stock", label: "En stock" },
  { value: "a_pedir", label: "A pedir" },
  { value: "sin_disponibilidad", label: "Sin disponibilidad" },
];

export const nombreDisponibilidad = (d: string | null | undefined) => DISPONIBILIDADES.find((x) => x.value === d)?.label ?? null;

export const VALIDACIONES: Record<Validacion, string> = {
  no_requiere: "Identificada",
  pendiente: "Falta validar",
  validada: "Validada por servicio técnico",
  no_se_pudo: "No se pudo identificar",
};

/** Estado de la solicitud según la etapa de la operación y la validación. */
export function estadoRepuesto(etapa: string, validacion: string): EstadoRepuesto {
  if (etapa === "ganada") return "ganada";
  if (etapa === "perdida") return "perdida";
  if (etapa === "cotizada") return "cotizada";
  if (etapa === "seguimiento" || etapa === "espera") return "esperando";
  return validacion === "pendiente" ? "validacion" : "para_cotizar";
}

/** Total = precio unitario × cantidad (null si no hay precio). */
export const totalRepuesto = (precio: number | null | undefined, cantidad: number) => (precio == null ? null : Math.round(precio * cantidad * 100) / 100);

/** Plazo para mostrar: "en stock", "a pedir, 15 días". */
export function textoDisponibilidad(d: string | null | undefined, plazo: number | null | undefined): string {
  const base = nombreDisponibilidad(d);
  if (!base) return plazo != null ? `${plazo} días` : "";
  return plazo != null && d !== "en_stock" ? `${base.toLowerCase()}, ${plazo} días` : base.toLowerCase();
}

/** WhatsApp con la cotización (la persona lo revisa antes de mandarlo). */
export function mensajeCotizacion(input: {
  contacto: string;
  descripcion: string;
  equipo?: string | null;
  cantidad: number;
  total: string;
  disponibilidad?: string | null;
  plazo?: number | null;
}): string {
  const pieza = `${input.cantidad > 1 ? `${input.cantidad} × ` : ""}${input.descripcion}`;
  const para = input.equipo ? ` para ${input.equipo}` : "";
  const disp = textoDisponibilidad(input.disponibilidad, input.plazo);
  return `Hola ${input.contacto}, te paso la cotización del repuesto ${pieza}${para}: ${input.total}${disp ? ` (${disp})` : ""}. ¿Te lo reservamos?`;
}
