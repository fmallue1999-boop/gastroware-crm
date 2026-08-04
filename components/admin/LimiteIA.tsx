"use client";

import { useState, useTransition } from "react";
import { setConfigValor } from "@/lib/actions";

export default function LimiteIA({ actual }: { actual: string }) {
  const [pending, startTransition] = useTransition();
  const [valor, setValor] = useState(actual);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await setConfigValor("ia_limite_diario", valor || "0");
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      setGuardado(true);
      setTimeout(() => setGuardado(false), 1500);
    });
  }

  return (
    <form onSubmit={guardar} className="flex items-center gap-2">
      <input
        type="number"
        min={0}
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        className="w-24 rounded-xl border border-borde px-3 py-2 text-sm"
      />
      <span className="text-sm text-piedra">usos por día (0 = apagada)</span>
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-tinta px-3.5 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {guardado ? "Guardado ✓" : pending ? "…" : "Guardar"}
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </form>
  );
}
