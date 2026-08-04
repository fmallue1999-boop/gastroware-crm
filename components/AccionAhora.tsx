"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completarTarea, posponerTarea, crearTarea } from "@/lib/actions";
import { linkWhatsApp, rellenarPlantilla, fechaCorta, hoyISO } from "@/lib/format";
import { RESULTADOS } from "@/components/TareaItem";
import PosponerPanel from "@/components/PosponerPanel";
import type { Tarea } from "@/lib/types";

export function AccionAhora({
  tarea,
  telefono,
  vars,
}: {
  tarea: Tarea;
  telefono: string | null;
  vars: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [posponiendo, setPosponiendo] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const mensaje = tarea.plantilla
    ? rellenarPlantilla(tarea.plantilla.contenido, vars)
    : null;

  const vencida = tarea.vence_el < hoyISO();
  const esHoy = tarea.vence_el === hoyISO();

  function completar(resultado?: string) {
    startTransition(async () => {
      await completarTarea(tarea.id, resultado);
      router.refresh();
    });
  }

  async function copiar() {
    if (!mensaje) return;
    await navigator.clipboard.writeText(mensaje);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }

  return (
    <div className="rounded-2xl border-2 border-celeste-deep bg-white shadow-sm p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-sky-700 mb-1">
        Ahora toca
      </p>
      <p className="text-sm font-medium">
        {tarea.titulo}{" "}
        <span className={vencida ? "text-red-600" : "text-piedra"}>
          {vencida
            ? `— venció ${fechaCorta(tarea.vence_el)}`
            : esHoy
              ? "— vence hoy"
              : `— ${fechaCorta(tarea.vence_el)}`}
        </span>
      </p>

      {mensaje && (
        <p className="mt-2 rounded-lg bg-crema p-3 text-sm text-tinta/80 whitespace-pre-wrap">
          {mensaje}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        {mensaje && telefono && (
          <a
            href={linkWhatsApp(telefono, mensaje)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-2xl bg-green-600 py-2.5 text-center text-sm font-medium text-white"
          >
            Mandar por WhatsApp
          </a>
        )}
        {mensaje && (
          <button
            onClick={copiar}
            className="rounded-2xl border border-borde px-4 py-2.5 text-sm"
          >
            {copiado ? "¡Copiado!" : "Copiar"}
          </button>
        )}
      </div>

      <p className="mt-3 text-xs text-piedra">¿Qué pasó?</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {RESULTADOS.map((r) => (
          <button
            key={r}
            onClick={() => completar(r)}
            disabled={pending}
            className="rounded-full border border-borde bg-crema px-3 py-1.5 text-xs disabled:opacity-50"
          >
            {r}
          </button>
        ))}
        <button
          onClick={() => completar()}
          disabled={pending}
          className="rounded-full bg-tinta px-3 py-1.5 text-xs text-white disabled:opacity-50"
        >
          ✓ Hecho
        </button>
      </div>

      {posponiendo ? (
        <PosponerPanel
          pending={pending}
          onElegir={(hasta, motivo) =>
            startTransition(async () => {
              await posponerTarea(tarea.id, hasta, motivo);
              setPosponiendo(false);
              router.refresh();
            })
          }
          onCerrar={() => setPosponiendo(false)}
        />
      ) : (
        <button
          onClick={() => setPosponiendo(true)}
          className="mt-2 text-xs text-piedra underline"
        >
          Posponer…
        </button>
      )}
    </div>
  );
}

export function CrearAccionRapida({
  clienteId,
  oportunidadId,
}: {
  clienteId: string;
  oportunidadId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function crear(dias: number) {
    startTransition(async () => {
      await crearTarea({
        clienteId,
        oportunidadId,
        titulo: "Seguimiento",
        dias,
      });
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-1">
        Ahora toca
      </p>
      <p className="text-sm font-medium text-amber-900">
        Esta oportunidad no tiene próxima acción.
      </p>
      <p className="text-xs text-amber-800 mt-0.5">
        Regla de oro: todo lead abierto tiene un próximo paso o se cierra.
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {[
          { l: "Seguir mañana", d: 1 },
          { l: "En 2 días", d: 2 },
          { l: "En 7 días", d: 7 },
          { l: "En 30 días", d: 30 },
        ].map((o) => (
          <button
            key={o.l}
            onClick={() => crear(o.d)}
            disabled={pending}
            className="rounded-full border border-amber-400 bg-white px-3 py-1.5 text-xs disabled:opacity-50"
          >
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}
