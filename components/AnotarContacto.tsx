"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { anotarContacto } from "@/lib/actions";
import { sumarDias, hoyISO } from "@/lib/format";
import { SEGUIMIENTO_RAPIDO } from "@/lib/constants";

const chipCls = (activo: boolean) =>
  `min-h-11 rounded-full px-3.5 py-2 text-[15px] font-medium ${
    activo ? "bg-marino text-white" : "border border-borde bg-white text-piedra"
  }`;

export type InteresResumen = { id: string; texto: string };

/**
 * "¿Qué pasó?": la acción de todos los días. Una caja de texto, los chips
 * de cuándo volver a contactar (ninguno preseleccionado; "Sin fecha" es
 * válido) y Guardar. Si el contacto tiene más de un interés abierto, un
 * selector "Sobre:" (preseleccionado el más reciente). Se usa en la ficha y,
 * en modo compacto, en las filas de pendientes del inicio.
 */
export default function AnotarContacto({
  clienteId,
  intereses = [],
  oportunidadId,
  compacto = false,
  onGuardado,
}: {
  clienteId: string;
  intereses?: InteresResumen[];
  /** Interés fijo (fila de pendientes) o preseleccionado. */
  oportunidadId?: string | null;
  compacto?: boolean;
  onGuardado?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [texto, setTexto] = useState("");
  const [volverEl, setVolverEl] = useState("");
  const [sinFecha, setSinFecha] = useState(false);
  const [sobre, setSobre] = useState<string>(oportunidadId ?? intereses[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

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

  function guardar(e: React.FormEvent) {
    e.preventDefault();
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
      setOk(true);
      setTimeout(() => setOk(false), 2000);
      onGuardado?.();
      router.refresh();
    });
  }

  const hayAlgo = !!texto.trim() || !!volverEl || sinFecha;

  return (
    <form
      onSubmit={guardar}
      className={
        compacto
          ? "rounded-2xl border border-borde bg-crema/60 p-3"
          : "rounded-2xl border-2 border-celeste bg-white p-3.5 shadow-sm"
      }
    >
      {!compacto && (
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-piedra">
          ¿Qué pasó?
        </p>
      )}
      {intereses.length > 1 && !oportunidadId && (
        <label className="mb-2 flex items-center gap-2 text-[15px]">
          <span className="shrink-0 text-piedra">Sobre:</span>
          <select
            value={sobre}
            onChange={(e) => setSobre(e.target.value)}
            className="min-h-11 min-w-0 flex-1 rounded-2xl border border-borde bg-white px-3 py-2 text-[15px] outline-none focus:border-marino"
          >
            {intereses.map((i) => (
              <option key={i.id} value={i.id}>
                {i.texto}
              </option>
            ))}
          </select>
        </label>
      )}
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={compacto ? 2 : 2}
        autoFocus={compacto}
        placeholder="Hablamos, quedó en avisar, pidió precio, no atendió…"
        className="w-full rounded-2xl border border-borde bg-white px-4 py-3 text-base outline-none focus:border-marino"
      />
      <p className="mb-1.5 mt-2 text-xs text-piedra">¿Cuándo volver a contactar?</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {SEGUIMIENTO_RAPIDO.map((o) => {
          const activo = o.dias == null ? sinFecha : !!volverEl && volverEl === sumarDias(o.dias);
          return (
            <button
              key={o.label}
              type="button"
              onClick={() => elegirChip(o.dias)}
              className={chipCls(activo)}
            >
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
          className="min-h-11 rounded-full border border-borde bg-white px-3 py-1 text-sm outline-none focus:border-marino"
        />
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending || !hayAlgo}
        className="mt-3 min-h-11 w-full rounded-2xl bg-marino py-3 text-[15px] font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Guardando…" : ok ? "✓ Guardado" : "Guardar"}
      </button>
    </form>
  );
}
