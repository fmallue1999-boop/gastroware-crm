"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { dinero } from "@/lib/format";
import {
  CUANDO_SALDO,
  MEDIOS_PAGO,
  cambiarAnticipo,
  montoDe,
  problemaPlan,
  r2,
  repartir,
  sumaPagos,
  textoPlazo,
  type GrupoPlan,
  type PlanPago,
  type TipoPlan,
} from "@/lib/plan-pago";

const campo = "min-h-10 rounded-lg border border-borde bg-white px-2 text-[15px] outline-none focus:border-marino";

/**
 * Calculadora del plan de pagos (v1.18): con anticipo + saldo se pone el % del
 * anticipo y cada parte se divide en pagos (% del total, a cuántos días, con
 * qué medio); muestra el monto de cada pago y avisa si algo no suma.
 */
export default function PlanPagoEditor({ tipo, plan, onChange }: { tipo: TipoPlan; plan: PlanPago; onChange: (p: PlanPago) => void }) {
  const anticipo = plan.grupos[0];
  const [pctAnticipo, setPctAnticipo] = useState(String(anticipo?.pct ?? 50));
  const problema = problemaPlan(plan);

  function cambiarGrupo(i: number, g: GrupoPlan) {
    onChange({ ...plan, grupos: plan.grupos.map((x, k) => (k === i ? g : x)) });
  }

  return (
    <div className="space-y-2.5 rounded-xl bg-crema p-2.5">
      <p className="text-xs font-bold uppercase tracking-wide text-piedra">
        Plan de pagos{plan.total != null ? ` · total ${dinero(plan.total, plan.moneda)}` : ""}
      </p>
      {plan.total == null && (
        <label className="flex flex-wrap items-center gap-2 text-[14px] font-bold">
          Total de la venta
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            onChange={(e) => onChange({ ...plan, total: e.target.value === "" ? null : Number(e.target.value) })}
            className={`${campo} w-32`}
          />
          <select value={plan.moneda} onChange={(e) => onChange({ ...plan, moneda: e.target.value })} className={campo}>
            <option value="USD">USD</option>
            <option value="ARS">$</option>
          </select>
        </label>
      )}
      {tipo === "anticipo" && (
        <label className="flex flex-wrap items-center gap-2 text-[15px] font-bold">
          Anticipo
          <span className="flex items-center gap-1">
            <input
              type="number"
              inputMode="decimal"
              min={1}
              max={99}
              step="any"
              value={pctAnticipo}
              onChange={(e) => {
                setPctAnticipo(e.target.value);
                const n = Number(e.target.value);
                if (e.target.value !== "" && n >= 1 && n <= 99) onChange(cambiarAnticipo(plan, n));
              }}
              aria-label="Porcentaje del anticipo"
              className={`${campo} w-20 text-center`}
            />
            %
          </span>
          <span className="text-[14px] font-normal text-piedra">→ saldo {r2(100 - (anticipo?.pct ?? 0))}%</span>
        </label>
      )}

      {plan.grupos.map((g, i) => (
        <Grupo key={i} grupo={g} total={plan.total} moneda={plan.moneda} unico={plan.grupos.length === 1} onChange={(ng) => cambiarGrupo(i, ng)} />
      ))}

      <p className={`text-[13px] font-bold ${problema ? "text-ambar" : "text-verde"}`}>{problema ?? "✓ El plan suma 100%"}</p>
    </div>
  );
}

function Grupo({
  grupo: g,
  total,
  moneda,
  unico,
  onChange,
}: {
  grupo: GrupoPlan;
  total: number | null;
  moneda: string;
  unico: boolean;
  onChange: (g: GrupoPlan) => void;
}) {
  const [repartirAbierto, setRepartirAbierto] = useState(false);
  const [cuotas, setCuotas] = useState({ cantidad: "4", primero: "30", cada: "15", medio: "E-cheq" });
  const suma = sumaPagos(g);
  const falta = r2(g.pct - suma);
  const monto = montoDe(total, g.pct);
  const cambiarPago = (i: number, cambio: Partial<GrupoPlan["pagos"][number]>) =>
    onChange({ ...g, pagos: g.pagos.map((p, k) => (k === i ? { ...p, ...cambio } : p)) });

  return (
    <div className="space-y-1.5 rounded-xl border border-borde bg-white p-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[15px] font-extrabold">
          {g.nombre}
          {!unico ? ` ${r2(g.pct)}%` : ""}
        </p>
        {monto != null && <p className="text-[15px] font-bold">{dinero(monto, moneda)}</p>}
      </div>
      {g.cuando != null && (
        <select value={g.cuando ?? ""} onChange={(e) => onChange({ ...g, cuando: e.target.value })} aria-label="Cuándo se paga el saldo" className={`${campo} w-full`}>
          {CUANDO_SALDO.map((c) => (
            <option key={c} value={c}>
              Se paga {c.toLowerCase()}
            </option>
          ))}
        </select>
      )}

      {g.pagos.map((p, i) => {
        const m = montoDe(total, p.pct);
        return (
          <div key={i} className="flex flex-wrap items-center gap-1.5 border-t border-borde/60 pt-1.5">
            <span className="flex items-center gap-1">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={p.pct || ""}
                onChange={(e) => cambiarPago(i, { pct: e.target.value === "" ? 0 : Number(e.target.value) })}
                aria-label="Porcentaje del total"
                className={`${campo} w-16 text-center`}
              />
              %
            </span>
            <span className="flex items-center gap-1 text-[14px]">
              a
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={p.dias}
                onChange={(e) => cambiarPago(i, { dias: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                aria-label="A cuántos días"
                className={`${campo} w-16 text-center`}
              />
              días
            </span>
            <select value={p.medio} onChange={(e) => cambiarPago(i, { medio: e.target.value })} aria-label="Medio de pago" className={`${campo} min-w-0 flex-1`}>
              {MEDIOS_PAGO.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
            {g.pagos.length > 1 && (
              <button
                type="button"
                onClick={() => onChange({ ...g, pagos: g.pagos.filter((_, k) => k !== i) })}
                aria-label="Quitar este pago"
                className="flex h-10 w-8 items-center justify-center text-piedra"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <span className="w-full text-[13px] text-piedra">
              {textoPlazo(p.dias)}
              {m != null ? ` · ${dinero(m, moneda)}` : ""}
            </span>
          </div>
        );
      })}

      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-borde/60 pt-1.5">
        <button
          type="button"
          onClick={() => {
            const ultimo = g.pagos[g.pagos.length - 1];
            onChange({ ...g, pagos: [...g.pagos, { pct: falta > 0 ? falta : 0, dias: (ultimo?.dias ?? 0) + 15, medio: ultimo?.medio ?? "Transferencia" }] });
          }}
          className="inline-flex min-h-9 items-center gap-1 text-[14px] font-bold text-marino underline"
        >
          <Plus className="h-3.5 w-3.5" /> Agregar pago
        </button>
        <button type="button" onClick={() => setRepartirAbierto(!repartirAbierto)} className="min-h-9 text-[14px] font-bold text-marino underline">
          Repartir en pagos iguales
        </button>
      </div>
      {repartirAbierto && (
        <div className="space-y-1.5 rounded-lg bg-crema/70 p-2 text-[14px]">
          <div className="flex flex-wrap items-center gap-1.5">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={24}
              value={cuotas.cantidad}
              onChange={(e) => setCuotas({ ...cuotas, cantidad: e.target.value })}
              aria-label="Cantidad de pagos"
              className={`${campo} w-14 text-center`}
            />
            pagos con
            <select value={cuotas.medio} onChange={(e) => setCuotas({ ...cuotas, medio: e.target.value })} className={campo}>
              {MEDIOS_PAGO.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            el primero a
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={cuotas.primero}
              onChange={(e) => setCuotas({ ...cuotas, primero: e.target.value })}
              aria-label="Días del primer pago"
              className={`${campo} w-16 text-center`}
            />
            días, cada
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={cuotas.cada}
              onChange={(e) => setCuotas({ ...cuotas, cada: e.target.value })}
              aria-label="Días entre pagos"
              className={`${campo} w-16 text-center`}
            />
            días
          </div>
          <button
            type="button"
            onClick={() => {
              onChange({ ...g, pagos: repartir(g.pct, Number(cuotas.cantidad) || 1, Number(cuotas.primero) || 0, Number(cuotas.cada) || 0, cuotas.medio) });
              setRepartirAbierto(false);
            }}
            className="min-h-10 rounded-lg bg-marino px-4 text-[14px] font-bold text-white"
          >
            Repartir el {r2(g.pct)}%
          </button>
        </div>
      )}
      {Math.abs(falta) > 0.01 && (
        <p className="text-[13px] font-bold text-ambar">
          {falta > 0 ? `Falta repartir ${r2(falta)}%` : `Se pasa por ${r2(-falta)}%`} (los pagos suman {suma}% de {r2(g.pct)}%)
        </p>
      )}
    </div>
  );
}
