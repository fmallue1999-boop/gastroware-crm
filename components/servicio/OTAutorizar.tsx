"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, HandCoins, RotateCcw } from "lucide-react";
import { darDeBajaOT, noCobrarOT, volverACobrarOT } from "@/lib/actions";
import { MOTIVOS_BAJA, MOTIVOS_SIN_CARGO } from "@/lib/servicio-cobro";
import type { OrdenTrabajo } from "@/lib/types";

const chip = (activo: boolean) =>
  `min-h-10 rounded-xl px-3 text-left text-[14px] font-semibold ${activo ? "bg-marino text-white" : "border border-borde bg-white text-tinta/80"}`;
const boton = "inline-flex min-h-11 items-center gap-1.5 rounded-xl border bg-white px-4 text-[15px] font-bold shadow-sm";

/**
 * Lo que autoriza dirección en una orden (v1.28): no cobrarla (queda en $0
 * y, si el trabajo está terminado, se cierra sin facturar) o darla de baja.
 * Siempre con el motivo, que queda en el historial y en los movimientos del
 * cliente.
 */
export default function OTAutorizar({ ot, terminada }: { ot: OrdenTrabajo; terminada: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [modo, setModo] = useState<null | "no_cobrar" | "baja">(null);
  const [motivo, setMotivo] = useState("");
  const [detalle, setDetalle] = useState("");
  const [cerrar, setCerrar] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function abrir(m: "no_cobrar" | "baja") {
    setModo(m);
    setMotivo("");
    setDetalle("");
    setError(null);
  }

  function confirmar() {
    setError(null);
    startTransition(async () => {
      const r = modo === "baja" ? await darDeBajaOT(ot.id, motivo, detalle || null) : await noCobrarOT(ot.id, motivo, detalle || null, terminada && cerrar);
      if ("error" in r && r.error) {
        setError(r.error);
        return;
      }
      setModo(null);
      router.refresh();
    });
  }

  function volverACobrar() {
    setError(null);
    startTransition(async () => {
      const r = await volverACobrarOT(ot.id);
      if ("error" in r && r.error) setError(r.error);
      else router.refresh();
    });
  }

  if (!modo)
    return (
      <>
        {ot.sin_cargo ? (
          <button type="button" onClick={volverACobrar} disabled={pending} className={`${boton} border-borde text-tinta disabled:opacity-50`}>
            <RotateCcw className="h-4 w-4" /> Volver a cobrarla
          </button>
        ) : (
          <button type="button" onClick={() => abrir("no_cobrar")} className={`${boton} border-borde text-tinta`}>
            <HandCoins className="h-4 w-4" /> No cobrar
          </button>
        )}
        <button type="button" onClick={() => abrir("baja")} className={`${boton} border-red-200 text-red-700`}>
          <Ban className="h-4 w-4" /> Dar de baja
        </button>
        {error && <p className="basis-full text-[14px] font-bold text-red-600">{error}</p>}
      </>
    );

  const motivos = modo === "baja" ? MOTIVOS_BAJA : MOTIVOS_SIN_CARGO;
  const falta = !motivo || (motivo === "Otro" && !detalle.trim());

  return (
    <section className={`basis-full space-y-3 rounded-2xl border-2 bg-white p-4 shadow-sm ${modo === "baja" ? "border-red-300" : "border-ambar/60"}`}>
      <div>
        <h2 className="text-[15px] font-extrabold">{modo === "baja" ? "Dar de baja la orden" : "No cobrar esta orden"}</h2>
        <p className="text-[13px] text-piedra">
          {modo === "baja"
            ? "La orden queda anulada (se puede reabrir). Al técnico asignado le llega el aviso."
            : "La orden queda en $0, autorizada por vos. Se puede volver a cobrar mientras no esté cerrada."}{" "}
          El motivo queda en el historial y en los movimientos del cliente.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {motivos.map((m) => (
          <button key={m} type="button" onClick={() => setMotivo(m)} className={chip(motivo === m)}>
            {m}
          </button>
        ))}
      </div>
      <input
        value={detalle}
        onChange={(e) => setDetalle(e.target.value)}
        maxLength={250}
        placeholder={motivo === "Otro" ? "Contá el motivo" : "Detalle (opcional)"}
        className="min-h-11 w-full min-w-0 rounded-xl border border-borde bg-white px-3 text-[15px] outline-none focus:border-marino"
      />
      {modo === "no_cobrar" && terminada && (
        <label className="flex items-center gap-2 text-[15px]">
          <input type="checkbox" checked={cerrar} onChange={(e) => setCerrar(e.target.checked)} className="h-5 w-5 accent-marino" />
          Cerrar la orden ahora (sin facturar)
        </label>
      )}
      {error && <p className="text-[14px] font-bold text-red-600">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={confirmar}
          disabled={pending || falta}
          className={`inline-flex min-h-11 items-center rounded-xl px-4 text-[15px] font-extrabold text-white disabled:opacity-50 ${modo === "baja" ? "bg-red-600" : "bg-marino"}`}
        >
          {pending ? "Guardando…" : modo === "baja" ? "Dar de baja" : terminada && cerrar ? "No cobrar y cerrar" : "Autorizar no cobrarla"}
        </button>
        <button type="button" onClick={() => setModo(null)} className="min-h-11 px-3 text-[15px] text-piedra underline">
          Cancelar
        </button>
      </div>
    </section>
  );
}
