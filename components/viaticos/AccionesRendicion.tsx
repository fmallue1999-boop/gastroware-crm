"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, RotateCcw, Undo2, Wallet, X } from "lucide-react";
import { aprobarPendientes, decidirGasto, reabrirRendicion, reintegrarRendicion, retirarRendicion } from "@/lib/actions/viaticos";

const boton = "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-4 text-[15px] font-bold disabled:opacity-50";

function useAccion() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function correr(fn: () => Promise<{ ok: true } | { error: string }>, despues?: () => void) {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if ("error" in r) setError(r.error);
      else {
        despues?.();
        router.refresh();
      }
    });
  }
  return { pending, error, correr };
}

/** Aprobar o rechazar (con motivo) un gasto de la rendición. Dirección, mientras está para aprobar. */
export function DecidirGasto({ gastoId, decision }: { gastoId: string; decision: string | null }) {
  const { pending, error, correr } = useAccion();
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState("");

  return (
    <div className="space-y-2">
      {rechazando ? (
        <div className="flex flex-wrap gap-2">
          <input
            autoFocus
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={300}
            placeholder="¿Por qué? (ej: sin comprobante, no corresponde)"
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-borde bg-white px-3 text-[15px] outline-none focus:border-marino"
          />
          <button
            type="button"
            disabled={pending || !motivo.trim()}
            onClick={() => correr(() => decidirGasto(gastoId, "rechazado", motivo), () => setRechazando(false))}
            className={`${boton} bg-red-600 text-white`}
          >
            Rechazar
          </button>
          <button type="button" onClick={() => setRechazando(false)} className="px-2 text-[14px] text-piedra underline">
            Cancelar
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {decision !== "aprobado" && (
            <button type="button" disabled={pending} onClick={() => correr(() => decidirGasto(gastoId, "aprobado"))} className={`${boton} bg-verde text-white`}>
              <Check className="h-4 w-4" /> Aprobar
            </button>
          )}
          {decision !== "rechazado" && (
            <button type="button" disabled={pending} onClick={() => setRechazando(true)} className={`${boton} border border-borde bg-white text-tinta`}>
              <X className="h-4 w-4" /> Rechazar
            </button>
          )}
        </div>
      )}
      {error && <p className="text-[14px] font-bold text-red-600">{error}</p>}
    </div>
  );
}

/**
 * Lo que se hace con la rendición entera: aprobar lo que falta (dirección),
 * reabrir la revisión (dirección, antes del reintegro), marcar el reintegro
 * (administración) y retirarla (quien rindió, antes de que se revise).
 */
export function AccionesRendicion({
  rendicionId,
  estado,
  pendientes,
  hoy,
  puedeAprobar,
  puedeReintegrar,
  puedeRetirar,
}: {
  rendicionId: string;
  estado: string;
  pendientes: number;
  hoy: string;
  puedeAprobar: boolean;
  puedeReintegrar: boolean;
  puedeRetirar: boolean;
}) {
  const router = useRouter();
  const { pending, error, correr } = useAccion();
  const [fecha, setFecha] = useState(hoy);
  const [nota, setNota] = useState("");
  const [retirando, setRetirando] = useState(false);

  const aprobarTodo = puedeAprobar && estado === "enviada" && pendientes > 0;
  const reabrir = puedeAprobar && (estado === "aprobada" || estado === "cerrada");
  const reintegrar = puedeReintegrar && estado === "aprobada";
  if (!aprobarTodo && !reabrir && !reintegrar && !puedeRetirar) return null;

  return (
    <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
      {reintegrar && (
        <div className="space-y-2">
          <p className="text-[15px] font-extrabold">Marcar el reintegro</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
            <input
              type="date"
              value={fecha}
              max={hoy}
              onChange={(e) => setFecha(e.target.value)}
              className="min-h-11 rounded-xl border border-borde bg-white px-3 text-[15px]"
              aria-label="Fecha del reintegro"
            />
            <input
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              maxLength={300}
              placeholder="Cómo se pagó (ej: transferencia)"
              className="min-h-11 min-w-0 rounded-xl border border-borde bg-white px-3 text-[15px] outline-none focus:border-marino"
            />
            <button type="button" disabled={pending || !fecha} onClick={() => correr(() => reintegrarRendicion(rendicionId, fecha, nota))} className={`${boton} bg-verde text-white`}>
              <Wallet className="h-4 w-4" /> Reintegrado
            </button>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {aprobarTodo && (
          <button type="button" disabled={pending} onClick={() => correr(() => aprobarPendientes(rendicionId))} className={`${boton} bg-verde text-white`}>
            <Check className="h-4 w-4" /> Aprobar {pendientes === 1 ? "el que falta" : `los ${pendientes} que faltan`}
          </button>
        )}
        {reabrir && (
          <button type="button" disabled={pending} onClick={() => correr(() => reabrirRendicion(rendicionId))} className={`${boton} border border-borde bg-white text-tinta`}>
            <RotateCcw className="h-4 w-4" /> Reabrir la revisión
          </button>
        )}
        {puedeRetirar &&
          (retirando ? (
            <span className="flex flex-wrap items-center gap-2 text-[15px]">
              Los gastos vuelven a “sin rendir”.
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  correr(
                    () => retirarRendicion(rendicionId),
                    () => router.push("/viaticos")
                  )
                }
                className={`${boton} bg-marino text-white`}
              >
                Retirar
              </button>
              <button type="button" onClick={() => setRetirando(false)} className="px-1 text-piedra underline">
                Cancelar
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setRetirando(true)} className={`${boton} border border-borde bg-white text-tinta`}>
              <Undo2 className="h-4 w-4" /> Retirar la rendición
            </button>
          ))}
      </div>
      {error && <p className="text-[14px] font-bold text-red-600">{error}</p>}
    </div>
  );
}
