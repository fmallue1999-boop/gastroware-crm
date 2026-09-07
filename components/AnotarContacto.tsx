"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { anotarContacto } from "@/lib/actions";
import { sumarDias, hoyISO } from "@/lib/format";
import { SEGUIMIENTO_RAPIDO } from "@/lib/constants";

const chipCls = (activo: boolean) =>
  `rounded-full px-3 py-1.5 text-xs font-medium ${
    activo ? "bg-tinta text-white" : "border border-borde bg-white text-piedra"
  }`;

/**
 * La acción de todos los días: anotar qué pasó con el contacto y, si hace
 * falta, elegir cuándo volver a hablarle. Una sola caja, un botón.
 */
export default function AnotarContacto({ clienteId }: { clienteId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [texto, setTexto] = useState("");
  const [volverEl, setVolverEl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await anotarContacto(clienteId, texto, volverEl || null);
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      setTexto("");
      setVolverEl("");
      setOk(true);
      setTimeout(() => setOk(false), 1500);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={guardar}
      className="rounded-2xl border-2 border-celeste bg-white p-3.5 shadow-sm"
    >
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-piedra">
        ¿Qué pasó?
      </p>
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={2}
        placeholder="Hablamos, quedó en avisar, pidió precio, no atendió…"
        className="w-full rounded-2xl border border-borde bg-white px-4 py-3 text-base outline-none focus:border-tinta"
      />
      <p className="mb-1.5 mt-2 text-xs text-piedra">¿Volver a contactar?</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {SEGUIMIENTO_RAPIDO.map((o) => {
          const fecha = sumarDias(o.dias);
          return (
            <button
              key={o.label}
              type="button"
              onClick={() => setVolverEl(volverEl === fecha ? "" : fecha)}
              className={chipCls(volverEl === fecha)}
            >
              {o.label}
            </button>
          );
        })}
        <input
          type="date"
          value={volverEl}
          min={hoyISO()}
          onChange={(e) => setVolverEl(e.target.value)}
          className="rounded-full border border-borde bg-white px-3 py-1 text-xs outline-none focus:border-tinta"
        />
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending || (!texto.trim() && !volverEl)}
        className="mt-3 w-full rounded-2xl bg-tinta py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Guardando…" : ok ? "✓ Guardado" : "Guardar"}
      </button>
    </form>
  );
}
