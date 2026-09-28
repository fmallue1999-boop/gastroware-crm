"use client";

import RegistrarActividad, { type InteresParaActividad } from "@/components/RegistrarActividad";

export type InteresResumen = InteresParaActividad;

/**
 * Registrar actividad desde una fila (Mi día, embudo): cómo fue, el
 * resultado, qué pasó y el próximo paso, en un solo guardado.
 */
export default function AnotarContacto({
  clienteId,
  intereses = [],
  oportunidadId,
  proximoActual,
  onGuardado,
}: {
  clienteId: string;
  intereses?: InteresResumen[];
  /** Interés fijo (fila de pendientes) o preseleccionado. */
  oportunidadId?: string | null;
  proximoActual?: { fecha: string | null; accion?: string | null } | null;
  compacto?: boolean;
  onGuardado?: () => void;
}) {
  return (
    <RegistrarActividad
      variante="caja"
      clienteId={clienteId}
      intereses={intereses}
      oportunidadId={oportunidadId}
      proximoActual={proximoActual}
      onGuardado={onGuardado}
    />
  );
}
