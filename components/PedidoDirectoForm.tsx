"use client";

import { useState, useTransition } from "react";
import { Minus, Plus, X } from "lucide-react";
import { crearPedidoDirecto } from "@/lib/actions";
import { dinero } from "@/lib/format";
import { CATEGORIAS_PRODUCTO } from "@/lib/constants";
import type { Producto } from "@/lib/types";
import { monedaSugerida, precioEn, textoPrecios } from "@/lib/precios";

const inputCls =
  "w-full rounded-2xl border border-borde bg-white shadow-sm px-4 py-3.5 text-base outline-none focus:border-marino";

/**
 * Venta nueva sin trabas: primero qué se vendió (con cuántas unidades de cada
 * uno, v1.16), después a quién (un solo campo de texto: el cliente se crea o se
 * encuentra solo). Entra al tablero de ventas en "Vendido".
 */
export default function PedidoDirectoForm({
  productos,
  clienteInicial = null,
}: {
  productos: Producto[];
  clienteInicial?: { id: string; nombre: string } | null;
}) {
  const [pending, startTransition] = useTransition();
  const [productoIds, setProductoIds] = useState<string[]>([]);
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const cant = (id: string) => cantidades[id] ?? 1;
  const [entregaEstimada, setEntregaEstimada] = useState("");
  const [clienteTexto, setClienteTexto] = useState("");
  const [monto, setMonto] = useState("");
  const [moneda, setMoneda] = useState<"ARS" | "USD">("ARS");
  const [montoManual, setMontoManual] = useState(false);

  /** Suma de la lista (precio × unidades) en la moneda elegida, mientras no se escriba el monto a mano. */
  function sumaLista(ids: string[], m: string, cants: Record<string, number> = cantidades) {
    const total = ids.reduce((s, id) => s + (precioEn(productos.find((x) => x.id === id), m) ?? 0) * (cants[id] ?? 1), 0);
    return total ? String(Math.round(total * 100) / 100) : "";
  }

  function cambiarCantidad(id: string, n: number) {
    const nuevas = { ...cantidades, [id]: Math.max(1, Math.min(999, n)) };
    setCantidades(nuevas);
    if (!montoManual) setMonto(sumaLista(productoIds, moneda, nuevas));
  }
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);

  function agregarProducto(id: string) {
    if (!id || productoIds.includes(id)) return;
    const ids = [...productoIds, id];
    setProductoIds(ids);
    // El primero define la moneda (la que tenga precio); después se puede cambiar
    const m = ids.length === 1 ? monedaSugerida(productos.find((x) => x.id === id) ?? {}, moneda) : moneda;
    if (m !== moneda) setMoneda(m);
    if (!montoManual) setMonto(sumaLista(ids, m));
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
        clienteId: clienteInicial?.id,
        clienteTexto: clienteInicial ? undefined : clienteTexto,
        productoIds,
        cantidades: Object.fromEntries(productoIds.map((id) => [id, cant(id)])),
        monto: parseFloat(monto.replace(/\./g, "").replace(",", ".")) || null,
        moneda,
        nota,
        entregaEstimada: entregaEstimada || undefined,
        volverA: clienteInicial ? `/clientes/${clienteInicial.id}` : undefined,
      });
      if (res && "error" in res) setError(res.error ?? "Error al crear");
    });
  }

  const puedeEnviar =
    (productoIds.length > 0 || nota.trim()) &&
    (clienteInicial || clienteTexto.trim());

  return (
    <form onSubmit={enviar} className="space-y-3">
      {/* 1. Qué se vendió */}
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-piedra">
          1 · ¿Qué se vendió?
        </p>
        {productoIds.length > 0 && (
          <div className="mb-1.5 space-y-1.5">
            {productoIds.map((id) => {
              const p = productos.find((x) => x.id === id);
              const precio = precioEn(p, moneda);
              return (
                <div key={id} className="flex items-center gap-2 rounded-2xl border border-borde bg-white p-2 pl-3 shadow-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{p?.nombre ?? "Producto"}</span>
                    {precio != null && (
                      <span className="block text-xs text-piedra">
                        {cant(id)} × {dinero(precio, moneda)}
                        {cant(id) > 1 ? ` = ${dinero(precio * cant(id), moneda)}` : ""}
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => cambiarCantidad(id, cant(id) - 1)}
                      disabled={cant(id) <= 1}
                      aria-label="Una unidad menos"
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-borde disabled:opacity-40"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={cant(id)}
                      onChange={(e) => cambiarCantidad(id, parseInt(e.target.value.replace(/\D/g, ""), 10) || 1)}
                      aria-label={`Unidades de ${p?.nombre ?? "producto"}`}
                      className="h-10 w-12 rounded-xl border border-borde text-center text-base font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => cambiarCantidad(id, cant(id) + 1)}
                      aria-label="Una unidad más"
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-borde"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const ids = productoIds.filter((x) => x !== id);
                        setProductoIds(ids);
                        if (!montoManual) setMonto(sumaLista(ids, moneda));
                      }}
                      aria-label="Quitar"
                      className="flex h-10 w-8 items-center justify-center text-piedra"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </span>
                </div>
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
                  {textoPrecios(p, dinero) ? ` — ${textoPrecios(p, dinero)}` : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <input
          type="text"
          placeholder="…o escribí qué se vendió, si no está en la lista"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          className={`${inputCls} mt-1.5`}
        />
      </div>

      {/* 2. A quién */}
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-piedra">
          2 · ¿Quién lo compró?
        </p>
        {clienteInicial ? (
          <div className="rounded-2xl bg-celeste-soft px-4 py-3 text-sm font-medium">
            {clienteInicial.nombre}
          </div>
        ) : (
          <>
            <input
              type="text"
              placeholder="Nombre, empresa o teléfono, como lo tengas"
              value={clienteTexto}
              onChange={(e) => setClienteTexto(e.target.value)}
              className={inputCls}
            />
            <p className="mt-1 text-xs text-piedra">
              Si el teléfono ya está en la base lo enganchamos solos. El resto
              se completa después.
            </p>
          </>
        )}
      </div>

      <details>
        <summary className="cursor-pointer text-sm text-azul underline list-none [&::-webkit-details-marker]:hidden">
          Monto, moneda y fecha de entrega (opcional)
        </summary>
        <div className="mt-2 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="decimal"
              placeholder="Monto total"
              value={monto}
              onChange={(e) => {
                setMonto(e.target.value);
                setMontoManual(true);
              }}
              className={inputCls}
            />
            <select
              value={moneda}
              onChange={(e) => {
                const m = e.target.value as "ARS" | "USD";
                setMoneda(m);
                if (!montoManual) setMonto(sumaLista(productoIds, m));
              }}
              className={`${inputCls} w-36`}
              aria-label="Moneda"
            >
              <option value="ARS">Pesos</option>
              <option value="USD">Dólares</option>
            </select>
          </div>
          <p className="text-xs text-piedra">El monto sale de la lista en la moneda elegida; lo podés cambiar.</p>
          <label className="block text-xs text-piedra">
            Entrega estimada
            <input
              type="date"
              value={entregaEstimada}
              onChange={(e) => setEntregaEstimada(e.target.value)}
              className={`${inputCls} mt-1`}
            />
          </label>
        </div>
      </details>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending || !puedeEnviar}
        className="w-full rounded-2xl bg-marino py-4 text-base font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Cargando…" : "Cargar venta"}
      </button>
    </form>
  );
}
