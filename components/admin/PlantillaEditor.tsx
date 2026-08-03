"use client";

import { useState, useTransition } from "react";
import { guardarPlantilla } from "@/lib/actions";
import type { Plantilla } from "@/lib/types";

export default function PlantillaEditor({ plantilla }: { plantilla: Plantilla }) {
  const [pending, startTransition] = useTransition();
  const [contenido, setContenido] = useState(plantilla.contenido);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  const cambiado = contenido !== plantilla.contenido;

  function guardar() {
    setError(null);
    setGuardado(false);
    startTransition(async () => {
      const res = await guardarPlantilla(plantilla.id, contenido);
      if (res && "error" in res && res.error) setError(res.error);
      else setGuardado(true);
    });
  }

  return (
    <details className="group rounded-2xl border border-borde bg-white shadow-sm">
      <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium list-none [&::-webkit-details-marker]:hidden">
        <span>
          {plantilla.nombre}
          <span className="ml-2 rounded-full bg-crema-deep px-2 py-0.5 text-xs font-normal text-piedra">
            {plantilla.uso}
          </span>
        </span>
        {guardado && !cambiado && (
          <span className="text-xs text-green-700">Guardado</span>
        )}
      </summary>
      <div className="border-t border-borde/60 p-4">
        <textarea
          value={contenido}
          onChange={(e) => setContenido(e.target.value)}
          rows={5}
          className="w-full rounded-2xl border border-borde px-3 py-2.5 text-sm outline-none focus:border-tinta"
        />
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        {cambiado && (
          <button
            type="button"
            disabled={pending}
            onClick={guardar}
            className="mt-2 rounded-2xl bg-tinta px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {pending ? "Guardando…" : "Guardar cambios"}
          </button>
        )}
      </div>
    </details>
  );
}
