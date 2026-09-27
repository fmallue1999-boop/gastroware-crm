"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { decidirPropuesta } from "@/lib/actions";

/** Un toque para aprobar; rechazar pide el motivo (el vendedor lo recibe). */
export default function DecidirPropuesta({ versionId }: { versionId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rechazando, setRechazando] = useState(false);
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);

  function decidir(aprobar: boolean) {
    setError(null);
    startTransition(async () => {
      const r = await decidirPropuesta(versionId, aprobar, nota);
      if (r && "error" in r && r.error) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="mt-2 space-y-2">
      {rechazando ? (
        <div className="flex flex-wrap gap-2">
          <input
            autoFocus
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="¿Por qué? (ej: máximo 5% o pedir anticipo)"
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-borde bg-white px-3 text-[15px] outline-none focus:border-marino"
          />
          <button
            type="button"
            disabled={pending || !nota.trim()}
            onClick={() => decidir(false)}
            className="min-h-11 rounded-xl bg-red-600 px-4 text-[15px] font-bold text-white disabled:opacity-50"
          >
            Rechazar
          </button>
          <button type="button" onClick={() => setRechazando(false)} className="px-2 text-[14px] text-piedra underline">
            Cancelar
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => decidir(true)}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-verde px-4 text-[15px] font-extrabold text-white disabled:opacity-50"
          >
            <Check className="h-4 w-4" /> Aprobar
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setRechazando(true)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-borde bg-white px-4 text-[15px] font-bold text-tinta"
          >
            <X className="h-4 w-4" /> Rechazar
          </button>
        </div>
      )}
      {error && <p className="text-[14px] font-bold text-red-600">{error}</p>}
    </div>
  );
}
