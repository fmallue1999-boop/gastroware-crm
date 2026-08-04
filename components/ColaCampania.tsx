"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, MessageCircle, SkipForward } from "lucide-react";
import { marcarDestinatario } from "@/lib/actions";
import { linkWhatsApp, rellenarPlantilla, telefonoProlijo } from "@/lib/format";

type Pendiente = {
  destinatarioId: string;
  clienteId: string;
  nombre: string;
  telefono: string | null;
  rubro: string;
};

export default function ColaCampania({
  plantilla,
  pendientes,
  terminada,
}: {
  plantilla: string;
  pendientes: Pendiente[];
  terminada: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  function marcar(id: string, estado: "enviado" | "salteado") {
    setError(null);
    startTransition(async () => {
      const res = await marcarDestinatario(id, estado);
      if (res && "error" in res && res.error) setError(res.error);
    });
  }

  if (terminada || pendientes.length === 0) {
    return (
      <p className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center text-sm text-green-800">
        <CheckCircle2 className="mx-auto mb-1 h-6 w-6" />
        Campaña terminada. No quedan pendientes.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-piedra">
        Tocá <span className="font-medium text-green-700">WhatsApp</span> (se
        abre el chat con el mensaje escrito), mandalo, volvé y marcá{" "}
        <span className="font-medium">Enviado</span>. Siguiente.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {pendientes.map((p, i) => {
        const texto = rellenarPlantilla(plantilla, { nombre: p.nombre });
        const abierto = abiertos.has(p.destinatarioId) || i === 0;
        return (
          <div
            key={p.destinatarioId}
            className={`rounded-2xl border bg-white p-3.5 shadow-sm ${
              i === 0 ? "border-celeste-deep border-2" : "border-borde"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <Link
                  href={`/clientes/${p.clienteId}`}
                  className="text-sm font-medium hover:underline"
                >
                  {p.nombre}
                </Link>
                <p className="text-xs text-piedra">
                  {p.rubro}
                  {p.telefono ? ` · ${telefonoProlijo(p.telefono)}` : ""}
                </p>
              </div>
              <div className="flex gap-1.5">
                {p.telefono && (
                  <a
                    href={linkWhatsApp(p.telefono, texto)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() =>
                      setAbiertos(new Set(abiertos).add(p.destinatarioId))
                    }
                    className="inline-flex items-center gap-1 rounded-xl bg-green-600 px-3 py-2 text-xs font-medium text-white"
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                  </a>
                )}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => marcar(p.destinatarioId, "enviado")}
                  className={`rounded-xl px-3 py-2 text-xs font-medium disabled:opacity-60 ${
                    abierto
                      ? "bg-tinta text-white"
                      : "border border-borde text-piedra"
                  }`}
                >
                  Enviado ✓
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => marcar(p.destinatarioId, "salteado")}
                  aria-label={`Saltear a ${p.nombre}`}
                  className="rounded-xl border border-borde px-2.5 py-2 text-piedra"
                >
                  <SkipForward className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            {i === 0 && (
              <p className="mt-2 rounded-lg bg-crema px-3 py-2 text-xs text-tinta/70 whitespace-pre-wrap">
                {texto}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
