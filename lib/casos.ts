import { PRIORIDADES_CASO } from "@/lib/constants";
import { habilesEntre, venceEnHorasHabiles } from "@/lib/habiles";

/**
 * Casos de postventa (manual 4.3): primera respuesta en 24 h hábiles (1 h
 * si el equipo está parado), cierre en 5 días hábiles con causa y solución.
 * Parado sin técnico en 24 h → alerta a dirección de administración.
 */

export type CasoPlazos = {
  prioridad: string;
  estado: string;
  created_at: string;
  primera_respuesta_at: string | null;
  derivado_at?: string | null;
  cerrado_at?: string | null;
  tecnico_asignado?: boolean;
};

export const horasRespuesta = (prioridad: string) => PRIORIDADES_CASO.find((p) => p.value === prioridad)?.horas ?? 24;

export function vencePrimeraRespuesta(c: Pick<CasoPlazos, "prioridad" | "created_at">): Date {
  return venceEnHorasHabiles(c.created_at, horasRespuesta(c.prioridad));
}

/** Estado de los plazos de un caso a un momento dado. */
export function plazosCaso(c: CasoPlazos, ahora: number, hoy: string) {
  const abierto = c.estado !== "cerrado";
  const vence = vencePrimeraRespuesta(c);
  const respuestaVencida = abierto && !c.primera_respuesta_at && ahora > vence.getTime();
  const diasAbierto = habilesEntre(c.created_at.slice(0, 10), hoy);
  const cierreVencido = abierto && diasAbierto > 5;
  const paradoSinTecnico =
    abierto && c.prioridad === "parado" && !c.tecnico_asignado && ahora - Date.parse(c.created_at) > 24 * 3600000;
  return { vence, respuestaVencida, diasAbierto, cierreVencido, paradoSinTecnico };
}

/** Prioridad del trabajo técnico que sale de un caso. */
export const prioridadOT = (prioridadCaso: string) =>
  prioridadCaso === "parado" ? "urgente" : prioridadCaso === "anda_mal" ? "alta" : "normal";
