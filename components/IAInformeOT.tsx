"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { iaInformeOT, actualizarOT } from "@/lib/actions";

export default function IAInformeOT({ otId }: { otId: string }) {
  const [pending, startTransition] = useTransition();
  const [diagnostico, setDiagnostico] = useState<string | null>(null);
  const [trabajo, setTrabajo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aplicado, setAplicado] = useState(false);

  function redactar() {
    setError(null);
    startTransition(async () => {
      const res = await iaInformeOT(otId);
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      if ("diagnostico" in res) {
        setDiagnostico(res.diagnostico);
        setTrabajo(res.trabajo_realizado);
        setAplicado(false);
      }
    });
  }

  function aplicar() {
    if (!diagnostico || !trabajo) return;
    setError(null);
    startTransition(async () => {
      const res = await actualizarOT(otId, {
        diagnostico,
        trabajo_realizado: trabajo,
      });
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      setAplicado(true);
    });
  }

  return (
    <div className="rounded-2xl border border-violet-200 bg-white p-4 shadow-sm">
      <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-violet-800">
        <Sparkles className="h-4 w-4" /> Informe prolijo para el cliente
      </p>
      <p className="mb-2 text-xs text-piedra">
        Convierte las notas del técnico en el texto del comprobante. Vista
        previa editable: no cambia nada hasta que apruebes.
      </p>

      {diagnostico !== null && (
        <div className="mb-2 space-y-2">
          <div>
            <p className="text-xs font-semibold text-piedra">Diagnóstico</p>
            <textarea
              value={diagnostico}
              onChange={(e) => setDiagnostico(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-borde px-3 py-2 text-sm outline-none focus:border-tinta"
            />
          </div>
          <div>
            <p className="text-xs font-semibold text-piedra">Trabajo realizado</p>
            <textarea
              value={trabajo ?? ""}
              onChange={(e) => setTrabajo(e.target.value)}
              rows={4}
              className="w-full rounded-xl border border-borde px-3 py-2 text-sm outline-none focus:border-tinta"
            />
          </div>
        </div>
      )}

      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {aplicado && (
        <p className="mb-2 rounded-lg bg-green-50 border border-green-200 px-3 py-1.5 text-sm text-green-800">
          Aplicado a la orden: ya sale así en el comprobante.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={redactar}
          className="rounded-xl bg-violet-600 px-3.5 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending
            ? "Redactando…"
            : diagnostico
              ? "Probar otra versión"
              : "Redactar con IA"}
        </button>
        {diagnostico !== null && !aplicado && (
          <button
            type="button"
            disabled={pending}
            onClick={aplicar}
            className="rounded-xl bg-tinta px-3.5 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            Aprobar y usar este texto
          </button>
        )}
      </div>
    </div>
  );
}
