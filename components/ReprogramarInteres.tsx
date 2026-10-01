"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { reprogramarInteres } from "@/lib/actions";
import { ACCIONES } from "@/lib/actividad";
import { fechaCorta, hoyISO, sumarDias } from "@/lib/format";

/** Días que faltan para el próximo lunes (si hoy es lunes, el de la semana que viene). */
function diasHastaLunes(): number {
  const dow = new Date(hoyISO() + "T12:00:00").getDay();
  return (8 - dow) % 7 || 7;
}

/**
 * Reprogramar un interés sin anotar un contacto (v1.13): más tarde hoy con
 * hora, mañana, el lunes, en una semana u otra fecha; qué toca hacer y una
 * nota opcional. Queda en el historial y Mi día lo muestra ese día.
 */
export function PanelReprogramar({
  oportunidadId,
  accion,
  onListo,
  onCancelar,
}: {
  oportunidadId: string;
  accion?: string | null;
  onListo?: (texto: string) => void;
  onCancelar?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const hoy = hoyISO();
  const opciones = [
    { k: "hoy", l: "Hoy más tarde", f: hoy },
    { k: "manana", l: "Mañana", f: sumarDias(1, hoy) },
    { k: "pasado", l: "Pasado mañana", f: sumarDias(2, hoy) },
    { k: "lunes", l: "El lunes", f: sumarDias(diasHastaLunes(), hoy) },
    { k: "semana", l: "En una semana", f: sumarDias(7, hoy) },
    { k: "otra", l: "Otra fecha", f: "" },
  ];
  const [cual, setCual] = useState<string | null>(null);
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [que, setQue] = useState(accion ?? "");
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);

  const elegir = (k: string, f: string) => {
    setCual(k);
    setFecha(f);
    setError(null);
  };

  function guardar() {
    if (!fecha) return setError(cual === "otra" ? "Elegí la fecha" : "Elegí cuándo");
    if (cual === "hoy" && !hora) return setError("Poné a qué hora");
    setError(null);
    startTransition(async () => {
      const res = await reprogramarInteres(oportunidadId, { fecha, hora: hora || null, accion: que || null, nota });
      if ("error" in res && res.error) return setError(res.error);
      const cuando = fecha === hoy ? "hoy" : fechaCorta(fecha);
      onListo?.(`Reprogramado para ${cuando}${hora ? ` a las ${hora}` : ""}`);
      router.refresh();
    });
  }

  const chip = (activo: boolean) =>
    `min-h-11 rounded-full border px-3.5 text-[15px] font-semibold disabled:opacity-50 ${
      activo ? "border-marino bg-marino text-white" : "border-borde bg-white text-tinta"
    }`;
  const campo = "min-h-11 rounded-xl border border-borde bg-white px-3 text-base outline-none focus:border-marino";

  return (
    <div className="space-y-3 rounded-2xl border border-borde bg-crema/60 p-3">
      <div>
        <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-piedra">¿Cuándo?</p>
        <div className="flex flex-wrap gap-1.5">
          {opciones.map((o) => (
            <button key={o.k} type="button" disabled={pending} onClick={() => elegir(o.k, o.f)} className={chip(cual === o.k)}>
              {o.l}
            </button>
          ))}
        </div>
        {cual && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {cual === "otra" && (
              <input type="date" min={hoy} value={fecha} onChange={(e) => setFecha(e.target.value)} className={campo} aria-label="Fecha" />
            )}
            <label className="flex items-center gap-2 text-[15px] text-piedra">
              {cual === "hoy" ? "A las" : "Hora (opcional)"}
              <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={campo} aria-label="Hora" autoFocus={cual === "hoy"} />
            </label>
            {fecha && cual !== "hoy" && <span className="text-[15px] font-semibold text-marino">{fechaCorta(fecha)}</span>}
          </div>
        )}
      </div>

      <div>
        <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-piedra">¿Qué vas a hacer?</p>
        <div className="flex flex-wrap gap-1.5">
          {ACCIONES.filter((a) => a.value !== "otra").map((a) => (
            <button key={a.value} type="button" disabled={pending} onClick={() => setQue(que === a.value ? "" : a.value)} className={chip(que === a.value)}>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <input
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        maxLength={120}
        placeholder="Nota (opcional): ej. prefiere que lo visite la semana que viene"
        className={`${campo} w-full`}
      />

      {error && <p className="text-[15px] font-semibold text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={guardar}
          className="min-h-11 flex-1 rounded-xl bg-marino px-4 text-[15px] font-bold text-white disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Reprogramar"}
        </button>
        {onCancelar && (
          <button type="button" disabled={pending} onClick={onCancelar} className="min-h-11 rounded-xl border border-borde bg-white px-4 text-[15px]">
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}

/** Botón "Reprogramar" que abre el panel ahí mismo (embudo y ficha). */
export default function ReprogramarInteres({
  oportunidadId,
  accion,
  className = "",
}: {
  oportunidadId: string;
  accion?: string | null;
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => {
          setAbierto(!abierto);
          setAviso(null);
        }}
        className={`inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border px-3 text-[15px] font-bold ${
          abierto ? "border-marino bg-marino text-white" : "border-borde bg-white text-tinta"
        } ${className}`}
      >
        <CalendarClock className="h-4 w-4" /> Reprogramar
      </button>
      {aviso && !abierto && <p className="text-center text-[15px] font-semibold text-verde">{aviso}</p>}
      {abierto && (
        <PanelReprogramar
          oportunidadId={oportunidadId}
          accion={accion}
          onListo={(t) => {
            setAviso(t);
            setAbierto(false);
          }}
          onCancelar={() => setAbierto(false)}
        />
      )}
    </div>
  );
}
