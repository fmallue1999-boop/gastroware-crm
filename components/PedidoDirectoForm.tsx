"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { crearPedidoDirecto } from "@/lib/actions";
import { dinero } from "@/lib/format";
import { CATEGORIAS_PRODUCTO } from "@/lib/constants";
import type { Producto } from "@/lib/types";

const inputCls =
  "w-full rounded-2xl border border-borde bg-white shadow-sm px-4 py-3.5 text-base outline-none focus:border-tinta";

/**
 * Alta de pedido sin trabas: primero el equipo, después quién lo compró
 * (un solo campo de texto — el cliente se crea o se encuentra solo).
 */
export default function PedidoDirectoForm({ productos }: { productos: Producto[] }) {
  const [pending, startTransition] = useTransition();
  const [productoIds, setProductoIds] = useState<string[]>([]);
  const [comprometido, setComprometido] = useState(true);
  const [entregaEstimada, setEntregaEstimada] = useState("");
  const [clienteTexto, setClienteTexto] = useState("");
  const [monto, setMonto] = useState("");
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);

  function agregarProducto(id: string) {
    if (!id || productoIds.includes(id)) return;
    setProductoIds([...productoIds, id]);
    const p = productos.find((x) => x.id === id);
    if (p?.precio_referencia) {
      const actual = parseFloat(monto.replace(/\./g, "").replace(",", ".")) || 0;
      setMonto(String(actual + Number(p.precio_referencia)));
    }
  }

  const grupos = Object.entries(CATEGORIAS_PRODUCTO)
    .map(([cat, label]) => ({
      label,
      items: productos.filter((p) => p.categoria === cat),
    }))
    .filter((g) => g.items.length > 0);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await crearPedidoDirecto({
        clienteTexto,
        productoIds,
        monto: parseFloat(monto.replace(/\./g, "").replace(",", ".")) || null,
        nota,
        comprometido,
        entregaEstimada: entregaEstimada || undefined,
      });
      if (res && "error" in res) setError(res.error ?? "Error al crear");
    });
  }

  return (
    <form onSubmit={enviar} className="space-y-3">
      {/* 1. El equipo, primero */}
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-piedra">
          1 · ¿Qué se vendió?
        </p>
        {productoIds.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            {productoIds.map((id) => {
              const p = productos.find((x) => x.id === id);
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-tinta px-3 py-1.5 text-sm text-white"
                >
                  {p?.nombre ?? "Producto"}
                  <button
                    type="button"
                    onClick={() => setProductoIds(productoIds.filter((x) => x !== id))}
                    aria-label="Quitar"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              );
            })}
          </div>
        )}
        <select value="" onChange={(e) => agregarProducto(e.target.value)} className={inputCls}>
          <option value="">
            {productoIds.length === 0 ? "Elegir equipo…" : "Agregar otro…"}
          </option>
          {grupos.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.items.map((p) => (
                <option key={p.id} value={p.id} disabled={productoIds.includes(p.id)}>
                  {p.nombre}
                  {p.precio_referencia
                    ? ` — ${dinero(Number(p.precio_referencia), p.moneda)}`
                    : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* 2. Quién lo compró: un solo campo, sin buscadores */}
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-piedra">
          2 · ¿Quién lo compró?
        </p>
        <input
          type="text"
          placeholder="Nombre, empresa o teléfono — como lo tengas"
          value={clienteTexto}
          onChange={(e) => setClienteTexto(e.target.value)}
          className={inputCls}
        />
        <p className="mt-1 text-xs text-piedra">
          Con eso alcanza: si el teléfono ya está en la base lo enganchamos, y
          el resto de los datos se completan después.
        </p>
      </div>

      {/* 3. Compromiso y entrega */}
      <div className="rounded-2xl border border-borde bg-white p-3 shadow-sm">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium">
          <input
            type="checkbox"
            checked={comprometido}
            onChange={(e) => setComprometido(e.target.checked)}
            className="h-4 w-4 accent-tinta"
          />
          Comprometido (entrega a coordinar)
        </label>
        {comprometido && (
          <input
            type="date"
            value={entregaEstimada}
            onChange={(e) => setEntregaEstimada(e.target.value)}
            className={`${inputCls} mt-2`}
          />
        )}
      </div>

      <details>
        <summary className="cursor-pointer text-sm text-sky-700 underline list-none [&::-webkit-details-marker]:hidden">
          Monto y nota (opcional)
        </summary>
        <div className="mt-2 space-y-2">
          <input
            type="text"
            inputMode="decimal"
            placeholder="Monto total"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            className={inputCls}
          />
          <input
            type="text"
            placeholder="Nota: seña, detalle de entrega…"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            className={inputCls}
          />
        </div>
      </details>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending || productoIds.length === 0 || !clienteTexto.trim()}
        className="w-full rounded-2xl bg-tinta py-4 text-base font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Cargando…" : "Cargar pedido"}
      </button>
    </form>
  );
}
