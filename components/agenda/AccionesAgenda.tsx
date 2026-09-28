"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarPlus, Check, Pencil, RotateCcw, SkipForward, Trash2 } from "lucide-react";
import { borrarAgenda, marcarAgenda, moverAgenda } from "@/lib/actions";
import { esEvento, masDias, textoHecha } from "@/lib/agenda";

/** Botones del detalle: hecha/pagado, pasar a mañana, cambiar, borrar y agregar al calendario del celular. */
export default function AccionesAgenda({
  id,
  tipo,
  fecha,
  hoy,
  mia,
  hechaYo,
  puedeEditar,
  puedeGestionar,
  siguientes,
  linkGoogle,
}: {
  id: string;
  tipo: string;
  fecha: string;
  hoy: string;
  mia: boolean;
  hechaYo: boolean;
  puedeEditar: boolean;
  puedeGestionar: boolean;
  siguientes: number;
  linkGoogle: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [borrando, setBorrando] = useState(false);
  const [msg, setMsg] = useState<{ texto: string; error?: boolean } | null>(null);

  function correr(fn: () => Promise<{ error?: string } | { ok: true }>, ok: string, despues?: () => void) {
    setMsg(null);
    startTransition(async () => {
      const r = (await fn()) as { error?: string };
      if (r?.error) setMsg({ texto: r.error, error: true });
      else {
        setMsg({ texto: ok });
        if (despues) despues();
        else router.refresh();
      }
    });
  }

  const boton = "inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-borde bg-white px-3.5 text-[15px] font-bold disabled:opacity-50";
  const manana = masDias(fecha < hoy ? hoy : fecha, 1);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {mia && !esEvento(tipo) && (
          <button
            type="button"
            disabled={pending}
            onClick={() => correr(() => marcarAgenda(id, !hechaYo), hechaYo ? "Volvió a pendiente" : "¡Listo!")}
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl px-4 text-[15px] font-extrabold disabled:opacity-50 ${
              hechaYo ? "border border-borde bg-white text-piedra" : "bg-verde text-white"
            }`}
          >
            {hechaYo ? <RotateCcw className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            {hechaYo ? "Volver a pendiente" : `Marcar ${textoHecha(tipo).toLowerCase()}`}
          </button>
        )}
        {puedeEditar && (
          <Link href={`/tareas/${id}?editar=1`} className={boton}>
            <Pencil className="h-4 w-4" /> Cambiar
          </Link>
        )}
        {puedeEditar && !hechaYo && (
          <button type="button" disabled={pending} onClick={() => correr(() => moverAgenda(id, manana), "Movida")} className={boton}>
            <SkipForward className="h-4 w-4" /> {fecha < hoy ? "Pasar a mañana" : "Un día más"}
          </button>
        )}
        <a href={linkGoogle} target="_blank" rel="noreferrer" className={boton}>
          <CalendarPlus className="h-4 w-4" /> Google Calendar
        </a>
        <a href={`/tareas/${id}/ics`} className={boton} title="Para iPhone u Outlook">
          <CalendarPlus className="h-4 w-4" /> iPhone / Outlook
        </a>
        {puedeGestionar && !borrando && (
          <button type="button" onClick={() => setBorrando(true)} className={`${boton} text-red-600`}>
            <Trash2 className="h-4 w-4" /> Borrar
          </button>
        )}
      </div>

      {borrando && (
        <div className="space-y-2 rounded-xl bg-red-50 p-3">
          <p className="text-[15px] font-bold text-red-700">¿Borrar? A quienes la tienen les llega el aviso de que se canceló.</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => correr(() => borrarAgenda(id, "esta"), "Borrada", () => router.push("/tareas"))}
              className="min-h-11 rounded-xl bg-red-600 px-4 text-[15px] font-extrabold text-white disabled:opacity-50"
            >
              {siguientes > 0 ? "Solo esta fecha" : "Sí, borrar"}
            </button>
            {siguientes > 0 && (
              <button
                type="button"
                disabled={pending}
                onClick={() => correr(() => borrarAgenda(id, "siguientes"), "Borradas", () => router.push("/tareas"))}
                className="min-h-11 rounded-xl bg-red-600 px-4 text-[15px] font-extrabold text-white disabled:opacity-50"
              >
                Esta y las siguientes ({siguientes})
              </button>
            )}
            <button type="button" onClick={() => setBorrando(false)} className="min-h-11 rounded-xl border border-borde bg-white px-4 text-[15px]">
              No
            </button>
          </div>
        </div>
      )}
      {msg && <p className={`text-[15px] font-bold ${msg.error ? "text-red-600" : "text-verde"}`}>{msg.texto}</p>}
    </div>
  );
}
