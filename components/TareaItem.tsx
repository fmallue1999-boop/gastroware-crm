"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { completarTarea, posponerTarea, crearTarea } from "@/lib/actions";
import { linkWhatsApp, rellenarPlantilla, fechaCorta } from "@/lib/format";
import { TempBadge, ProductoBadge } from "@/components/Badges";
import type { Tarea } from "@/lib/types";

export const RESULTADOS = [
  "Respondió",
  "Sin respuesta",
  "Pidió financiación",
  "Quedó en avisar",
] as const;

export function diasHastaLunes(): number {
  const dow = new Date().getDay();
  return (8 - dow) % 7 || 7;
}

export default function TareaItem({
  tarea,
  vencida,
}: {
  tarea: Tarea;
  vencida?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [pedirProxima, setPedirProxima] = useState(false);
  const [eligiendoResultado, setEligiendoResultado] = useState(false);
  const [posponiendo, setPosponiendo] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const cliente = tarea.cliente;
  const opp = tarea.oportunidad;

  const mensaje = tarea.plantilla
    ? rellenarPlantilla(tarea.plantilla.contenido, {
        nombre: cliente?.nombre_comercial ?? "",
        producto: opp?.producto?.nombre ?? "el producto",
        monto: opp?.monto_estimado ? `$${opp.monto_estimado}` : "$X",
      })
    : null;

  function completar(resultado?: string) {
    startTransition(async () => {
      const res = await completarTarea(tarea.id, resultado);
      setEligiendoResultado(false);
      if (res && "sinProximaAccion" in res && res.sinProximaAccion) {
        setPedirProxima(true);
      }
    });
  }

  function proxima(dias: number) {
    startTransition(async () => {
      await crearTarea({
        clienteId: tarea.cliente_id,
        oportunidadId: tarea.oportunidad_id,
        titulo: "Seguimiento",
        dias,
      });
      setPedirProxima(false);
    });
  }

  function posponer(dias: number) {
    startTransition(async () => {
      await posponerTarea(tarea.id, dias);
      setPosponiendo(false);
    });
  }

  async function copiar() {
    if (!mensaje) return;
    await navigator.clipboard.writeText(mensaje);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }

  if (pedirProxima) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-3">
        <p className="text-sm font-medium text-amber-900">
          {cliente?.nombre_comercial}: la oportunidad quedó sin próxima acción.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button onClick={() => proxima(2)} className="rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-sm" disabled={pending}>
            Seguir en 2 días
          </button>
          <button onClick={() => proxima(7)} className="rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-sm" disabled={pending}>
            En 7 días
          </button>
          <button onClick={() => proxima(30)} className="rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-sm" disabled={pending}>
            En 30 días
          </button>
          {tarea.oportunidad_id && (
            <Link
              href={`/oportunidades/${tarea.oportunidad_id}`}
              className="rounded-lg bg-tinta px-3 py-1.5 text-sm text-white"
            >
              Cerrar oportunidad
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border bg-white p-3 ${vencida ? "border-red-200" : "border-borde"}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <TempBadge temperatura={opp?.temperatura ?? null} />
            <Link
              href={
                tarea.oportunidad_id
                  ? `/oportunidades/${tarea.oportunidad_id}`
                  : `/clientes/${tarea.cliente_id}`
              }
              className="truncate font-medium text-sm"
            >
              {cliente?.nombre_comercial ?? "Cliente"}
            </Link>
            <ProductoBadge nombre={opp?.producto?.nombre} />
            {vencida && (
              <span className="text-xs text-red-600 font-medium">
                venció {fechaCorta(tarea.vence_el)}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-tinta/70">{tarea.titulo}</p>
        </div>
        <button
          onClick={() => setEligiendoResultado(!eligiendoResultado)}
          disabled={pending}
          title="Marcar como hecha"
          className="shrink-0 rounded-full border border-borde w-8 h-8 text-piedra hover:border-green-500 hover:text-green-600 disabled:opacity-50"
        >
          ✓
        </button>
      </div>

      {eligiendoResultado ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {RESULTADOS.map((r) => (
            <button
              key={r}
              onClick={() => completar(r)}
              disabled={pending}
              className="rounded-full border border-borde bg-crema px-3 py-1.5 text-xs"
            >
              {r}
            </button>
          ))}
          <button
            onClick={() => completar()}
            disabled={pending}
            className="rounded-full bg-tinta px-3 py-1.5 text-xs text-white"
          >
            ✓ Solo completar
          </button>
        </div>
      ) : posponiendo ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button onClick={() => posponer(1)} disabled={pending} className="rounded-full border border-borde px-3 py-1.5 text-xs">
            Mañana
          </button>
          <button onClick={() => posponer(2)} disabled={pending} className="rounded-full border border-borde px-3 py-1.5 text-xs">
            En 2 días
          </button>
          <button onClick={() => posponer(diasHastaLunes())} disabled={pending} className="rounded-full border border-borde px-3 py-1.5 text-xs">
            El lunes
          </button>
          <button onClick={() => setPosponiendo(false)} className="rounded-full px-2 py-1.5 text-xs text-piedra">
            ✕
          </button>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {mensaje && cliente?.telefono && (
            <a
              href={linkWhatsApp(cliente.telefono, mensaje)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white"
            >
              WhatsApp
            </a>
          )}
          {mensaje && (
            <button
              onClick={copiar}
              className="rounded-lg border border-borde px-3 py-1.5 text-xs"
            >
              {copiado ? "¡Copiado!" : "Copiar mensaje"}
            </button>
          )}
          <button
            onClick={() => setPosponiendo(true)}
            disabled={pending}
            className="rounded-lg border border-borde px-3 py-1.5 text-xs text-piedra"
          >
            Posponer…
          </button>
        </div>
      )}
    </div>
  );
}
