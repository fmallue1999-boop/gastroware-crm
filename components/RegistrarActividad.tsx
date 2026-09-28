"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Send } from "lucide-react";
import { anotarContacto, cambiarEtapa } from "@/lib/actions";
import {
  ACCIONES,
  MEDIOS,
  RESULTADOS,
  RESULTADOS_POR_MEDIO,
  nombreAccion,
  sugerenciaPorResultado,
  type Accion,
  type Medio,
  type Resultado,
} from "@/lib/actividad";
import { MOTIVOS_PERDIDA } from "@/lib/constants";
import { fechaCorta, hoyISO, sumarDias } from "@/lib/format";

export type InteresParaActividad = { id: string; texto: string; proximo?: string | null; accion?: string | null };

const CUANDO = [
  { label: "Hoy", dias: 0 },
  { label: "Mañana", dias: 1 },
  { label: "3 días", dias: 3 },
  { label: "1 semana", dias: 7 },
  { label: "2 semanas", dias: 14 },
  { label: "1 mes", dias: 30 },
] as const;

const chip = (activo: boolean, chico = false) =>
  `${chico ? "min-h-9 px-3 text-[14px]" : "min-h-10 px-3.5 text-[15px]"} shrink-0 rounded-full font-semibold ${
    activo ? "bg-marino text-white" : "border border-borde bg-white text-tinta/80"
  }`;

/**
 * Registrar actividad: cómo fue el contacto (llamada, WhatsApp…), qué
 * resultado tuvo, qué pasó y el próximo paso con su fecha, en un solo
 * guardado. Si ya hay un próximo contacto se puede mantener (no se duplica)
 * o cambiar con el motivo (queda la fecha anterior en el historial). Abrir
 * WhatsApp o llamar no registra nada: el resultado lo confirma la persona.
 */
export default function RegistrarActividad({
  clienteId,
  intereses = [],
  oportunidadId,
  proximoActual,
  personas = [],
  variante = "caja",
  onGuardado,
}: {
  clienteId: string;
  intereses?: InteresParaActividad[];
  /** Interés fijo (fila de Mi día, embudo) o preseleccionado (ficha). */
  oportunidadId?: string | null;
  /** Próximo contacto que ya tiene el interés fijo. */
  proximoActual?: { fecha: string | null; accion?: string | null } | null;
  personas?: { id: string; nombre: string }[];
  /** chat: la barra de abajo de la ficha · caja: formulario completo (Mi día). */
  variante?: "chat" | "caja";
  onGuardado?: () => void;
}) {
  const router = useRouter();
  const hoy = hoyISO();
  const [pending, startTransition] = useTransition();
  const [sobre, setSobre] = useState<string>(oportunidadId ?? intereses[0]?.id ?? "");
  const actual =
    proximoActual ??
    (() => {
      const i = intereses.find((x) => x.id === (sobre || oportunidadId));
      return i ? { fecha: i.proximo ?? null, accion: i.accion ?? null } : null;
    })();
  const hayProximoVigente = Boolean(actual?.fecha && actual.fecha >= hoy);

  const [medio, setMedio] = useState<Medio | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [texto, setTexto] = useState("");
  const [accion, setAccion] = useState<Accion | null>(null);
  const [volverEl, setVolverEl] = useState("");
  const [sinFecha, setSinFecha] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [contactoId, setContactoId] = useState<string>("");
  const [cerrar, setCerrar] = useState(false);
  const [motivoPerdida, setMotivoPerdida] = useState<string>(MOTIVOS_PERDIDA[0]);
  const [abrirProximo, setAbrirProximo] = useState(variante === "caja");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  // Sin tocar nada del próximo paso: si hay uno vigente, se mantiene
  const mantener = hayProximoVigente && !volverEl && !sinFecha;
  const reprograma = hayProximoVigente && Boolean(volverEl) && volverEl !== actual?.fecha;
  const hayAlgo = Boolean(texto.trim() || medio || volverEl || sinFecha);

  function elegirMedio(m: Medio) {
    const nuevo = medio === m ? null : m;
    setMedio(nuevo);
    if (!nuevo || (resultado && !RESULTADOS_POR_MEDIO[nuevo].includes(resultado))) setResultado(null);
  }

  function elegirResultado(r: Resultado) {
    const nuevo = resultado === r ? null : r;
    setResultado(nuevo);
    if (nuevo !== "no_interesado") setCerrar(false);
    // Sugerencia de próximo paso (se puede cambiar)
    const s = nuevo ? sugerenciaPorResultado(medio, nuevo) : null;
    if (s && !volverEl) {
      setAccion(s.accion);
      setVolverEl(sumarDias(s.dias));
      setSinFecha(false);
      setAbrirProximo(true);
    }
  }

  function elegirCuando(dias: number) {
    const f = sumarDias(dias);
    setSinFecha(false);
    setVolverEl(volverEl === f ? "" : f);
  }

  function guardar(e?: React.FormEvent) {
    e?.preventDefault();
    if (!hayAlgo || pending) return;
    setError(null);
    const interes = sobre || oportunidadId || null;
    startTransition(async () => {
      const res = await anotarContacto(clienteId, texto, cerrar ? null : volverEl || null, {
        oportunidadId: interes,
        sinFecha: cerrar ? false : sinFecha,
        medio,
        resultado,
        accion,
        mantener: !cerrar && mantener,
        motivo,
        contactoId: contactoId || null,
      });
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      const opp = (res as { oportunidadId?: string | null }).oportunidadId ?? interes;
      if (cerrar && opp) {
        const r2 = await cambiarEtapa(opp, "perdida", motivoPerdida);
        if (r2 && "error" in r2 && r2.error) {
          setError(r2.error);
          return;
        }
      }
      setMedio(null);
      setResultado(null);
      setTexto("");
      setAccion(null);
      setVolverEl("");
      setSinFecha(false);
      setMotivo("");
      setCerrar(false);
      setAbrirProximo(variante === "caja");
      setOk(true);
      setTimeout(() => setOk(false), 2000);
      onGuardado?.();
      router.refresh();
    });
  }

  const etiquetaProximo = cerrar
    ? "Se cierra"
    : sinFecha
      ? "Sin próximo"
      : volverEl
        ? [nombreAccion(accion), volverEl === hoy ? "hoy" : fechaCorta(volverEl)].filter(Boolean).join(" · ")
        : hayProximoVigente
          ? `Sigue: ${fechaCorta(actual!.fecha)}`
          : "Próximo";

  // --- Piezas ---
  const selectorInteres =
    intereses.length > 1 && !oportunidadId ? (
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
    ) : null;

  const filaMedio = (
    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
      {MEDIOS.map((m) => (
        <button key={m.value} type="button" onClick={() => elegirMedio(m.value)} className={chip(medio === m.value, true)}>
          {m.label}
        </button>
      ))}
      {personas.length > 1 && (
        <select
          value={contactoId}
          onChange={(e) => setContactoId(e.target.value)}
          aria-label="Con quién"
          className="min-h-9 shrink-0 rounded-full border border-borde bg-white px-3 text-[14px] text-tinta/80"
        >
          <option value="">Con quién…</option>
          {personas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      )}
    </div>
  );

  const filaResultado = medio ? (
    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
      {RESULTADOS_POR_MEDIO[medio].map((r) => (
        <button key={r} type="button" onClick={() => elegirResultado(r)} className={chip(resultado === r, true)}>
          {RESULTADOS[r]}
        </button>
      ))}
    </div>
  ) : null;

  const cierre =
    resultado === "no_interesado" && (sobre || oportunidadId) ? (
      <div className="space-y-1.5 rounded-xl bg-crema p-2.5">
        <label className="flex items-center gap-2 text-[15px] font-bold">
          <input type="checkbox" checked={cerrar} onChange={(e) => setCerrar(e.target.checked)} /> Cerrar el interés como “No se dio”
        </label>
        {cerrar && (
          <select value={motivoPerdida} onChange={(e) => setMotivoPerdida(e.target.value)} className="min-h-10 w-full rounded-xl border border-borde bg-white px-2 text-[15px]">
            {MOTIVOS_PERDIDA.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        )}
        {cerrar && <p className="text-xs text-piedra">No hace falta agendar nada: el seguimiento de este interés se cierra.</p>}
      </div>
    ) : null;

  const panelProximo = !cerrar ? (
    <div className="space-y-1.5">
      <p className="text-xs font-bold uppercase tracking-wide text-piedra">Próximo paso</p>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
        {ACCIONES.map((a) => (
          <button key={a.value} type="button" onClick={() => setAccion(accion === a.value ? null : a.value)} className={chip(accion === a.value, true)}>
            {a.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {hayProximoVigente && (
          <button
            type="button"
            onClick={() => {
              setVolverEl("");
              setSinFecha(false);
            }}
            className={chip(mantener, true)}
          >
            Mantener {[nombreAccion(actual?.accion), fechaCorta(actual!.fecha)].filter(Boolean).join(" ")}
          </button>
        )}
        {CUANDO.map((c) => (
          <button key={c.label} type="button" onClick={() => elegirCuando(c.dias)} className={chip(volverEl === sumarDias(c.dias), true)}>
            {c.label}
          </button>
        ))}
        <input
          type="date"
          value={volverEl}
          min={hoy}
          onChange={(e) => {
            setVolverEl(e.target.value);
            setSinFecha(false);
          }}
          aria-label="Otra fecha"
          className="min-h-9 rounded-full border border-borde bg-white px-3 text-sm outline-none focus:border-marino"
        />
        <button
          type="button"
          onClick={() => {
            setSinFecha(!sinFecha);
            setVolverEl("");
          }}
          className={chip(sinFecha, true)}
        >
          Sin próximo
        </button>
      </div>
      {reprograma && (
        <input
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder={`Motivo del cambio (estaba para el ${fechaCorta(actual!.fecha)})`}
          className="min-h-10 w-full rounded-xl border border-borde bg-white px-3 text-[15px] outline-none focus:border-marino"
        />
      )}
      {sinFecha && <p className="text-xs text-ambar">Queda en “Sin próximo paso” de Mi día hasta que le pongas uno.</p>}
    </div>
  ) : null;

  if (variante === "chat") {
    return (
      <form onSubmit={guardar} className="space-y-2">
        {selectorInteres}
        {filaMedio}
        {filaResultado}
        {cierre}
        {abrirProximo && panelProximo}
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
            onClick={() => setAbrirProximo(!abrirProximo)}
            className={`inline-flex min-h-12 max-w-[45%] shrink-0 items-center gap-1.5 truncate rounded-full px-3.5 text-[15px] font-semibold ${
              volverEl || sinFecha || cerrar ? "bg-marino text-white" : "border border-borde bg-white text-piedra"
            }`}
          >
            <CalendarClock className="h-4 w-4 shrink-0" /> <span className="truncate">{etiquetaProximo}</span>
          </button>
          <button
            type="submit"
            disabled={pending || !hayAlgo}
            aria-label="Guardar"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-verde text-white disabled:opacity-40"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}
      </form>
    );
  }

  return (
    <form onSubmit={guardar} className="space-y-2.5 rounded-2xl border border-borde bg-crema/60 p-3">
      {selectorInteres}
      <div className="space-y-1.5">
        <p className="text-xs font-bold uppercase tracking-wide text-piedra">¿Cómo fue?</p>
        {filaMedio}
        {filaResultado}
      </div>
      {cierre}
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={2}
        placeholder="Qué pasó (opcional si elegiste el resultado)"
        className="w-full rounded-2xl border border-borde bg-white px-4 py-3 text-base outline-none focus:border-marino"
      />
      {panelProximo}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending || !hayAlgo}
        className="min-h-11 w-full rounded-2xl bg-marino py-3 text-[15px] font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Guardando…" : ok ? "✓ Guardado" : "Guardar"}
      </button>
    </form>
  );
}
