/**
 * Reportes comerciales por apartado (v1.7): actividad (intentos contra
 * conversaciones), control (consultas sin atender, operaciones sin próximo
 * paso) y agenda. Funciones puras: reciben filas ya cargadas.
 */

import { esConversacion, esIntento, MEDIOS } from "@/lib/actividad";

export type FilaActividad = { medio: string | null; resultado: string | null; created_by: string | null; linea: string | null };
export type FilaControl = {
  comercial_id: string | null;
  linea: string | null;
  etapa: string;
  asignado_at: string | null;
  primer_contacto_at: string | null;
  proximo_contacto: string | null;
};
type Nombre = (id: string) => string;

export type ReporteActividad = {
  intentos: number;
  conversaciones: number;
  /** Conversaciones sobre intentos (null si no hubo intentos). */
  efectividad: number | null;
  porMedio: { medio: string; intentos: number; conversaciones: number }[];
  porVendedor: { id: string; nombre: string; intentos: number; conversaciones: number }[];
};

/** Intentos de contacto y conversaciones efectivas (un "no respondió" es intento, no conversación). */
export function resumirActividad(filas: FilaActividad[], nombre: Nombre): ReporteActividad {
  const intentos = filas.filter((f) => esIntento(f.medio, f.resultado));
  const conv = intentos.filter((f) => esConversacion(f.resultado));
  const porMedio = MEDIOS.map((m) => ({
    medio: m.label,
    intentos: intentos.filter((f) => f.medio === m.value).length,
    conversaciones: conv.filter((f) => f.medio === m.value).length,
  })).filter((m) => m.intentos > 0);
  const vendedores = new Map<string, { intentos: number; conversaciones: number }>();
  for (const f of intentos) {
    if (!f.created_by) continue;
    const v = vendedores.get(f.created_by) ?? { intentos: 0, conversaciones: 0 };
    v.intentos++;
    if (esConversacion(f.resultado)) v.conversaciones++;
    vendedores.set(f.created_by, v);
  }
  return {
    intentos: intentos.length,
    conversaciones: conv.length,
    efectividad: intentos.length ? conv.length / intentos.length : null,
    porMedio,
    porVendedor: [...vendedores.entries()]
      .map(([id, v]) => ({ id, nombre: nombre(id), ...v }))
      .sort((a, b) => b.intentos - a.intentos),
  };
}

export type ReporteControl = {
  sinAtender: number;
  sinProximo: number;
  porVendedor: { id: string; nombre: string; sinAtender: number; sinProximo: number }[];
};

/**
 * Operaciones abiertas que necesitan atención: consultas asignadas sin
 * primer contacto y operaciones sin fecha de próximo paso (las en lista de
 * espera no cuentan: esperan stock).
 */
export function resumirControl(filas: FilaControl[], nombre: Nombre): ReporteControl {
  const sinAtender = (f: FilaControl) => Boolean(f.asignado_at) && !f.primer_contacto_at;
  const sinProximo = (f: FilaControl) => !sinAtender(f) && !f.proximo_contacto && f.etapa !== "espera";
  const vendedores = new Map<string, { sinAtender: number; sinProximo: number }>();
  for (const f of filas) {
    const clave = f.comercial_id ?? "sin";
    const v = vendedores.get(clave) ?? { sinAtender: 0, sinProximo: 0 };
    if (sinAtender(f)) v.sinAtender++;
    if (sinProximo(f)) v.sinProximo++;
    vendedores.set(clave, v);
  }
  return {
    sinAtender: filas.filter(sinAtender).length,
    sinProximo: filas.filter(sinProximo).length,
    porVendedor: [...vendedores.entries()]
      .filter(([, v]) => v.sinAtender + v.sinProximo > 0)
      .map(([id, v]) => ({ id, nombre: id === "sin" ? "Sin asignar" : nombre(id), ...v }))
      .sort((a, b) => b.sinAtender + b.sinProximo - (a.sinAtender + a.sinProximo)),
  };
}

/** Filtra por apartado (las filas sin apartado se cuentan como equipos). */
export const deLinea = <T extends { linea: string | null }>(filas: T[], linea: string | null | undefined): T[] =>
  linea ? filas.filter((f) => (f.linea ?? "equipos") === linea) : filas;
