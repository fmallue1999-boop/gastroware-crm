"use client";

import { useState, useTransition } from "react";
import { guardarReglas } from "@/lib/actions";

const REGLAS = [
  {
    clave: "dias_atraso_frena_despacho",
    label: "Días de atraso que frenan un despacho",
    ayuda: "Si el cliente debe una factura vencida hace más de estos días, la venta nueva no pasa a preparar sin tu aprobación.",
    sufijo: "días",
  },
  {
    clave: "descuento_libre_pct",
    label: "Descuento que un vendedor puede dar sin consultar",
    ayuda: "Por encima de esto, la propuesta queda esperando tu aprobación antes de mandarse. 0 = todo descuento se consulta.",
    sufijo: "%",
  },
  {
    clave: "plazo_pago_aliados_dias",
    label: "Plazo de pago a técnicos aliados",
    ayuda: "Informativo, para administración.",
    sufijo: "días",
  },
  {
    clave: "tarifa_hora",
    label: "Tarifa de mano de obra del service",
    ayuda: "Precio por hora; se usa para el total de cada trabajo técnico.",
    sufijo: "$ / hora",
  },
] as const;

/** Reglas que el manual deja "a definir": las define dirección y el CRM las aplica. */
export default function ReglasAdmin({ valores, puedeEditar }: { valores: Record<string, string>; puedeEditar: boolean }) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<Record<string, string>>(valores);
  const [msg, setMsg] = useState<{ texto: string; error?: boolean } | null>(null);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-extrabold">Reglas</h2>
        <p className="text-[14px] text-piedra">Lo que el manual deja “a definir”. El CRM las aplica solo.</p>
      </div>
      <form
        className="space-y-3 rounded-2xl border border-borde bg-white p-4 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          setMsg(null);
          startTransition(async () => {
            const r = await guardarReglas(form);
            setMsg(r && "error" in r && r.error ? { texto: r.error, error: true } : { texto: "Reglas guardadas" });
          });
        }}
      >
        {REGLAS.map((r) => (
          <label key={r.clave} className="block">
            <span className="text-[15px] font-bold">{r.label}</span>
            <span className="block text-xs text-piedra">{r.ayuda}</span>
            <span className="mt-1 flex items-center gap-2">
              <input
                inputMode="decimal"
                disabled={!puedeEditar}
                value={form[r.clave] ?? ""}
                onChange={(e) => setForm({ ...form, [r.clave]: e.target.value })}
                className="min-h-11 w-32 rounded-xl border border-borde bg-white px-3 text-[15px] outline-none focus:border-marino"
              />
              <span className="text-[14px] text-piedra">{r.sufijo}</span>
            </span>
          </label>
        ))}
        {puedeEditar && (
          <button disabled={pending} className="min-h-11 rounded-xl bg-marino px-4 text-[15px] font-extrabold text-white disabled:opacity-50">
            {pending ? "Guardando…" : "Guardar reglas"}
          </button>
        )}
        {msg && <p className={`text-[14px] font-bold ${msg.error ? "text-red-600" : "text-verde"}`}>{msg.texto}</p>}
      </form>
    </section>
  );
}
