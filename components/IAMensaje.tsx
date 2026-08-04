"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { iaRedactarMensaje } from "@/lib/actions";
import { linkWhatsApp } from "@/lib/format";

const OBJETIVOS = [
  { value: "retomar el contacto sin presionar", label: "Retomar contacto" },
  { value: "hacer seguimiento de la cotización enviada", label: "Seguir cotización" },
  { value: "empujar el cierre con una propuesta concreta", label: "Empujar cierre" },
];

export default function IAMensaje({
  oportunidadId,
  telefono,
}: {
  oportunidadId: string;
  telefono: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [objetivo, setObjetivo] = useState(OBJETIVOS[0].value);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [fuentes, setFuentes] = useState<string[]>([]);
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function redactar() {
    setError(null);
    startTransition(async () => {
      const res = await iaRedactarMensaje(oportunidadId, objetivo);
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      if ("mensaje" in res) {
        setMensaje(res.mensaje);
        setFuentes(res.fuentes ?? []);
      }
    });
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-1.5 rounded-2xl border border-violet-200 bg-violet-50 px-3.5 py-2 text-sm font-medium text-violet-800"
      >
        <Sparkles className="h-4 w-4" /> Redactar mensaje con IA
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-violet-200 bg-white p-4 shadow-sm">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-violet-800">
        <Sparkles className="h-4 w-4" /> Mensaje a medida
      </p>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {OBJETIVOS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => setObjetivo(o.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              objetivo === o.value
                ? "bg-violet-600 text-white"
                : "border border-borde bg-white text-piedra"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {mensaje && (
        <div className="mb-2">
          <textarea
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            rows={5}
            className="w-full rounded-xl border border-borde px-3 py-2.5 text-sm outline-none focus:border-tinta"
          />
          {fuentes.length > 0 && (
            <p className="mt-1 text-[11px] text-piedra">
              Armado con: {fuentes.join(" · ")}
            </p>
          )}
          <p className="mt-0.5 text-[11px] text-piedra">
            Revisalo y editalo antes de mandar — la IA no envía nada sola.
          </p>
        </div>
      )}

      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={redactar}
          className="rounded-xl bg-violet-600 px-3.5 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Redactando…" : mensaje ? "Probar otra versión" : "Redactar"}
        </button>
        {mensaje && (
          <>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(mensaje);
                setCopiado(true);
                setTimeout(() => setCopiado(false), 1500);
              }}
              className="rounded-xl border border-borde px-3.5 py-2 text-sm text-piedra"
            >
              {copiado ? "¡Copiado!" : "Copiar"}
            </button>
            {telefono && (
              <a
                href={linkWhatsApp(telefono, mensaje)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-green-600 px-3.5 py-2 text-sm font-medium text-white"
              >
                Enviar por WhatsApp
              </a>
            )}
          </>
        )}
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="rounded-xl px-2 py-2 text-sm text-piedra"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
