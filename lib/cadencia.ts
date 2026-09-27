import { sumarDias } from "@/lib/format";

/**
 * Cadencia del manual para una propuesta enviada (1.1 paso 3 y hoja del
 * vendedor, bloque 5): seguimiento a 1, 3 y 7 días; sin respuesta a los 14,
 * "propuesta dormida", recontacto a 30 y 60. Para un lead sin respuesta: dos
 * reintentos en 48 h y después "en espera" con fecha.
 *
 * El CRM no agenda nada solo: al anotar un movimiento propone la próxima
 * fecha de la regla (un toque para confirmar o cambiar).
 */

export const PASOS_PROPUESTA = [1, 3, 7, 14, 30, 60] as const;

/** Días desde la propuesta → próximo paso de la cadencia (o null si ya pasó el de 60). */
export function siguientePasoPropuesta(diasDesdePropuesta: number): { dias: number; nota: string } | null {
  const paso = PASOS_PROPUESTA.find((d) => d > diasDesdePropuesta);
  if (paso == null) return null;
  const nota =
    paso <= 7
      ? `Seguimiento de la propuesta (día ${paso})`
      : paso === 14
        ? "Propuesta sin respuesta: último intento antes de dormirla"
        : `Recontacto de la propuesta dormida (día ${paso})`;
  return { dias: paso - diasDesdePropuesta, nota };
}

/** Fecha sugerida (YYYY-MM-DD) y nota para el próximo contacto de un interés cotizado. */
export function sugerenciaPropuesta(fechaPropuesta: string, hoy: string): { fecha: string; nota: string } | null {
  const dias = Math.max(0, Math.round((Date.parse(hoy + "T12:00:00Z") - Date.parse(fechaPropuesta + "T12:00:00Z")) / 86400000));
  const s = siguientePasoPropuesta(dias);
  return s ? { fecha: sumarDias(s.dias, hoy), nota: s.nota } : null;
}

/** Lead sin respuesta: primer y segundo reintento dentro de 48 h; después, en espera. */
export function sugerenciaSinRespuesta(reintentosPrevios: number): { dias: number; nota: string } {
  if (reintentosPrevios === 0) return { dias: 1, nota: "Segundo intento por otro canal" };
  if (reintentosPrevios === 1) return { dias: 1, nota: "Último intento (48 h)" };
  return { dias: 14, nota: "En espera: no respondió a tres intentos" };
}
