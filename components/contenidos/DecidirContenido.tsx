"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, PenLine, X } from "lucide-react";
import { decidirContenido } from "@/lib/actions";

/**
 * Aprobar un contenido del calendario desde Aprobaciones (v1.15): aprobar de
 * un toque, pedir cambios con la corrección, o que no va (cancelar).
 */
export default function DecidirContenido({ contenidoId }: { contenidoId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [modo, setModo] = useState<"reedicion" | "cancelado" | null>(null);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);

  const decidir = (estado: "aprobado" | "reedicion" | "cancelado") => {
    setError(null);
    startTransition(async () => {
      const r = await decidirContenido(contenidoId, estado, texto);
      if ("error" in r && r.error) return setError(r.error);
      setHecho(estado === "aprobado" ? "Aprobado" : estado === "reedicion" ? "Pedido de cambios enviado" : "Cancelado");
      router.refresh();
    });
  };

  if (hecho) return <p className="mt-2 text-[15px] font-bold text-verde">✓ {hecho}. Le llega el aviso a quien lo cargó.</p>;

  return (
    <div className="mt-3 space-y-2">
      {modo ? (
        <>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={3}
            autoFocus
            placeholder={modo === "reedicion" ? "Qué hay que cambiar (le llega a marketing)" : "Motivo (opcional)"}
            className="w-full rounded-xl border border-borde bg-white px-3 py-2 text-base outline-none focus:border-marino"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => decidir(modo)}
              className="min-h-11 flex-1 rounded-xl bg-marino px-4 text-[15px] font-bold text-white disabled:opacity-50"
            >
              {pending ? "Enviando…" : modo === "reedicion" ? "Pedir los cambios" : "Cancelar el contenido"}
            </button>
            <button type="button" disabled={pending} onClick={() => setModo(null)} className="min-h-11 rounded-xl border border-borde bg-white px-4 text-[15px]">
              Volver
            </button>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => decidir("aprobado")}
            className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-verde px-2 text-[15px] font-bold text-white disabled:opacity-50"
          >
            <Check className="h-4 w-4" /> Aprobar
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setModo("reedicion")}
            className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-borde bg-white px-2 text-[15px] font-bold"
          >
            <PenLine className="h-4 w-4" /> Cambios
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setModo("cancelado")}
            className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-borde bg-white px-2 text-[15px] font-bold text-piedra"
          >
            <X className="h-4 w-4" /> No va
          </button>
        </div>
      )}
      {error && <p className="text-sm font-semibold text-red-700">{error}</p>}
    </div>
  );
}
