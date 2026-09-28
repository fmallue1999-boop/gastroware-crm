"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, Link2, Plus, Repeat, Trash2 } from "lucide-react";
import { crearAgenda, editarAgenda, type EntradaAgenda } from "@/lib/actions";
import {
  AVISOS,
  avisoPorDefecto,
  esEvento,
  fechasSerie,
  hastaSugerido,
  REPETICIONES,
  TIPOS_AGENDA,
  type LinkAgenda,
  type Repite,
  type TipoAgenda,
} from "@/lib/agenda";
import { nombrePuesto } from "@/lib/puestos";
import { estiloTipo } from "@/components/agenda/estilo";

type Usuario = { id: string; nombre: string; rol: string };

const cls = "min-h-11 w-full rounded-xl border border-borde bg-white px-3 py-2 text-[15px] outline-none focus:border-marino";
const etiqueta = "mb-1 block text-[15px] font-bold";

/**
 * Nueva tarea, reunión, capacitación o pago (o cambiar una). Se asigna a
 * una o varias personas; puede llevar links, repetirse y avisar días antes.
 */
export default function AgendaForm({
  usuarios,
  yo,
  hoy,
  inicial,
  editar,
}: {
  usuarios: Usuario[];
  yo: string;
  hoy: string;
  inicial?: { fecha?: string; tipo?: TipoAgenda; personas?: string[] };
  editar?: { id: string; siguientes: number; puedeGestionar: boolean; valores: EntradaAgenda };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const v = editar?.valores;
  const tipoInicial = v?.tipo ?? inicial?.tipo ?? "tarea";
  const [tipo, setTipo] = useState<TipoAgenda>(tipoInicial);
  const [titulo, setTitulo] = useState(v?.titulo ?? "");
  const [fecha, setFecha] = useState(v?.fecha ?? inicial?.fecha ?? hoy);
  const [hora, setHora] = useState(v?.hora?.slice(0, 5) ?? "");
  const [horaFin, setHoraFin] = useState(v?.horaFin?.slice(0, 5) ?? "");
  const [personas, setPersonas] = useState<string[]>(v?.personas ?? inicial?.personas ?? [yo]);
  const [lugar, setLugar] = useState(v?.lugar ?? "");
  const [descripcion, setDescripcion] = useState(v?.descripcion ?? "");
  const [links, setLinks] = useState<LinkAgenda[]>(v?.links?.length ? v.links : []);
  const [monto, setMonto] = useState(v?.monto != null ? String(v.monto) : "");
  const [moneda, setMoneda] = useState<"ARS" | "USD">(v?.moneda ?? "ARS");
  const [avisoDias, setAvisoDias] = useState<number>(v?.avisoDias ?? avisoPorDefecto(tipoInicial));
  const [repite, setRepite] = useState<Repite | "">("");
  const [hasta, setHasta] = useState("");
  const [alcance, setAlcance] = useState<"esta" | "siguientes">("esta");
  const [error, setError] = useState<string | null>(null);

  const evento = esEvento(tipo);
  const cantidadFechas = repite ? fechasSerie(fecha, repite, hasta).length : 1;
  const ejemplo = TIPOS_AGENDA.find((t) => t.value === tipo)?.ejemplo ?? "";
  const bloquearPersonas = Boolean(editar && !editar.puedeGestionar);

  function elegirTipo(t: TipoAgenda) {
    setTipo(t);
    // El aviso por defecto sigue al tipo mientras no lo hayan cambiado a mano
    if (avisoDias === avisoPorDefecto(tipo)) setAvisoDias(avisoPorDefecto(t));
  }

  function alternarPersona(id: string) {
    setPersonas((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  function guardar() {
    setError(null);
    const entrada: EntradaAgenda = {
      titulo,
      tipo,
      descripcion,
      fecha,
      hora: hora || null,
      horaFin: evento ? horaFin || null : null,
      lugar,
      links: links.filter((l) => l.url.trim()),
      monto: tipo === "pago" && monto.trim() ? Number(monto.replace(/\./g, "").replace(",", ".")) : null,
      moneda,
      avisoDias,
      personas,
      repite,
      hasta: repite ? hasta : null,
    };
    startTransition(async () => {
      const r = editar ? await editarAgenda(editar.id, entrada, alcance) : await crearAgenda(entrada);
      if (r && "error" in r && r.error) {
        setError(r.error);
        return;
      }
      const id = editar?.id ?? (r as unknown as { id: string }).id;
      router.push(`/tareas/${id}`);
      router.refresh();
    });
  }

  const ordenados = [...usuarios].sort((a, b) => (a.id === yo ? -1 : b.id === yo ? 1 : a.nombre.localeCompare(b.nombre)));
  const todos = usuarios.length > 0 && usuarios.every((u) => personas.includes(u.id));

  return (
    <div className="space-y-4">
      {/* Tipo */}
      <div className="flex flex-wrap gap-2">
        {TIPOS_AGENDA.map((t) => {
          const e = estiloTipo(t.value);
          const Icono = e.icono;
          const activo = tipo === t.value;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => elegirTipo(t.value)}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3.5 text-[15px] font-bold ${
                activo ? `border-transparent ${e.chip}` : "border-borde bg-white text-tinta/80"
              }`}
            >
              <Icono className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      <label className="block">
        <span className={etiqueta}>Título</span>
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={ejemplo} maxLength={200} className={cls} autoFocus={!editar} />
      </label>

      {/* Cuándo */}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className={etiqueta}>{tipo === "pago" ? "Vence el" : "Fecha"}</span>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={cls} />
        </label>
        <label className="block">
          <span className={etiqueta}>Hora {evento ? "" : "(opcional)"}</span>
          <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={cls} />
        </label>
        {evento && (
          <label className="block">
            <span className={etiqueta}>Hasta (opcional)</span>
            <input type="time" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} disabled={!hora} className={`${cls} disabled:opacity-50`} />
          </label>
        )}
      </div>

      {tipo === "pago" && (
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <label className="block">
            <span className={etiqueta}>Monto (opcional)</span>
            <input inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="Ej: 850000" className={cls} />
          </label>
          <label className="block">
            <span className={etiqueta}>Moneda</span>
            <select value={moneda} onChange={(e) => setMoneda(e.target.value as "ARS" | "USD")} className={cls}>
              <option value="ARS">Pesos</option>
              <option value="USD">Dólares</option>
            </select>
          </label>
        </div>
      )}

      {/* Quiénes */}
      <div>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[15px] font-bold">¿Quiénes?</span>
          {!bloquearPersonas && (
            <button
              type="button"
              onClick={() => setPersonas(todos ? [yo] : usuarios.map((u) => u.id))}
              className="text-[14px] font-bold text-marino underline"
            >
              {todos ? "Solo yo" : "Todo el equipo"}
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {ordenados.map((u) => {
            const activo = personas.includes(u.id);
            return (
              <button
                key={u.id}
                type="button"
                disabled={bloquearPersonas}
                onClick={() => alternarPersona(u.id)}
                title={nombrePuesto(u.rol)}
                className={`min-h-10 rounded-full border px-3 text-[14px] font-bold disabled:cursor-not-allowed ${
                  activo ? "border-marino bg-marino text-white" : "border-borde bg-white text-tinta/80"
                }`}
              >
                {u.id === yo ? "Yo" : u.nombre}
              </button>
            );
          })}
        </div>
        {bloquearPersonas && <p className="mt-1 text-xs text-piedra">Las personas las cambia quien la creó o dirección.</p>}
      </div>

      {evento && (
        <label className="block">
          <span className={etiqueta}>Dónde o link de la videollamada (opcional)</span>
          <input value={lugar} onChange={(e) => setLugar(e.target.value)} placeholder="Oficina, o https://meet.google.com/…" className={cls} />
        </label>
      )}

      <label className="block">
        <span className={etiqueta}>Detalle (opcional)</span>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={3}
          placeholder={tipo === "reunion" ? "Temario, qué traer…" : tipo === "pago" ? "A quién, CBU, cómo se paga…" : "Qué hay que hacer"}
          className={cls}
        />
      </label>

      {/* Links */}
      <div className="space-y-2">
        <span className="flex items-center gap-1.5 text-[15px] font-bold">
          <Link2 className="h-4 w-4" /> Links (opcional)
        </span>
        {links.map((l, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={l.url}
              onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
              placeholder="https://…"
              className={`${cls} flex-[2]`}
            />
            <input
              value={l.texto ?? ""}
              onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, texto: e.target.value } : x)))}
              placeholder="Nombre (opcional)"
              className={`${cls} flex-1`}
            />
            <button
              type="button"
              onClick={() => setLinks(links.filter((_, j) => j !== i))}
              aria-label="Quitar link"
              className="flex min-h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-borde bg-white text-piedra"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {links.length < 10 && (
          <button
            type="button"
            onClick={() => setLinks([...links, { url: "", texto: "" }])}
            className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-dashed border-borde bg-white px-3 text-[14px] font-bold text-marino"
          >
            <Plus className="h-4 w-4" /> Agregar link
          </button>
        )}
      </div>

      {/* Aviso y repetición */}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={`${etiqueta} flex items-center gap-1.5`}>
            <Bell className="h-4 w-4" /> Aviso
          </span>
          <select value={avisoDias} onChange={(e) => setAvisoDias(Number(e.target.value))} className={cls}>
            {AVISOS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        {!editar && (
          <label className="block">
            <span className={`${etiqueta} flex items-center gap-1.5`}>
              <Repeat className="h-4 w-4" /> Repetir
            </span>
            <select
              value={repite}
              onChange={(e) => {
                const r = e.target.value as Repite | "";
                setRepite(r);
                setHasta(hastaSugerido(fecha, r));
              }}
              className={cls}
            >
              {REPETICIONES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {!editar && repite && (
        <label className="block">
          <span className={etiqueta}>Se repite hasta</span>
          <input type="date" value={hasta} min={fecha} onChange={(e) => setHasta(e.target.value)} className={cls} />
          <span className="mt-1 block text-[14px] text-piedra">
            {cantidadFechas} {cantidadFechas === 1 ? "fecha" : "fechas"}
            {cantidadFechas >= 60 ? " (el máximo de una vez)" : ""}
          </span>
        </label>
      )}
      <p className="text-[14px] text-piedra">
        El aviso llega a la campana y al celular a las 8:30
        {avisoDias ? ` ${avisoDias === 1 ? "del día antes" : `${avisoDias} días antes`} y el mismo día` : " del mismo día"}. A quien asignás le llega
        el aviso apenas guardás.
      </p>

      {editar && editar.siguientes > 0 && (
        <div className="space-y-1 rounded-xl bg-crema p-3">
          <p className="text-[15px] font-bold">Se repite: ¿qué cambiás?</p>
          <label className="flex items-center gap-2 text-[15px]">
            <input type="radio" checked={alcance === "esta"} onChange={() => setAlcance("esta")} /> Solo esta fecha
          </label>
          <label className="flex items-center gap-2 text-[15px]">
            <input type="radio" checked={alcance === "siguientes"} onChange={() => setAlcance("siguientes")} /> Esta y las siguientes ({editar.siguientes})
          </label>
        </div>
      )}

      {error && <p className="text-[15px] font-bold text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={guardar}
          className="min-h-12 flex-1 rounded-xl bg-marino px-4 text-[16px] font-extrabold text-white disabled:opacity-50"
        >
          {pending ? "Guardando…" : editar ? "Guardar cambios" : cantidadFechas > 1 ? `Guardar (${cantidadFechas} fechas)` : "Guardar"}
        </button>
        <button type="button" onClick={() => router.back()} className="min-h-12 rounded-xl border border-borde bg-white px-4 text-[15px] font-bold">
          Cancelar
        </button>
      </div>
    </div>
  );
}
