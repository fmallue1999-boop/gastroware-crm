"use client";

import RegistrarActividad, { type InteresParaActividad } from "@/components/RegistrarActividad";

export type InteresResumen = InteresParaActividad;

/**
 * La caja de abajo de la ficha, como en un chat: cómo fue (llamada,
 * WhatsApp…), el resultado, qué pasó y el próximo paso. Si el contacto tiene
 * más de un interés abierto, se elige sobre cuál.
 */
export default function Compositor({
  clienteId,
  intereses = [],
  oportunidadId,
  personas = [],
  onGuardado,
}: {
  clienteId: string;
  intereses?: InteresResumen[];
  oportunidadId?: string | null;
  personas?: { id: string; nombre: string }[];
  onGuardado?: () => void;
}) {
  return (
    <RegistrarActividad
      variante="chat"
      clienteId={clienteId}
      intereses={intereses}
      oportunidadId={oportunidadId}
      personas={personas}
      onGuardado={onGuardado}
    />
  );
}
