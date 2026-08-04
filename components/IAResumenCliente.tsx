"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Sparkles } from "lucide-react";
import { iaResumenCliente } from "@/lib/actions";

type Resultado = {
  resumen: string[];
  alertas: string[];
  proxima_accion: string;
  fuentes: string[];
};

export default function IAResumenCliente({ clienteId }: { clienteId: string }) {
  const [pending, startTransition] = useTransition();
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [error, setError] = useState<string | null>(null);

  function generar() {
    setError(null);
    startTransition(async () => {
      const res = await iaResumenCliente(clienteId);
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      if ("resumen" in res) setResultado(res as Resultado);
    });
  }

  if (!resultado) {
    return (
      <div>
        <button
          type="button"
          disabled={pending}
          onClick={generar}
          className="inline-flex items-center gap-1.5 rounded-2xl border border-violet-200 bg-violet-50 px-3.5 py-2 text-sm font-medium text-violet-800 disabled:opacity-60"
        >
          <Sparkles className="h-4 w-4" />
          {pending ? "Leyendo la ficha…" : "Resumen del cliente con IA"}
        </button>
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-violet-200 bg-white p-4 shadow-sm">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-violet-800">
        <Sparkles className="h-4 w-4" /> Resumen para la llamada
      </p>
      <ul className="space-y-1 text-sm">
        {resultado.resumen.map((r, i) => (
          <li key={i} className="flex gap-1.5">
            <span className="text-violet-400">•</span>
            <span>{r}</span>
          </li>
        ))}
      </ul>
      {resultado.alertas.length > 0 && (
        <div className="mt-2 space-y-1">
          {resultado.alertas.map((a, i) => (
            <p
              key={i}
              className="flex items-start gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs text-amber-800"
            >
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {a}
            </p>
          ))}
        </div>
      )}
      <p className="mt-2 rounded-lg bg-violet-50 px-3 py-2 text-sm">
        <span className="font-medium">Próximo paso sugerido:</span>{" "}
        {resultado.proxima_accion}
      </p>
      {resultado.fuentes.length > 0 && (
        <p className="mt-1.5 text-[11px] text-piedra">
          Armado con: {resultado.fuentes.join(" · ")}
        </p>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={generar}
        className="mt-2 text-xs text-violet-700 underline disabled:opacity-60"
      >
        {pending ? "Actualizando…" : "Regenerar"}
      </button>
    </section>
  );
}
