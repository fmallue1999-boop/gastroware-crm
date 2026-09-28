"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { asignarOT, cargarFactura, guardarPresupuestoOT, guardarReclamoGarantia, registrarCobro } from "@/lib/actions";
import { dinero, fechaCorta } from "@/lib/format";
import type { OrdenTrabajo } from "@/lib/types";

const cls = "min-h-11 w-full rounded-xl border border-borde bg-white px-3 text-[15px] outline-none focus:border-marino";
const RECLAMO = [
  { value: "a_presentar", label: "A presentar a fábrica" },
  { value: "presentado", label: "Presentado a fábrica" },
  { value: "repuesto_recibido", label: "Repuesto recibido" },
  { value: "cerrado", label: "Cerrado" },
  { value: "rechazado", label: "Rechazado por fábrica" },
];

/**
 * Lo que decide servicio técnico sobre un trabajo (manual 4.3): quién va
 * (técnico propio en Mar del Plata y zona, aliado afuera), el presupuesto
 * fuera de garantía con cobro antes de ir, y el reclamo de garantía a fábrica.
 */
export default function OTServicioPanel({
  ot,
  hoy,
  tecnicos,
  aliados,
  zonaPropia,
  puedeAsignar,
  puedeFacturar,
  facturaPresupuesto,
}: {
  ot: OrdenTrabajo;
  hoy: string;
  tecnicos: { id: string; nombre: string }[];
  aliados: { id: string; nombre: string; zona: string | null }[];
  zonaPropia: boolean | null;
  puedeAsignar: boolean;
  puedeFacturar: boolean;
  facturaPresupuesto: { id: string; numero: string; cobro_estado: string } | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [quien, setQuien] = useState<"propio" | "aliado">(ot.aliado_id ? "aliado" : zonaPropia === false ? "aliado" : "propio");
  const [tecnicoId, setTecnicoId] = useState(ot.tecnico_id ?? "");
  const [aliadoId, setAliadoId] = useState(ot.aliado_id ?? "");
  const [fecha, setFecha] = useState(ot.fecha_programada ?? "");
  const [monto, setMonto] = useState(ot.presupuesto_monto != null ? String(ot.presupuesto_monto) : "");
  const [moneda, setMoneda] = useState(ot.presupuesto_moneda ?? "ARS");
  const [aprobado, setAprobado] = useState(Boolean(ot.presupuesto_aprobado_at));
  const [nroFactura, setNroFactura] = useState("");
  const [reclamo, setReclamo] = useState(ot.garantia_reclamo ?? "a_presentar");
  const [notaReclamo, setNotaReclamo] = useState(ot.garantia_reclamo_nota ?? "");
  const [msg, setMsg] = useState<{ texto: string; error?: boolean } | null>(null);

  function correr(fn: () => Promise<{ error?: string; aviso?: string } | { ok: true }>, ok: string) {
    setMsg(null);
    startTransition(async () => {
      const r = (await fn()) as { error?: string; aviso?: string };
      if (r?.error) setMsg({ texto: r.error, error: true });
      else {
        setMsg({ texto: r?.aviso ?? ok });
        router.refresh();
      }
    });
  }

  const cerrada = ["finalizado_tecnico", "revision_admin", "aprobado_facturar", "facturado", "cerrado", "cancelado"].includes(ot.estado);
  const conPresupuesto = ot.cobertura === "facturable" && ot.tipo !== "instalacion";
  const numeroPresupuesto = monto ? Number(monto.replace(/\./g, "").replace(",", ".")) : null;

  return (
    <section className="space-y-4 rounded-2xl border border-borde bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-piedra">Servicio técnico</p>

      {puedeAsignar && !cerrada && (
        <div className="space-y-2">
          <p className="text-[15px] font-bold">¿Quién va?</p>
          {zonaPropia != null && (
            <p className="text-[14px] text-piedra">
              {zonaPropia ? "Mar del Plata y zona: va el técnico propio." : "Fuera de Mar del Plata y zona: va un técnico aliado."}
            </p>
          )}
          <div className="flex gap-1.5">
            {(["propio", "aliado"] as const).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setQuien(q)}
                className={`min-h-11 flex-1 rounded-xl text-[15px] font-bold ${quien === q ? "bg-marino text-white" : "border border-borde bg-white text-piedra"}`}
              >
                {q === "propio" ? "Técnico propio" : "Técnico aliado"}
              </button>
            ))}
          </div>
          {quien === "propio" ? (
            <select value={tecnicoId} onChange={(e) => setTecnicoId(e.target.value)} className={cls} aria-label="Técnico">
              <option value="">Elegí el técnico…</option>
              {tecnicos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          ) : (
            <select value={aliadoId} onChange={(e) => setAliadoId(e.target.value)} className={cls} aria-label="Aliado">
              <option value="">{aliados.length ? "Elegí el aliado…" : "No hay aliados cargados (Services → Aliados)"}</option>
              {aliados.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                  {a.zona ? ` · ${a.zona}` : ""}
                </option>
              ))}
            </select>
          )}
          <label className="flex items-center gap-2 text-[14px] text-piedra">
            Fecha
            <input type="date" min={hoy} value={fecha} onChange={(e) => setFecha(e.target.value)} className={cls} />
          </label>
          <button
            type="button"
            disabled={pending || (quien === "propio" ? !tecnicoId : !aliadoId)}
            onClick={() =>
              correr(
                () => asignarOT(ot.id, { tecnicoId: quien === "propio" ? tecnicoId : null, aliadoId: quien === "aliado" ? aliadoId : null, fecha: fecha || null }),
                "Asignado"
              )
            }
            className="min-h-11 w-full rounded-xl bg-marino text-[15px] font-extrabold text-white disabled:opacity-50"
          >
            Asignar
          </button>
        </div>
      )}

      {conPresupuesto && !["facturado", "cerrado", "cancelado"].includes(ot.estado) && (
        <div className="space-y-2 border-t border-borde/60 pt-3">
          <p className="text-[15px] font-bold">Presupuesto (fuera de garantía: se cobra antes de ir)</p>
          <div className="flex gap-2">
            <input inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="Monto" className={cls} />
            <select value={moneda} onChange={(e) => setMoneda(e.target.value)} className={`${cls} w-24`} aria-label="Moneda">
              <option value="ARS">$</option>
              <option value="USD">USD</option>
            </select>
          </div>
          <label className="flex min-h-11 items-center gap-2 text-[15px] font-bold">
            <input type="checkbox" checked={aprobado} onChange={(e) => setAprobado(e.target.checked)} className="h-5 w-5" />
            El cliente lo aprobó
          </label>
          <button
            type="button"
            disabled={pending || !numeroPresupuesto}
            onClick={() => correr(() => guardarPresupuestoOT(ot.id, { monto: numeroPresupuesto, moneda, aprobado }), "Presupuesto guardado")}
            className="min-h-11 w-full rounded-xl border border-marino text-[15px] font-bold disabled:opacity-50"
          >
            Guardar presupuesto
          </button>
          {ot.presupuesto_monto != null && (
            <p className={`text-[14px] font-bold ${ot.cobro_ok_at ? "text-verde" : "text-ambar"}`}>
              {ot.cobro_ok_at
                ? `Cobrado el ${fechaCorta(ot.cobro_ok_at)}: el técnico puede ir`
                : ot.presupuesto_aprobado_at
                  ? `Aprobado ${dinero(ot.presupuesto_monto, ot.presupuesto_moneda ?? "ARS")}: falta facturar y cobrar antes de ir`
                  : "Esperando que el cliente apruebe el presupuesto"}
            </p>
          )}
          {puedeFacturar && ot.presupuesto_aprobado_at && !ot.cobro_ok_at && (
            facturaPresupuesto ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => correr(() => registrarCobro(facturaPresupuesto.id), "Cobro registrado: el técnico puede ir")}
                className="min-h-11 w-full rounded-xl bg-verde text-[15px] font-extrabold text-white disabled:opacity-50"
              >
                Cobro acreditado (factura {facturaPresupuesto.numero})
              </button>
            ) : (
              <div className="flex gap-2">
                <input value={nroFactura} onChange={(e) => setNroFactura(e.target.value)} placeholder="N° de factura del presupuesto" className={cls} />
                <button
                  type="button"
                  disabled={pending || !nroFactura.trim()}
                  onClick={() =>
                    correr(
                      () =>
                        cargarFactura({
                          clienteId: ot.cliente_id,
                          tipo: "servicio",
                          numero: nroFactura,
                          monto: ot.presupuesto_monto ?? null,
                          moneda: ot.presupuesto_moneda ?? "ARS",
                          sucursalId: ot.sucursal_id,
                          otId: ot.id,
                        }),
                      "Factura cargada: falta el cobro"
                    )
                  }
                  className="min-h-11 shrink-0 rounded-xl bg-marino px-4 text-[15px] font-bold text-white disabled:opacity-50"
                >
                  Facturar
                </button>
              </div>
            )
          )}
        </div>
      )}

      {ot.cobertura === "garantia" && puedeAsignar && (
        <div className="space-y-2 border-t border-borde/60 pt-3">
          <p className="text-[15px] font-bold">Reclamo de garantía a fábrica</p>
          <select value={reclamo} onChange={(e) => setReclamo(e.target.value as typeof reclamo)} className={cls} aria-label="Estado del reclamo">
            {RECLAMO.map((x) => (
              <option key={x.value} value={x.value}>
                {x.label}
              </option>
            ))}
          </select>
          <input value={notaReclamo} onChange={(e) => setNotaReclamo(e.target.value)} placeholder="N° de reclamo, repuesto, novedades" className={cls} />
          <button
            type="button"
            disabled={pending}
            onClick={() => correr(() => guardarReclamoGarantia(ot.id, reclamo, notaReclamo), "Reclamo actualizado")}
            className="min-h-11 w-full rounded-xl border border-marino text-[15px] font-bold disabled:opacity-50"
          >
            Guardar reclamo
          </button>
        </div>
      )}

      {msg && <p className={`text-[14px] font-bold ${msg.error ? "text-red-600" : "text-verde"}`}>{msg.texto}</p>}
    </section>
  );
}
