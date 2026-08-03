"use client";

import { useState, useTransition } from "react";
import { setConfigValor } from "@/lib/actions";

export default function ConfigForm({
  tarifaActual,
}: {
  tarifaActual: string;
}) {
  const [pending, startTransition] = useTransition();
  const [tarifa, setTarifa] = useState(tarifaActual);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await setConfigValor("tarifa_hora", tarifa || "0");
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      setGuardado(true);
      setTimeout(() => setGuardado(false), 1500);
    });
  }

  return (
    <section className="rounded-2xl border border-borde bg-white shadow-sm p-4">
      <p className="text-sm font-semibold">Tarifa de servicio técnico</p>
      <p className="mt-0.5 text-xs text-piedra">
        Precio por hora de mano de obra. Se usa para calcular el total de cada
        orden.
      </p>
      <form onSubmit={guardar} className="mt-2 flex gap-2">
        <input
          type="number"
          step="any"
          value={tarifa}
          onChange={(e) => setTarifa(e.target.value)}
          placeholder="$ por hora"
          className="flex-1 rounded-2xl border border-borde bg-white shadow-sm px-3 py-2 text-sm outline-none focus:border-tinta"
        />
        <button
          disabled={pending}
          className="rounded-2xl bg-tinta px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {guardado ? "✓" : "Guardar"}
        </button>
      </form>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </section>
  );
}
