"use client";

import { useState } from "react";
import { hoyISO } from "@/lib/format";

export function diasHastaLunes(): number {
  const dow = new Date().getDay();
  return (8 - dow) % 7 || 7;
}

const RAPIDOS = [
  { l: "Mañana", d: 1 },
  { l: "+3 días", d: 3 },
  { l: "+7 días", d: 7 },
  { l: "+15 días", d: 15 },
  { l: "+30 días", d: 30 },
];

/**
 * Panel para reprogramar un seguimiento: accesos rápidos (+3, +7…), el lunes,
 * o una fecha exacta del calendario. El motivo (opcional) queda en el historial
 * del cliente — útil para "está de vacaciones, hablar en dos semanas".
 */
export default function PosponerPanel({
  pending,
  onElegir,
  onCerrar,
}: {
  pending: boolean;
  onElegir: (hasta: number | string, motivo?: string) => void;
  onCerrar: () => void;
}) {
  const [fecha, setFecha] = useState("");
  const [motivo, setMotivo] = useState("");
  const m = motivo.trim() || undefined;
  const chip =
    "rounded-full border border-borde bg-white px-3 py-1.5 text-xs disabled:opacity-50";

  return (
    <div className="mt-2 space-y-2 rounded-2xl border border-borde bg-crema/60 p-3">
      <div className="flex flex-wrap gap-1.5">
        {RAPIDOS.map((o) => (
          <button
            key={o.l}
            type="button"
            onClick={() => onElegir(o.d, m)}
            disabled={pending}
            className={chip}
          >
            {o.l}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onElegir(diasHastaLunes(), m)}
          disabled={pending}
          className={chip}
        >
          El lunes
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <input
          type="date"
          value={fecha}
          min={hoyISO()}
          onChange={(e) => setFecha(e.target.value)}
          className="rounded-xl border border-borde bg-white px-3 py-1.5 text-xs outline-none focus:border-tinta"
        />
        <button
          type="button"
          onClick={() => fecha && onElegir(fecha, m)}
          disabled={pending || !fecha}
          className="rounded-xl bg-tinta px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          Pasar a esa fecha
        </button>
      </div>

      <input
        type="text"
        placeholder="Motivo (opcional): está de vacaciones, pidió que lo llamen ese día…"
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        className="w-full rounded-xl border border-borde bg-white px-3 py-1.5 text-xs outline-none focus:border-tinta"
      />

      <button
        type="button"
        onClick={onCerrar}
        disabled={pending}
        className="text-xs text-piedra underline"
      >
        Cancelar
      </button>
    </div>
  );
}
