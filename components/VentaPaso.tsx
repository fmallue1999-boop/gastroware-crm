"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { avanzarPedido, facturarPedido, setEntregaEstimada } from "@/lib/actions";
import { VENTA_PASOS } from "@/lib/constants";
import { fechaCorta } from "@/lib/format";
import { pasoDe } from "@/lib/ventas";
import type { PedidoEstado } from "@/lib/types";

const inputCls =
  "w-full rounded-xl border border-borde bg-white px-3 py-2 text-sm outline-none focus:border-tinta";

/**
 * El circuito de la venta en 4 pasos (Vendido → Preparar → Facturar →
 * Entregado) con un solo botón: "Siguiente". Al facturar pide el número
 * de factura (y la serie del equipo, si falta).
 */
export default function VentaPaso({
  oportunidadId,
  estado,
  nroFactura,
  entregaEstimada,
  pedirSerie = false,
  compacto = false,
}: {
  oportunidadId: string;
  estado: PedidoEstado | null;
  nroFactura?: string | null;
  entregaEstimada?: string | null;
  pedirSerie?: boolean;
  compacto?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [factura, setFactura] = useState("");
  const [serie, setSerie] = useState("");
  const [fecha, setFecha] = useState(entregaEstimada ?? "");
  const [facturando, setFacturando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actual = estado ?? "comprometido";
  const idx = pasoDe(estado);
  const enFacturar = actual === "facturar";
  const facturadaAEntregar = actual === "para_entregar";
  const entregada = idx === 3;

  const SIGUIENTE: Record<string, { estado: PedidoEstado; label: string } | null> = {
    comprometido: { estado: "preparar_envio", label: "Preparar" },
    preparar_envio: { estado: "facturar", label: "Facturar" },
    facturar: null, // pide factura
    para_entregar: { estado: "entregado", label: "Entregado" },
    entregado: null,
    finalizado: null,
    pendiente_pago: { estado: "entregado", label: "Entregado" },
  };
  const siguiente = SIGUIENTE[actual] ?? null;

  function mover(nuevo: PedidoEstado) {
    setError(null);
    startTransition(async () => {
      const res = await avanzarPedido(oportunidadId, nuevo);
      if (res && "error" in res && res.error) setError(res.error);
      router.refresh();
    });
  }

  function facturar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await facturarPedido(oportunidadId, factura, serie);
      if (res && "error" in res && res.error) setError(res.error);
      else setFacturando(false);
      router.refresh();
    });
  }

  return (
    <div className={compacto ? "" : "rounded-2xl border border-borde bg-white p-3.5 shadow-sm"}>
      {!compacto && (
        <div className="mb-2 flex flex-wrap gap-1">
          {VENTA_PASOS.map((p, i) => (
            <span
              key={p.key}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                i < idx
                  ? "bg-green-50 text-green-700"
                  : i === idx
                    ? "bg-tinta text-white"
                    : "border border-borde text-piedra"
              }`}
            >
              {i < idx && <Check className="h-3 w-3" />}
              {p.label}
            </span>
          ))}
        </div>
      )}

      {facturadaAEntregar && nroFactura && (
        <p className="text-xs text-piedra">
          Factura {nroFactura} cargada. Falta entregar.
        </p>
      )}
      {actual === "comprometido" && !compacto && (
        <div className="mb-2 flex items-center gap-2">
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="rounded-xl border border-borde bg-white px-3 py-1.5 text-xs outline-none focus:border-tinta"
          />
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await setEntregaEstimada(oportunidadId, fecha);
                router.refresh();
              })
            }
            className="rounded-xl border border-borde px-3 py-1.5 text-xs text-piedra"
          >
            Guardar fecha de entrega
          </button>
        </div>
      )}
      {actual === "comprometido" && compacto && entregaEstimada && (
        <p className="text-xs font-medium text-amber-700">
          Entrega estimada: {fechaCorta(entregaEstimada)}
        </p>
      )}

      {entregada ? (
        <p className="text-xs font-medium text-green-700">✓ Entregado</p>
      ) : enFacturar ? (
        facturando ? (
          <form onSubmit={facturar} className="mt-1 space-y-2">
            <input
              type="text"
              required
              autoFocus
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
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={pending}
                className="flex-1 rounded-xl bg-tinta py-2 text-xs font-medium text-white disabled:opacity-60"
              >
                {pending ? "Guardando…" : "Guardar factura"}
              </button>
              <button
                type="button"
                onClick={() => setFacturando(false)}
                className="rounded-xl border border-borde px-3 py-2 text-xs text-piedra"
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setFacturando(true)}
            className="mt-1 inline-flex w-full items-center justify-center gap-1 rounded-xl bg-tinta py-2 text-xs font-medium text-white"
          >
            Cargar factura <ArrowRight className="h-3 w-3" />
          </button>
        )
      ) : (
        siguiente && (
          <button
            type="button"
            disabled={pending}
            onClick={() => mover(siguiente.estado)}
            className="mt-1 inline-flex w-full items-center justify-center gap-1 rounded-xl bg-tinta py-2 text-xs font-medium text-white disabled:opacity-50"
          >
            {pending ? "Guardando…" : `Pasar a ${siguiente.label}`}
            <ArrowRight className="h-3 w-3" />
          </button>
        )
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
