"use client";

import { useState, useTransition } from "react";
import { cambiarEtapa } from "@/lib/actions";
import { ETAPAS, ETAPAS_ABIERTAS, MOTIVOS_PERDIDA } from "@/lib/constants";
import type { Etapa } from "@/lib/types";

export default function EtapaControl({
  oportunidadId,
  etapa,
  motivoPerdida,
}: {
  oportunidadId: string;
  etapa: Etapa;
  motivoPerdida: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [eligiendoMotivo, setEligiendoMotivo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const cerrada = etapa === "ganada" || etapa === "perdida";

  function mover(nueva: Etapa, motivoSel?: string) {
    setError(null);
    startTransition(async () => {
      const res = await cambiarEtapa(oportunidadId, nueva, motivoSel);
      if (res && "error" in res && res.error) setError(res.error);
      else setEligiendoMotivo(false);
    });
  }

  if (cerrada) {
    return (
      <div
        className={`rounded-xl p-3 text-sm font-medium ${
          etapa === "ganada"
            ? "bg-green-100 text-green-800"
            : "bg-crema-deep text-tinta/70"
        }`}
      >
        {etapa === "ganada"
          ? "✅ Venta ganada"
          : `Perdida: ${motivoPerdida ?? "sin motivo"}`}
        <button
          onClick={() => mover("seguimiento")}
          disabled={pending}
          className="ml-3 underline text-xs"
        >
          Reabrir
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-borde bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-piedra/80 mb-2">
        Etapa
      </p>
      <div className="flex flex-wrap gap-1.5">
        {ETAPAS.filter((e) =>
          (ETAPAS_ABIERTAS as readonly string[]).includes(e.value)
        ).map((e) => (
          <button
            key={e.value}
            onClick={() => mover(e.value as Etapa)}
            disabled={pending || e.value === etapa}
            className={`rounded-full px-3 py-1.5 text-xs font-medium border ${
              e.value === etapa
                ? "bg-tinta text-white border-tinta"
                : "border-borde text-tinta/70"
            }`}
          >
            {e.label}
          </button>
        ))}
      </div>
      {etapa === "cotizada" && (
        <p className="mt-2 text-xs text-piedra/80">
          La cadencia D+2 / D+5 / D+10 / D+20 se generó automáticamente.
        </p>
      )}
      <div className="mt-3 flex gap-2 border-t border-crema-deep pt-3">
        <button
          onClick={() => mover("ganada")}
          disabled={pending}
          className="flex-1 rounded-xl bg-green-600 py-2.5 text-sm font-medium text-white"
        >
          Ganada 🎉
        </button>
        <button
          onClick={() => setEligiendoMotivo(!eligiendoMotivo)}
          disabled={pending}
          className="flex-1 rounded-xl border border-borde py-2.5 text-sm text-tinta/70"
        >
          Perdida
        </button>
      </div>
      {eligiendoMotivo && (
        <div className="mt-2 flex gap-2">
          <select
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="flex-1 rounded-xl border border-borde px-3 py-2 text-sm"
          >
            <option value="">Motivo de pérdida (obligatorio)…</option>
            {MOTIVOS_PERDIDA.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <button
            onClick={() => motivo && mover("perdida", motivo)}
            disabled={pending || !motivo}
            className="rounded-xl bg-tinta px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            Confirmar
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
