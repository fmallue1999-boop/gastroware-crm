"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { corregirOT } from "@/lib/actions";
import { COBERTURAS_OT, TIPOS_OT } from "@/lib/constants";
import type { OrdenTrabajo } from "@/lib/types";

const PRIORIDADES = [
  { value: "baja", label: "Baja" },
  { value: "normal", label: "Normal" },
  { value: "alta", label: "Alta" },
  { value: "urgente", label: "Urgente" },
];
const campo = "min-h-11 w-full min-w-0 rounded-xl border border-borde bg-white px-3 text-[15px] outline-none focus:border-marino";

/**
 * Corregir la orden (v1.27): dirección y servicio técnico cambian el tipo,
 * la cobertura, la prioridad y el problema en cualquier momento antes de
 * facturar, también lo que cargó el técnico como "service hecho". Lo que
 * hizo el técnico (diagnóstico, trabajo, repuestos, fotos, remito) se
 * corrige en su recuadro. Queda anotado en los movimientos del cliente.
 */
export default function OTCorregir({ ot }: { ot: OrdenTrabajo }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState<string>(ot.tipo);
  const [cobertura, setCobertura] = useState<string>(ot.cobertura);
  const [prioridad, setPrioridad] = useState<string>(ot.prioridad);
  const [problema, setProblema] = useState(ot.problema ?? "");
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function guardar() {
    setError(null);
    setAviso(null);
    startTransition(async () => {
      const r = await corregirOT(ot.id, { tipo, cobertura, prioridad, problema });
      if ("error" in r && r.error) {
        setError(r.error);
        return;
      }
      setAviso("sinCambios" in r && r.sinCambios ? "No había nada para cambiar." : "Orden corregida.");
      setAbierto(false);
      router.refresh();
    });
  }

  if (!abierto)
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-borde bg-white px-4 text-[15px] font-bold text-tinta shadow-sm"
        >
          <Pencil className="h-4 w-4" /> Corregir la orden
        </button>
        {aviso && <span className="text-[14px] font-bold text-verde">✓ {aviso}</span>}
      </div>
    );

  return (
    <section className="space-y-3 rounded-2xl border-2 border-celeste-deep bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-[15px] font-extrabold">Corregir la orden</h2>
        <p className="text-[13px] text-piedra">Queda anotado en los movimientos del cliente. Lo que hizo el técnico se corrige en su recuadro, más abajo.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block space-y-1">
          <span className="text-[14px] font-bold text-tinta/80">Tipo</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={campo}>
            {TIPOS_OT.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-[14px] font-bold text-tinta/80">Cobertura</span>
          <select value={cobertura} onChange={(e) => setCobertura(e.target.value)} className={campo}>
            {COBERTURAS_OT.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-[14px] font-bold text-tinta/80">Prioridad</span>
          <select value={prioridad} onChange={(e) => setPrioridad(e.target.value)} className={campo}>
            {PRIORIDADES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block space-y-1">
        <span className="text-[14px] font-bold text-tinta/80">Problema</span>
        <textarea
          value={problema}
          onChange={(e) => setProblema(e.target.value)}
          rows={2}
          className="w-full min-w-0 rounded-xl border border-borde bg-white px-3 py-2.5 text-[15px] outline-none focus:border-marino"
        />
      </label>
      {error && <p className="text-[14px] font-bold text-red-600">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={guardar}
          disabled={pending}
          className="inline-flex min-h-11 items-center rounded-xl bg-marino px-4 text-[15px] font-extrabold text-white disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
        <button type="button" onClick={() => setAbierto(false)} className="min-h-11 px-3 text-[15px] text-piedra underline">
          Cancelar
        </button>
      </div>
    </section>
  );
}
