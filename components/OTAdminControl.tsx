"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { transicionarOT, revisarItemOT } from "@/lib/actions";
import { dinero } from "@/lib/format";
import { ESTADOS_ITEM_OT, ESTADOS_OT } from "@/lib/constants";
import type { OrdenTrabajo, OTItem } from "@/lib/types";

/**
 * Panel administrativo de la OT: revisión de ítems, devolución con
 * observación, aprobación para facturar, factura y cierre.
 * Las transiciones disponibles llegan desde la DB (ot_transiciones)
 * filtradas por el rol del usuario.
 */
export default function OTAdminControl({
  ot,
  items,
  esGestor,
  transicionesGestor,
}: {
  ot: OrdenTrabajo;
  items: OTItem[];
  esGestor: boolean;
  transicionesGestor: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [observacion, setObservacion] = useState("");
  const [nroFactura, setNroFactura] = useState("");
  const [devolviendo, setDevolviendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function mover(hacia: string, extra?: { observacion?: string; nroFactura?: string }) {
    setError(null);
    startTransition(async () => {
      const res = await transicionarOT(ot.id, hacia, extra);
      if (res && "error" in res && res.error) setError(res.error);
      else setDevolviendo(false);
      router.refresh();
    });
  }

  function revisarItem(itemId: string, patch: { estado?: string; aprobado?: boolean; precioUnit?: number }) {
    startTransition(async () => {
      await revisarItemOT(itemId, patch);
      router.refresh();
    });
  }

  if (!esGestor) {
    if (["finalizado_tecnico", "revision_admin"].includes(ot.estado)) {
      return (
        <p className="rounded-2xl border border-borde bg-white p-3 text-sm text-piedra shadow-sm">
          Esperando revisión de administración.
        </p>
      );
    }
    return null;
  }

  const enRevision = ["finalizado_tecnico", "revision_admin"].includes(ot.estado);

  return (
    <div className="space-y-3 rounded-2xl border border-borde bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-piedra">
        Administración
      </p>

      {ot.estado === "facturado" && (
        <p className="rounded-xl bg-green-100 p-3 text-sm font-medium text-green-800">
          Facturada — factura {ot.nro_factura}
        </p>
      )}

      {enRevision && items.length > 0 && (
        <div>
          <p className="mb-1.5 text-sm font-semibold">Revisión de repuestos y gastos</p>
          <div className="space-y-1.5">
            {items.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-crema px-2.5 py-1.5 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  {i.descripcion} × {i.cantidad} · {dinero(Number(i.precio_unit))}
                </span>
                <select
                  defaultValue={i.estado}
                  disabled={pending}
                  onChange={(e) => revisarItem(i.id, { estado: e.target.value })}
                  className="rounded-lg border border-borde bg-white px-2 py-1 text-xs"
                >
                  {ESTADOS_ITEM_OT.map((x) => (
                    <option key={x.value} value={x.value}>{x.label}</option>
                  ))}
                </select>
                <label className="flex items-center gap-1 text-xs text-piedra">
                  <input
                    type="checkbox"
                    defaultChecked={i.aprobado_admin}
                    disabled={pending}
                    onChange={(e) => revisarItem(i.id, { aprobado: e.target.checked })}
                  />
                  Aprobado
                </label>
              </div>
            ))}
          </div>
          <p className="mt-1 text-xs text-piedra">
            Solo los ítems &quot;Facturable&quot; y aprobados entran al total.
          </p>
        </div>
      )}

      {transicionesGestor.includes("devuelto_tecnico") && (
        devolviendo ? (
          <div className="space-y-2">
            <textarea
              placeholder="¿Qué falta o qué hay que corregir?"
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              rows={2}
              className="w-full rounded-2xl border border-borde bg-white px-3 py-2 text-sm outline-none focus:border-tinta"
            />
            <div className="flex gap-2">
              <button
                onClick={() => mover("devuelto_tecnico", { observacion })}
                disabled={pending || !observacion.trim()}
                className="flex-1 rounded-xl bg-red-600 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Devolver al técnico
              </button>
              <button onClick={() => setDevolviendo(false)} className="rounded-xl border border-borde px-4 py-2 text-sm">
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setDevolviendo(true)}
            className="w-full rounded-xl border border-red-300 py-2 text-sm text-red-700"
          >
            Devolver al técnico con observación
          </button>
        )
      )}

      {transicionesGestor
        .filter((t) => !["devuelto_tecnico", "facturado"].includes(t))
        .map((t) => (
          <button
            key={t}
            onClick={() => mover(t)}
            disabled={pending}
            className={`w-full rounded-xl py-2.5 text-sm font-medium disabled:opacity-50 ${
              t === "aprobado_facturar"
                ? "bg-tinta text-white"
                : t === "cancelado"
                  ? "border border-borde text-piedra"
                  : "border border-tinta"
            }`}
          >
            {ETIQUETAS[t] ?? ESTADOS_OT.find((e) => e.value === t)?.label ?? t}
          </button>
        ))}

      {transicionesGestor.includes("facturado") && (
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="N° de factura en ZEUS"
            value={nroFactura}
            onChange={(e) => setNroFactura(e.target.value)}
            className="flex-1 rounded-2xl border border-borde bg-white px-3 py-2 text-sm outline-none focus:border-tinta"
          />
          <button
            onClick={() => mover("facturado", { nroFactura })}
            disabled={pending || !nroFactura.trim()}
            className="rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Facturada
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

const ETIQUETAS: Record<string, string> = {
  pendiente_revision: "Pasar a revisión",
  pendiente_asignacion: "Pasar a asignación",
  asignado: "Marcar asignada",
  programado: "Marcar programada",
  aprobado_facturar: "Aprobar → lista para facturar (calcula el total)",
  cerrado: "Cerrar servicio",
  cancelado: "Anular orden",
  revision_admin: "Reabrir revisión",
  en_proceso: "Reabrir para el técnico",
};
