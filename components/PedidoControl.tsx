"use client";

import { useState, useTransition } from "react";
import { Check, Package } from "lucide-react";
import { avanzarPedido, facturarPedido, setEntregaEstimada } from "@/lib/actions";
import { PEDIDO_ESTADOS } from "@/lib/constants";
import { fechaCorta } from "@/lib/format";
import type { PedidoEstado } from "@/lib/types";

const inputCls =
  "w-full rounded-xl border border-borde bg-white px-3 py-2 text-sm outline-none focus:border-tinta";

/** Seguimiento del pedido de una venta ganada: factura → pago → envío → entrega. */
export default function PedidoControl({
  oportunidadId,
  estado,
  entregadoAt,
  entregaEstimada,
  nroFactura,
  pedirSerie = false,
}: {
  oportunidadId: string;
  estado: PedidoEstado | null;
  entregadoAt: string | null;
  entregaEstimada?: string | null;
  nroFactura?: string | null;
  /** true si la venta incluye un equipo que todavía no tiene número de serie */
  pedirSerie?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [factura, setFactura] = useState("");
  const [serie, setSerie] = useState("");
  const [fechaEntrega, setFechaEntrega] = useState(entregaEstimada ?? "");
  const [error, setError] = useState<string | null>(null);
  const idx = PEDIDO_ESTADOS.findIndex((p) => p.value === (estado ?? "facturar"));
  const enFacturar = (estado ?? "facturar") === "facturar";
  const enComprometido = estado === "comprometido";
  const siguiente = PEDIDO_ESTADOS[idx + 1] ?? null;

  function mover(nuevo: PedidoEstado) {
    setError(null);
    startTransition(async () => {
      const res = await avanzarPedido(oportunidadId, nuevo);
      if (res && "error" in res && res.error) setError(res.error);
    });
  }

  function facturar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await facturarPedido(oportunidadId, factura, serie);
      if (res && "error" in res && res.error) setError(res.error);
    });
  }

  return (
    <div className="rounded-2xl border border-borde bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-piedra/80">
          <Package className="mr-1.5 -mt-0.5 inline h-4 w-4" />
          Pedido
        </p>
        {nroFactura && (
          <span className="text-xs text-piedra">Factura {nroFactura}</span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PEDIDO_ESTADOS.map((p, i) => {
          const pasado = i < idx;
          const actual = i === idx;
          return (
            <button
              key={p.value}
              type="button"
              disabled={pending || actual || enFacturar}
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

      {enComprometido && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-semibold text-amber-900">
            Pedido comprometido (pre-venta): entrega a coordinar
          </p>
          <div className="mt-1.5 flex gap-2">
            <input
              type="date"
              value={fechaEntrega}
              onChange={(e) => setFechaEntrega(e.target.value)}
              className="flex-1 rounded-xl border border-borde bg-white px-3 py-1.5 text-sm outline-none focus:border-tinta"
            />
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await setEntregaEstimada(oportunidadId, fechaEntrega);
                  if (res && "error" in res && res.error) setError(res.error);
                })
              }
              className="rounded-xl bg-tinta px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
            >
              Guardar fecha
            </button>
          </div>
        </div>
      )}

      {enFacturar ? (
        <form onSubmit={facturar} className="mt-3 space-y-2">
          <input
            type="text"
            required
            placeholder="N° de factura (ej: A 0001-00001234)"
            value={factura}
            onChange={(e) => setFactura(e.target.value)}
            className={inputCls}
          />
          {pedirSerie && (
            <input
              type="text"
              required
              placeholder="N° de serie del equipo vendido"
              value={serie}
              onChange={(e) => setSerie(e.target.value)}
              className={inputCls}
            />
          )}
          {pedirSerie && (
            <p className="text-xs text-piedra">
              Con la serie, el equipo queda anexado a la ficha del cliente con
              su garantía corriendo.
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-2xl bg-tinta py-2.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {pending
              ? "Guardando…"
              : "Guardar factura y pasar a Pendiente de pago"}
          </button>
        </form>
      ) : (
        siguiente && (
          <button
            type="button"
            onClick={() => mover(siguiente.value)}
            disabled={pending}
            className="mt-3 w-full rounded-2xl bg-tinta py-2.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {pending ? "Guardando…" : `Siguiente paso: ${siguiente.label}`}
          </button>
        )
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
