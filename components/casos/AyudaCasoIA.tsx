"use client";

import { useState, useTransition } from "react";
import { Copy, MessageCircle, Sparkles, X } from "lucide-react";
import { iaAyudaCaso, type AyudaCaso } from "@/lib/actions";
import { linkWhatsApp } from "@/lib/format";

/**
 * Ayuda con IA para resolver un caso a distancia: qué preguntar, qué pruebas
 * seguras hacer, un WhatsApp listo y si conviene derivar a servicio técnico.
 */
export default function AyudaCasoIA({ casoId, telefono }: { casoId: string; telefono: string | null }) {
  const [pending, startTransition] = useTransition();
  const [ayuda, setAyuda] = useState<AyudaCaso | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  if (!ayuda)
    return (
      <>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const r = await iaAyudaCaso(casoId);
              if (r && "datos" in r && r.datos) setAyuda(r.datos);
              else setError((r as { error?: string })?.error ?? "No se pudo consultar");
            });
          }}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-violeta/30 bg-violeta-soft px-3 text-[15px] font-bold text-violeta disabled:opacity-60"
        >
          <Sparkles className={`h-4 w-4 ${pending ? "animate-pulse" : ""}`} /> {pending ? "Pensando…" : "Ayuda IA"}
        </button>
        {error && <p className="w-full text-[14px] font-bold text-red-600">{error}</p>}
      </>
    );

  return (
    <div className="w-full space-y-2 rounded-xl border border-violeta/30 bg-violeta-soft p-3 text-[15px]">
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 font-extrabold text-violeta">
          <Sparkles className="h-4 w-4 shrink-0" /> {ayuda.resumen}
        </p>
        <button type="button" onClick={() => setAyuda(null)} aria-label="Cerrar ayuda" className="text-piedra">
          <X className="h-4 w-4" />
        </button>
      </div>
      {ayuda.preguntas.length > 0 && (
        <div>
          <p className="font-bold">Preguntale</p>
          <ul className="ml-5 list-disc">
            {ayuda.preguntas.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      )}
      {ayuda.pruebas.length > 0 && (
        <div>
          <p className="font-bold">Que pruebe</p>
          <ul className="ml-5 list-disc">
            {ayuda.pruebas.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      )}
      <p className={`rounded-lg px-2.5 py-1.5 font-bold ${ayuda.derivar ? "bg-ambar-soft text-ambar" : "bg-verde-soft text-verde"}`}>
        {ayuda.derivar ? "Conviene derivar a servicio técnico" : "Se puede intentar a distancia"}: {ayuda.motivo}
      </p>
      {ayuda.mensaje && (
        <div className="space-y-1.5">
          <p className="font-bold">Mensaje para el cliente</p>
          <p className="whitespace-pre-wrap rounded-lg bg-white px-3 py-2">{ayuda.mensaje}</p>
          <div className="flex flex-wrap gap-2">
            {telefono && (
              <a
                href={linkWhatsApp(telefono, ayuda.mensaje)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-verde px-3 text-[14px] font-extrabold text-white"
              >
                <MessageCircle className="h-4 w-4" /> Mandar por WhatsApp
              </a>
            )}
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(ayuda.mensaje);
                setCopiado(true);
                setTimeout(() => setCopiado(false), 1500);
              }}
              className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-borde bg-white px-3 text-[14px] font-bold"
            >
              <Copy className="h-4 w-4" /> {copiado ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>
      )}
      <p className="text-xs text-piedra">Es una sugerencia: revisala antes de mandarla. Nunca le pidas al cliente que abra el equipo.</p>
    </div>
  );
}
