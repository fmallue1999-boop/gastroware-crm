"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CalendarClock, MessageCircle, Phone } from "lucide-react";
import { cerrarSeguimiento, posponerTarea } from "@/lib/actions";
import { fechaCorta, hoyISO, linkWhatsApp } from "@/lib/format";
import PosponerPanel from "@/components/PosponerPanel";

const RESULTADOS = ["Hablamos", "No atendió", "Quedó en avisar", "Le mandé info"];

/**
 * Un "volver a contactar" pendiente: a quién, cuándo, y dos botones:
 * Hecho o Cambiar fecha. Sin rojos: si venció, se avisa en ámbar.
 */
export default function SeguimientoItem({
  tarea,
  mostrarContacto = true,
}: {
  tarea: {
    id: string;
    titulo: string;
    vence_el: string;
    cliente_id: string;
    cliente?: { nombre_comercial: string; telefono: string | null } | null;
    responsable?: string | null;
  };
  mostrarContacto?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [cerrando, setCerrando] = useState(false);
  const [posponiendo, setPosponiendo] = useState(false);
  const hoy = hoyISO();
  const vencida = tarea.vence_el < hoy;
  const esHoy = tarea.vence_el === hoy;

  function hecho(resultado?: string) {
    startTransition(async () => {
      await cerrarSeguimiento(tarea.id, resultado);
      setCerrando(false);
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-borde bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {mostrarContacto && tarea.cliente && (
            <Link
              href={`/clientes/${tarea.cliente_id}`}
              className="block truncate text-sm font-semibold hover:underline"
            >
              {tarea.cliente.nombre_comercial}
            </Link>
          )}
          <p className="text-sm text-tinta/80">{tarea.titulo}</p>
          <p className={`text-xs ${vencida ? "font-medium text-amber-700" : "text-piedra"}`}>
            {vencida
              ? `Era para el ${fechaCorta(tarea.vence_el)}`
              : esHoy
                ? "Para hoy"
                : `Para el ${fechaCorta(tarea.vence_el)}`}
            {tarea.responsable ? ` · ${tarea.responsable}` : ""}
          </p>
        </div>
        {tarea.cliente?.telefono && (
          <div className="flex shrink-0 gap-1.5">
            <a
              href={linkWhatsApp(tarea.cliente.telefono)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-green-600 text-white"
            >
              <MessageCircle className="h-4 w-4" />
            </a>
            <a
              href={`tel:${tarea.cliente.telefono}`}
              aria-label="Llamar"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-borde text-tinta"
            >
              <Phone className="h-4 w-4" />
            </a>
          </div>
        )}
      </div>

      {cerrando ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {RESULTADOS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => hecho(r)}
              disabled={pending}
              className="rounded-full border border-borde bg-crema px-3 py-1.5 text-xs disabled:opacity-50"
            >
              {r}
            </button>
          ))}
          <button
            type="button"
            onClick={() => hecho()}
            disabled={pending}
            className="rounded-full bg-tinta px-3 py-1.5 text-xs text-white disabled:opacity-50"
          >
            Solo marcar hecho
          </button>
          <button
            type="button"
            onClick={() => setCerrando(false)}
            className="px-2 text-xs text-piedra underline"
          >
            Cancelar
          </button>
        </div>
      ) : posponiendo ? (
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
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => setCerrando(true)}
            disabled={pending}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-tinta py-2 text-xs font-medium text-white disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" /> Hecho
          </button>
          <button
            type="button"
            onClick={() => setPosponiendo(true)}
            disabled={pending}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-borde py-2 text-xs font-medium text-piedra disabled:opacity-50"
          >
            <CalendarClock className="h-3.5 w-3.5" /> Cambiar fecha
          </button>
        </div>
      )}
    </div>
  );
}
