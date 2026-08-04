"use client";

import { useTransition } from "react";
import { Check, Package } from "lucide-react";
import { avanzarPedido } from "@/lib/actions";
import { PEDIDO_ESTADOS } from "@/lib/constants";
import { fechaCorta } from "@/lib/format";
import type { PedidoEstado } from "@/lib/types";

/** Seguimiento del pedido de una venta ganada: factura → pago → envío → entrega. */
export default function PedidoControl({
  oportunidadId,
  estado,
  entregadoAt,
}: {
  oportunidadId: string;
  estado: PedidoEstado | null;
  entregadoAt: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const idx = PEDIDO_ESTADOS.findIndex((p) => p.value === (estado ?? "facturar"));
  const siguiente = PEDIDO_ESTADOS[idx + 1] ?? null;

  function mover(nuevo: PedidoEstado) {
    startTransition(async () => {
      await avanzarPedido(oportunidadId, nuevo);
    });
  }

  return (
    <div className="rounded-2xl border border-borde bg-white p-4 shadow-sm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-piedra/80">
        <Package className="mr-1.5 -mt-0.5 inline h-4 w-4" />
        Pedido
      </p>

      <div className="flex flex-wrap gap-1.5">
        {PEDIDO_ESTADOS.map((p, i) => {
          const pasado = i < idx;
          const actual = i === idx;
          return (
            <button
              key={p.value}
              type="button"
              disabled={pending || actual}
              onClick={() => mover(p.value)}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium ${
                actual
                  ? "bg-tinta text-white"
                  : pasado
                    ? "border border-green-300 bg-green-50 text-green-700"
                    : "border border-borde text-piedra"
              }`}
            >
              {pasado && <Check className="h-3 w-3" />}
              {p.label}
            </button>
          );
        })}
      </div>

      {entregadoAt && (
        <p className="mt-2 text-xs text-piedra">
          Entregado el {fechaCorta(entregadoAt)} — el seguimiento a los 7 días
          se agendó solo.
        </p>
      )}

      {siguiente && (
        <button
          type="button"
          onClick={() => mover(siguiente.value)}
          disabled={pending}
          className="mt-3 w-full rounded-2xl bg-tinta py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Guardando…" : `Siguiente paso: ${siguiente.label}`}
        </button>
      )}
    </div>
  );
}
