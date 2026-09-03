"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { buscarClientes, crearPedidoDirecto } from "@/lib/actions";
import { dinero } from "@/lib/format";
import { CATEGORIAS_PRODUCTO } from "@/lib/constants";
import type { Cliente, Producto } from "@/lib/types";

const inputCls =
  "w-full rounded-2xl border border-borde bg-white shadow-sm px-4 py-3 text-base outline-none focus:border-tinta";

/** Alta rápida de pedido: cliente + productos + monto, directo al tablero. */
export default function PedidoDirectoForm({ productos }: { productos: Producto[] }) {
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<Cliente[]>([]);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [productoIds, setProductoIds] = useState<string[]>([]);
  const [monto, setMonto] = useState("");
  const [nota, setNota] = useState("");
  const [comprometido, setComprometido] = useState(false);
  const [entregaEstimada, setEntregaEstimada] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function buscar(valor: string) {
    setQ(valor);
    if (valor.trim().length < 2) {
      setResultados([]);
      return;
    }
    setResultados(await buscarClientes(valor));
  }

  function agregarProducto(id: string) {
    if (!id || productoIds.includes(id)) return;
    setProductoIds([...productoIds, id]);
    // Si el producto tiene precio de referencia, sumarlo al monto sugerido
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
    if (!cliente) return;
    setError(null);
    startTransition(async () => {
      const res = await crearPedidoDirecto({
        clienteId: cliente.id,
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
      {!cliente ? (
        <div>
          <input
            type="search"
            autoFocus
            placeholder="Buscar cliente por nombre, teléfono o CUIT…"
            value={q}
            onChange={(e) => buscar(e.target.value)}
            className={inputCls}
          />
          <div className="mt-2 space-y-1.5">
            {resultados.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setCliente(c);
                  setResultados([]);
                }}
                className="block w-full rounded-2xl border border-borde bg-white p-3 text-left text-sm shadow-sm"
              >
                <span className="font-medium">{c.nombre_comercial}</span>
                <span className="text-piedra">
                  {" "}
                  · {c.rubro}
                  {c.ciudad ? ` · ${c.ciudad}` : ""}
                </span>
              </button>
            ))}
            {q.trim().length >= 2 && resultados.length === 0 && (
              <p className="rounded-2xl border border-dashed border-borde p-3 text-sm text-piedra">
                No aparece.{" "}
                <Link href="/clientes/nuevo" className="text-sky-700 underline">
                  Cargalo como cliente
                </Link>{" "}
                y volvé a abrir el pedido.
              </p>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between rounded-2xl bg-celeste-soft px-4 py-3">
            <p className="text-sm font-medium">{cliente.nombre_comercial}</p>
            <button
              type="button"
              onClick={() => setCliente(null)}
              className="text-xs text-sky-800 underline"
            >
              Cambiar
            </button>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-piedra">
              ¿Qué pidió?
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
                        onClick={() =>
                          setProductoIds(productoIds.filter((x) => x !== id))
                        }
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
                {productoIds.length === 0
                  ? "Agregar producto…"
                  : "Agregar otro producto…"}
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

          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-piedra">
              Monto total (editable)
            </p>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className={inputCls}
            />
          </div>

          <div className="rounded-2xl border border-borde bg-white p-3 shadow-sm">
            <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium">
              <input
                type="checkbox"
                checked={comprometido}
                onChange={(e) => setComprometido(e.target.checked)}
                className="h-4 w-4 accent-tinta"
              />
              Pre-venta / comprometido (ej: vendido en la feria, entrega a
              coordinar)
            </label>
            {comprometido && (
              <div className="mt-2">
                <p className="mb-1 text-xs text-piedra">
                  Entrega estimada (opcional)
                </p>
                <input
                  type="date"
                  value={entregaEstimada}
                  onChange={(e) => setEntregaEstimada(e.target.value)}
                  className={inputCls}
                />
              </div>
            )}
          </div>

          <textarea
            placeholder="Nota (opcional): cómo lo pidió, detalle de entrega…"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={2}
            className={inputCls}
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={pending || productoIds.length === 0}
            className="w-full rounded-2xl bg-tinta py-3.5 font-medium text-white disabled:opacity-60"
          >
            {pending ? "Cargando…" : "Cargar pedido"}
          </button>
          <p className="text-center text-xs text-piedra">
            Entra al tablero en &quot;Emitir factura&quot;. Si es un equipo, se
            crea en la ficha del cliente con su garantía (la serie se carga al
            facturar).
          </p>
        </>
      )}
    </form>
  );
}
