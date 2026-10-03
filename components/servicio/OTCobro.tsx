"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Sparkles } from "lucide-react";
import { guardarCobroOT, iaConceptoOT } from "@/lib/actions";
import { dinero } from "@/lib/format";
import { COBRO_COMO, conceptoSugerido, cuentaOT, nombreCobro } from "@/lib/servicio-cobro";
import type { OrdenTrabajo } from "@/lib/types";

type ItemCobro = { cantidad: number | string; precio_unit: number | string; estado: string; aprobado_admin: boolean };
const campo = "min-h-11 w-full min-w-0 rounded-xl border border-borde bg-white px-3 text-[15px] outline-none focus:border-marino";
const horasTexto = (h: number) => (Number.isInteger(h) ? String(h) : h.toFixed(2).replace(/0$/, "").replace(".", ","));

/**
 * Cobro y factura de la orden (v1.27): las horas que se cobran (también en
 * garantía, por ejemplo la movilidad), cómo se cobran y el concepto con que
 * se factura: "ST 123 - Cambio de luz por garantía (Movilidad)". La factura
 * no dice horas: las horas solo dan el importe.
 */
export default function OTCobro({
  ot,
  minutos,
  tarifa,
  items,
  editable,
  iaOn,
}: {
  ot: OrdenTrabajo;
  minutos: number;
  tarifa: number;
  items: ItemCobro[];
  editable: boolean;
  iaOn: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [horas, setHoras] = useState(ot.horas_cobrar != null ? horasTexto(Number(ot.horas_cobrar)) : "");
  const [cobroComo, setCobroComo] = useState(ot.cobro_como ?? "");
  const [concepto, setConcepto] = useState(ot.concepto_factura ?? "");
  const [pensando, setPensando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // La cuenta con lo que está escrito (sin guardar todavía)
  const horasNum = horas.trim() === "" ? null : Number(horas.replace(",", "."));
  const borrador = { ...ot, horas_cobrar: horasNum !== null && Number.isFinite(horasNum) ? horasNum : null, cobro_como: cobroComo || null };
  const cuenta = cuentaOT(borrador, minutos, tarifa, items);
  const sugerido = conceptoSugerido({ numero: ot.numero, trabajo: ot.trabajo_realizado, tipo: ot.tipo, cobertura: ot.cobertura, cobroComo: borrador.cobro_como, horas: cuenta.horas });
  const conceptoVisible = concepto.trim() || sugerido;
  const automatico = cuenta.horasTrabajadas > 0 ? `${horasTexto(cuenta.horasTrabajadas)} h trabajadas` : "sin tiempo cargado";
  const totalVisible = ot.total != null && !editable ? Number(ot.total) : cuenta.total;

  function guardar() {
    setError(null);
    setAviso(null);
    if (horasNum !== null && (!Number.isFinite(horasNum) || horasNum < 0)) {
      setError("Poné las horas con número (ej: 1,5)");
      return;
    }
    startTransition(async () => {
      const r = await guardarCobroOT(ot.id, { horas: horasNum, cobroComo: cobroComo || null, concepto: concepto.trim() || null });
      if ("error" in r && r.error) setError(r.error);
      else {
        setAviso("Guardado");
        router.refresh();
      }
    });
  }

  async function sugerirIA() {
    setError(null);
    setPensando(true);
    const r = await iaConceptoOT(ot.id, cobroComo || null, cuenta.horas);
    setPensando(false);
    if ("error" in r && r.error) setError(r.error);
    else if ("concepto" in r) setConcepto(r.concepto ?? "");
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(conceptoVisible);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      setError("No se pudo copiar: seleccionalo y copialo a mano");
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border border-borde bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold">Cobro y factura</h2>

      {editable ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-[14px] font-bold text-tinta/80">Horas a cobrar</span>
            <input value={horas} onChange={(e) => setHoras(e.target.value)} inputMode="decimal" placeholder={horasTexto(cuenta.horasTrabajadas && ot.cobertura === "facturable" ? cuenta.horasTrabajadas : 0)} className={campo} />
            <span className="block text-[12px] text-piedra">
              Vacío = automático ({ot.cobertura === "facturable" ? automatico : `${ot.cobertura === "garantia" ? "garantía" : "contrato"}: no se cobra`}). En garantía podés cobrar, por ejemplo, la movilidad.
            </span>
          </label>
          <label className="block space-y-1">
            <span className="text-[14px] font-bold text-tinta/80">Se cobra como</span>
            <select value={cobroComo} onChange={(e) => setCobroComo(e.target.value)} className={campo}>
              <option value="">—</option>
              {COBRO_COMO.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      <div className="space-y-1 text-sm">
        <p className="flex justify-between gap-2">
          <span className="text-piedra">
            {cuenta.horas > 0 ? `${nombreCobro(borrador.cobro_como)} (${horasTexto(cuenta.horas)} h × ${dinero(tarifa)})` : `Horas: no se cobran${ot.cobertura !== "facturable" ? ` (${ot.cobertura === "garantia" ? "garantía" : "contrato"})` : ""}`}
          </span>
          <span>{dinero(cuenta.manoObra)}</span>
        </p>
        <p className="flex justify-between gap-2">
          <span className="text-piedra">Repuestos y gastos facturables aprobados</span>
          <span>{dinero(cuenta.itemsTotal)}</span>
        </p>
        {cuenta.bonificado > 0 && (
          <p className="flex justify-between gap-2 font-semibold text-ambar">
            <span>Sin cargo (autorizado por dirección)</span>
            <span>−{dinero(cuenta.bonificado)}</span>
          </p>
        )}
        <p className="flex justify-between gap-2 border-t border-borde pt-1 font-semibold">
          <span>Total {ot.total != null && !editable ? "" : ot.estado === "aprobado_facturar" ? "" : "estimado"}</span>
          <span>{dinero(totalVisible)}</span>
        </p>
        {tarifa === 0 && cuenta.horas > 0 && <p className="text-xs text-ambar">La tarifa por hora está en $0 — configurala en Administración → Reglas.</p>}
      </div>

      {(totalVisible > 0 || editable) && (
        <div className="space-y-1.5 rounded-xl bg-crema p-3">
          <p className="text-[14px] font-bold text-tinta/80">Concepto para la factura</p>
          {editable ? (
            <>
              <input value={concepto} onChange={(e) => setConcepto(e.target.value)} maxLength={200} placeholder={sugerido} className={campo} />
              <p className="text-[12px] text-piedra">Vacío = el sugerido. La factura no dice horas: dice qué se hizo.</p>
            </>
          ) : (
            <p className="text-[15px] font-bold">{conceptoVisible}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copiar} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-borde bg-white px-3 text-[14px] font-bold">
              <Copy className="h-4 w-4" /> {copiado ? "Copiado" : "Copiar concepto"}
            </button>
            {editable && iaOn && (
              <button
                type="button"
                onClick={sugerirIA}
                disabled={pensando}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-violeta/40 bg-violeta-soft px-3 text-[14px] font-bold text-violeta disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" /> {pensando ? "Pensando…" : "Sugerir con IA"}
              </button>
            )}
          </div>
        </div>
      )}

      {editable && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={guardar}
            disabled={pending}
            className="inline-flex min-h-11 items-center rounded-xl bg-marino px-4 text-[15px] font-extrabold text-white disabled:opacity-50"
          >
            {pending ? "Guardando…" : "Guardar cobro y concepto"}
          </button>
          {aviso && <span className="text-[14px] font-bold text-verde">✓ {aviso}</span>}
        </div>
      )}
      {error && <p className="text-[14px] font-bold text-red-600">{error}</p>}
    </section>
  );
}
