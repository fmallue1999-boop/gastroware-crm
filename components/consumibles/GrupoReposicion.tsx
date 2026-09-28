"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageCircle, Phone, SlidersHorizontal } from "lucide-react";
import { ajustarReposicion, contactoReposicion, cotizarReposicion, reactivarReposicion, suspenderReposicion } from "@/lib/actions";
import { MEDIOS, RESULTADOS, RESULTADOS_POR_MEDIO, type Medio, type Resultado } from "@/lib/actividad";
import { cantidadTexto, estadoPlan, MOTIVOS_SUSPENSION, reposicionEstimada } from "@/lib/consumibles";
import { diasEntre } from "@/lib/agenda";
import { fechaCorta, linkWhatsApp, sumarDias } from "@/lib/format";
import type { PlanVista } from "@/lib/servidor/consumibles";

const chip = (activo: boolean) =>
  `min-h-9 shrink-0 rounded-full px-3 text-[14px] font-semibold ${activo ? "bg-marino text-white" : "border border-borde bg-white text-tinta/80"}`;
const boton = "inline-flex min-h-10 items-center gap-1 rounded-xl border border-borde bg-white px-3 text-[14px] font-bold disabled:opacity-50";

const ESTADO: Record<string, { texto: (d: number) => string; clase: string }> = {
  vencido: { texto: (d) => `Contactar: hace ${-d} ${-d === 1 ? "día" : "días"}`, clase: "bg-red-100 text-red-700" },
  hoy: { texto: () => "Contactar hoy", clase: "bg-ambar-soft text-ambar" },
  pronto: { texto: (d) => `Contactar en ${d} ${d === 1 ? "día" : "días"}`, clase: "bg-verde-soft text-verde" },
  programado: { texto: () => "Programado", clase: "bg-crema text-piedra" },
  suspendido: { texto: () => "Suspendido", clase: "bg-crema-deep text-piedra" },
};

/**
 * La reposición de un cliente: sus productos con la última compra y la fecha
 * de contacto, y lo que se hace desde acá (anotar el contacto, registrar la
 * venta, cotizar, reprogramar porque tiene stock, suspender, ajustar el tiempo).
 * Llamar o abrir WhatsApp no registra nada solo.
 */
export default function GrupoReposicion({
  planes,
  hoy,
  usuarios = [],
}: {
  planes: PlanVista[];
  hoy: string;
  usuarios?: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [modo, setModo] = useState<null | "anotar" | "reprogramar" | "suspender" | "ajustar">(null);
  const [medio, setMedio] = useState<Medio | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [nota, setNota] = useState("");
  const [volverEl, setVolverEl] = useState("");
  const [motivo, setMotivo] = useState("");
  const [ajuste, setAjuste] = useState<string>(planes[0]?.id ?? "");
  const [msg, setMsg] = useState<{ texto: string; error?: boolean } | null>(null);

  const primero = planes[0];
  const cliente = primero?.cliente;
  const ids = planes.map((p) => p.id);
  const estado = estadoPlan(primero, hoy);
  const e = ESTADO[estado];
  const suspendidos = planes.every((p) => !p.activa);

  function correr(fn: () => Promise<{ error?: string } | { ok: true }>, ok: string) {
    setMsg(null);
    startTransition(async () => {
      const r = (await fn()) as { error?: string };
      if (r?.error) setMsg({ texto: r.error, error: true });
      else {
        setModo(null);
        setMedio(null);
        setResultado(null);
        setNota("");
        setVolverEl("");
        setMotivo("");
        setMsg({ texto: ok });
        router.refresh();
      }
    });
  }

  const fechas = (
    <div className="flex flex-wrap items-center gap-1.5">
      {[7, 15, 30].map((d) => (
        <button key={d} type="button" onClick={() => setVolverEl(volverEl === sumarDias(d) ? "" : sumarDias(d))} className={chip(volverEl === sumarDias(d))}>
          En {d} días
        </button>
      ))}
      <input
        type="date"
        value={volverEl}
        min={hoy}
        onChange={(ev) => setVolverEl(ev.target.value)}
        className="min-h-9 rounded-full border border-borde bg-white px-3 text-sm"
        aria-label="Otra fecha"
      />
    </div>
  );

  const plan = planes.find((p) => p.id === ajuste) ?? primero;

  return (
    <div className="space-y-2.5 rounded-2xl bg-white p-3.5 shadow-sm">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <Link href={`/clientes/${primero.cliente_id}`} className="text-[16px] font-extrabold hover:underline">
            {cliente?.nombre_comercial ?? "Cliente"}
          </Link>
          <p className="text-xs text-piedra">
            {primero.sucursal ? `${primero.sucursal.nombre}${primero.sucursal.ciudad ? ` · ${primero.sucursal.ciudad}` : ""} · ` : ""}
            {primero.responsable ? `A cargo: ${primero.responsable}` : "Sin responsable"}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${e.clase}`}>{e.texto(diasEntre(hoy, primero.proxima_alerta))}</span>
        {cliente?.telefono && (
          <div className="flex gap-1.5">
            <a href={linkWhatsApp(cliente.telefono)} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="flex h-10 w-10 items-center justify-center rounded-full bg-verde text-white">
              <MessageCircle className="h-4 w-4" />
            </a>
            <a href={`tel:${cliente.telefono}`} aria-label="Llamar" className="flex h-10 w-10 items-center justify-center rounded-full border border-borde bg-white">
              <Phone className="h-4 w-4" />
            </a>
          </div>
        )}
      </div>

      <ul className="space-y-1">
        {planes.map((p) => {
          const repone = reposicionEstimada(p.ultima_compra, p.frecuencia_dias);
          return (
            <li key={p.id} className="rounded-xl bg-crema px-3 py-2 text-[14px]">
              <p className="font-bold">{p.producto?.nombre ?? "Consumible"}</p>
              <p className="text-piedra">
                {p.ultima_compra ? `Última compra ${fechaCorta(p.ultima_compra)}${p.ultima_cantidad ? ` (${cantidadTexto(p.ultima_cantidad, p.unidad)})` : ""}` : "Sin compras registradas"}
                {" · "}
                {p.frecuencia_dias ? `repone cada ${p.frecuencia_dias} días${repone ? ` (~${fechaCorta(repone)})` : ""}` : "tiempo sin definir"}
                {p.activa ? ` · contactar ${fechaCorta(p.proxima_alerta)} (${p.anticipacion_dias} días antes)` : ` · ${p.motivo_suspension ?? "suspendido"}`}
              </p>
            </li>
          );
        })}
      </ul>

      {suspendidos ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={pending} onClick={() => correr(() => reactivarReposicion(primero.id, sumarDias(7)), "Reactivada: contactar en 7 días")} className={boton}>
            Reactivar
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setModo(modo === "anotar" ? null : "anotar")} className={`${boton} ${modo === "anotar" ? "border-marino" : ""}`}>
            Anotar contacto
          </button>
          <Link
            href={`/consumibles/venta?cliente=${primero.cliente_id}&productos=${planes.map((p) => p.producto_id).join(",")}${primero.sucursal_id ? `&sucursal=${primero.sucursal_id}` : ""}`}
            className="inline-flex min-h-10 items-center rounded-xl bg-verde px-3 text-[14px] font-extrabold text-white"
          >
            Registrar venta
          </Link>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await cotizarReposicion(ids);
                if (r && "error" in r && r.error) setMsg({ texto: r.error, error: true });
                else if (r && "clienteId" in r) router.push(`/clientes/${r.clienteId}?interes=${r.oportunidadId}`);
              })
            }
            className={boton}
          >
            Cotizar
          </button>
          <button type="button" onClick={() => setModo(modo === "reprogramar" ? null : "reprogramar")} className={boton}>
            Tiene stock
          </button>
          <button type="button" onClick={() => setModo(modo === "suspender" ? null : "suspender")} className={boton}>
            Suspender
          </button>
          <button type="button" onClick={() => setModo(modo === "ajustar" ? null : "ajustar")} aria-label="Ajustar tiempo" title="Ajustar tiempo y anticipación" className={boton}>
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>
      )}

      {modo === "anotar" && (
        <div className="space-y-2 rounded-xl border border-borde p-2.5">
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1">
            {MEDIOS.map((m) => (
              <button key={m.value} type="button" onClick={() => { setMedio(medio === m.value ? null : m.value); setResultado(null); }} className={chip(medio === m.value)}>
                {m.label}
              </button>
            ))}
          </div>
          {medio && (
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1">
              {RESULTADOS_POR_MEDIO[medio].map((r) => (
                <button key={r} type="button" onClick={() => setResultado(resultado === r ? null : r)} className={chip(resultado === r)}>
                  {RESULTADOS[r]}
                </button>
              ))}
            </div>
          )}
          <input value={nota} onChange={(ev) => setNota(ev.target.value)} placeholder="Qué pasó (ej: le queda para 2 semanas)" className="min-h-10 w-full rounded-xl border border-borde px-3 text-[15px]" />
          <p className="text-xs font-bold uppercase tracking-wide text-piedra">¿Volver a contactar? (si todavía tiene)</p>
          {fechas}
          <button
            type="button"
            disabled={pending || (!medio && !nota.trim() && !volverEl)}
            onClick={() => correr(() => contactoReposicion(ids, { medio, resultado, nota, volverEl: volverEl || null }), "Anotado")}
            className="min-h-10 w-full rounded-xl bg-marino text-[15px] font-bold text-white disabled:opacity-50"
          >
            Guardar
          </button>
          <p className="text-xs text-piedra">Si compra, tocá “Registrar venta”: el tiempo se reinicia desde esa compra.</p>
        </div>
      )}

      {modo === "reprogramar" && (
        <div className="space-y-2 rounded-xl border border-borde p-2.5">
          <p className="text-[15px] font-bold">Todavía tiene stock: ¿cuándo lo volvemos a contactar?</p>
          {fechas}
          <input value={motivo} onChange={(ev) => setMotivo(ev.target.value)} placeholder="Motivo (opcional)" className="min-h-10 w-full rounded-xl border border-borde px-3 text-[15px]" />
          <button
            type="button"
            disabled={pending || !volverEl}
            onClick={() => correr(() => contactoReposicion(ids, { volverEl, motivo: motivo || "todavía tiene stock" }), "Reprogramada")}
            className="min-h-10 w-full rounded-xl bg-marino text-[15px] font-bold text-white disabled:opacity-50"
          >
            Reprogramar
          </button>
        </div>
      )}

      {modo === "suspender" && (
        <div className="space-y-2 rounded-xl border border-borde p-2.5">
          <p className="text-[15px] font-bold">¿Por qué se suspende? Deja de avisar hasta que se reactive o vuelva a comprar.</p>
          <div className="flex flex-wrap gap-1.5">
            {MOTIVOS_SUSPENSION.map((m) => (
              <button key={m} type="button" onClick={() => setMotivo(m)} className={chip(motivo === m)}>
                {m}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={pending || !motivo}
            onClick={() => correr(() => suspenderReposicion(ids, motivo), "Suspendida")}
            className="min-h-10 w-full rounded-xl bg-ambar text-[15px] font-bold text-white disabled:opacity-50"
          >
            Suspender
          </button>
        </div>
      )}

      {modo === "ajustar" && plan && (
        <AjustePlan key={plan.id} planes={planes} elegido={plan} onElegir={setAjuste} usuarios={usuarios} pending={pending} correr={correr} />
      )}

      {msg && <p className={`text-[14px] font-bold ${msg.error ? "text-red-600" : "text-verde"}`}>{msg.texto}</p>}
    </div>
  );
}

function AjustePlan({
  planes,
  elegido,
  onElegir,
  usuarios,
  pending,
  correr,
}: {
  planes: PlanVista[];
  elegido: PlanVista;
  onElegir: (id: string) => void;
  usuarios: { id: string; nombre: string }[];
  pending: boolean;
  correr: (fn: () => Promise<{ error?: string } | { ok: true }>, ok: string) => void;
}) {
  const [frecuencia, setFrecuencia] = useState(elegido.frecuencia_dias ? String(elegido.frecuencia_dias) : "");
  const [anticipacion, setAnticipacion] = useState(String(elegido.anticipacion_dias));
  const [responsable, setResponsable] = useState(elegido.responsable_id ?? "");
  const cls = "min-h-10 w-full rounded-xl border border-borde bg-white px-3 text-[15px]";
  return (
    <div className="space-y-2 rounded-xl border border-borde p-2.5">
      <p className="text-[15px] font-bold">Ajustar el tiempo para este cliente</p>
      {planes.length > 1 && (
        <select value={elegido.id} onChange={(ev) => onElegir(ev.target.value)} className={cls}>
          {planes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.producto?.nombre}
            </option>
          ))}
        </select>
      )}
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[14px] font-bold">
          Repone cada (días)
          <input type="number" min={1} max={730} value={frecuencia} onChange={(ev) => setFrecuencia(ev.target.value)} placeholder="sin definir" className={cls} />
        </label>
        <label className="text-[14px] font-bold">
          Contactar antes (días)
          <input type="number" min={0} max={90} value={anticipacion} onChange={(ev) => setAnticipacion(ev.target.value)} className={cls} />
        </label>
      </div>
      {usuarios.length > 0 && (
        <label className="block text-[14px] font-bold">
          A cargo del seguimiento
          <select value={responsable} onChange={(ev) => setResponsable(ev.target.value)} className={cls}>
            <option value="">Sin responsable</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
        </label>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          correr(
            () =>
              ajustarReposicion(elegido.id, {
                frecuencia: frecuencia ? Number(frecuencia) : null,
                anticipacion: Number(anticipacion || 0),
                responsableId: responsable || null,
              }),
            "Ajustado: la fecha de contacto se recalculó desde la última compra"
          )
        }
        className="min-h-10 w-full rounded-xl bg-marino text-[15px] font-bold text-white disabled:opacity-50"
      >
        Guardar ajuste
      </button>
    </div>
  );
}
