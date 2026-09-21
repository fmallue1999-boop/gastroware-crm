"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Send } from "lucide-react";
import { anotarContacto } from "@/lib/actions";
import { SEGUIMIENTO_RAPIDO } from "@/lib/constants";
import { fechaCorta, hoyISO, sumarDias } from "@/lib/format";

export type InteresResumen = { id: string; texto: string };

const chipCls = (activo: boolean) =>
  `min-h-10 rounded-full px-3.5 py-1.5 text-[15px] font-semibold ${
    activo ? "bg-marino text-white" : "border border-borde bg-white text-piedra"
  }`;

/**
 * La caja de abajo de la ficha, como en un chat: escribís qué pasó, elegís
 * cuándo volver a hablar (Mañana, 3 días, 1 semana, 2 semanas, 1 mes, Sin
 * fecha), enviás. Si el contacto tiene más de un interés abierto, elegís
 * sobre cuál.
 */
export default function Compositor({
  clienteId,
  intereses = [],
  oportunidadId,
  onGuardado,
}: {
  clienteId: string;
  intereses?: InteresResumen[];
  oportunidadId?: string | null;
  onGuardado?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [texto, setTexto] = useState("");
  const [volverEl, setVolverEl] = useState("");
  const [sinFecha, setSinFecha] = useState(false);
  const [abrirCuando, setAbrirCuando] = useState(false);
  const [sobre, setSobre] = useState<string>(oportunidadId ?? intereses[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const hayAlgo = !!texto.trim() || !!volverEl || sinFecha;
  const etiquetaCuando = sinFecha
    ? "Sin fecha"
    : volverEl
      ? volverEl === hoyISO()
        ? "Hoy"
        : fechaCorta(volverEl)
      : "Cuándo";

  function elegirChip(dias: number | null) {
    if (dias == null) {
      setSinFecha(!sinFecha);
      setVolverEl("");
      return;
    }
    const fecha = sumarDias(dias);
    setSinFecha(false);
    setVolverEl(volverEl === fecha ? "" : fecha);
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!hayAlgo) return;
    setError(null);
    startTransition(async () => {
      const res = await anotarContacto(clienteId, texto, volverEl || null, {
        oportunidadId: sobre || oportunidadId || null,
        sinFecha,
      });
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      setTexto("");
      setVolverEl("");
      setSinFecha(false);
      setAbrirCuando(false);
      setOk(true);
      setTimeout(() => setOk(false), 2000);
      onGuardado?.();
      router.refresh();
    });
  }

  return (
    <form onSubmit={enviar} className="space-y-2">
      {intereses.length > 1 && !oportunidadId && (
        <label className="flex items-center gap-2 text-sm text-piedra">
          Sobre:
          <select
            value={sobre}
            onChange={(e) => setSobre(e.target.value)}
            className="min-h-9 min-w-0 flex-1 rounded-xl border border-borde bg-white px-2 text-sm text-tinta outline-none focus:border-marino"
          >
            {intereses.map((i) => (
              <option key={i.id} value={i.id}>
                {i.texto}
              </option>
            ))}
          </select>
        </label>
      )}
      {abrirCuando && (
        <div className="flex flex-wrap items-center gap-1.5">
          {SEGUIMIENTO_RAPIDO.map((o) => {
            const activo = o.dias == null ? sinFecha : !!volverEl && volverEl === sumarDias(o.dias);
            return (
              <button key={o.label} type="button" onClick={() => elegirChip(o.dias)} className={chipCls(activo)}>
                {o.label}
              </button>
            );
          })}
          <input
            type="date"
            value={volverEl}
            min={hoyISO()}
            onChange={(e) => {
              setVolverEl(e.target.value);
              setSinFecha(false);
            }}
            aria-label="Otra fecha"
            className="min-h-10 rounded-full border border-borde bg-white px-3 text-sm outline-none focus:border-marino"
          />
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={ok ? "✓ Guardado" : "¿Qué pasó?"}
          className="min-h-12 min-w-0 flex-1 rounded-full border border-borde bg-white px-4 text-base outline-none focus:border-marino"
        />
        <button
          type="button"
          onClick={() => setAbrirCuando(!abrirCuando)}
          className={`inline-flex min-h-12 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[15px] font-semibold ${
            volverEl || sinFecha ? "bg-marino text-white" : "border border-borde bg-white text-piedra"
          }`}
        >
          <CalendarClock className="h-4 w-4" /> {etiquetaCuando}
        </button>
        <button
          type="submit"
          disabled={pending || !hayAlgo}
          aria-label="Enviar"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-verde text-white disabled:opacity-40"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </form>
  );
}
