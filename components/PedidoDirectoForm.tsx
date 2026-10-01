"use client";

import { useState, useTransition } from "react";
import { Minus, Plus, X } from "lucide-react";
import { crearPedidoDirecto } from "@/lib/actions";
import ClienteSelector from "@/components/ClienteSelector";
import ClienteNuevoRapido from "@/components/ClienteNuevoRapido";
import { cuitProlijo, cuitValido } from "@/lib/datos-cotizar";
import { dinero } from "@/lib/format";
import { CATEGORIAS_PRODUCTO } from "@/lib/constants";
import type { Producto } from "@/lib/types";
import { monedaSugerida, precioEn, textoPrecios } from "@/lib/precios";

const inputCls =
  "w-full rounded-2xl border border-borde bg-white shadow-sm px-4 py-3.5 text-base outline-none focus:border-marino";

/**
 * Venta nueva: primero qué se vendió (con cuántas unidades de cada uno,
 * v1.16), después a quién: un cliente de la base o uno nuevo, siempre con razón
 * social y CUIT para facturar (v1.19; si el elegido no los tiene, se piden acá).
 * Entra al tablero de ventas en "Vendido".
 */

type ClienteVenta = { id: string; nombre: string; razon_social?: string | null; cuit?: string | null };
export default function PedidoDirectoForm({
  productos,
  clienteInicial = null,
}: {
  productos: Producto[];
  clienteInicial?: ClienteVenta | null;
}) {
  const [pending, startTransition] = useTransition();
  const [productoIds, setProductoIds] = useState<string[]>([]);
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const cant = (id: string) => cantidades[id] ?? 1;
  const [entregaEstimada, setEntregaEstimada] = useState("");
  const [cliente, setCliente] = useState<ClienteVenta | null>(clienteInicial);
  const [nuevoCliente, setNuevoCliente] = useState(false);
  const [razonSocial, setRazonSocial] = useState(clienteInicial?.razon_social ?? "");
  const [cuit, setCuit] = useState(clienteInicial?.cuit ?? "");
  // Sin razón social o sin CUIT válido no se puede facturar: se completa acá
  const faltaFiscal = Boolean(cliente) && (!cliente?.razon_social?.trim() || !cuitValido(cliente?.cuit));
  const cuitMal = cuit.replace(/\D/g, "").length >= 11 && !cuitValido(cuit);
  function elegirCliente(c: ClienteVenta | null) {
    setCliente(c);
    setNuevoCliente(false);
    setRazonSocial(c?.razon_social ?? "");
    setCuit(c?.cuit ?? "");
  }
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
      if (!cliente) return setError("Elegí el cliente o cargá uno nuevo");
      if (faltaFiscal && (!razonSocial.trim() || !cuitValido(cuit))) return setError("Completá la razón social y un CUIT válido del cliente");
      const res = await crearPedidoDirecto({
        clienteId: cliente.id,
        fiscal: faltaFiscal ? { razonSocial, cuit } : undefined,
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
    (productoIds.length > 0 || nota.trim()) && Boolean(cliente) && (!faltaFiscal || (razonSocial.trim() && cuitValido(cuit)));

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
        {cliente ? (
          <div className="space-y-2">
            <div className="flex min-h-11 items-center gap-2 rounded-2xl bg-celeste-soft px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold">{cliente.nombre}</span>
                {!faltaFiscal && (
                  <span className="block text-xs text-piedra">
                    {cliente.razon_social} · CUIT {cuitProlijo(cliente.cuit)}
                  </span>
                )}
              </span>
              {!clienteInicial && (
                <button type="button" onClick={() => elegirCliente(null)} className="shrink-0 text-[14px] text-azul underline">
                  Cambiar
                </button>
              )}
            </div>
            {faltaFiscal && (
              <div className="space-y-2 rounded-2xl border border-ambar bg-ambar-soft p-3">
                <p className="text-[14px] font-bold text-ambar">Para facturar faltan los datos del cliente:</p>
                <input value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} placeholder="Razón social (como va en la factura)" className={inputCls} />
                <input
                  inputMode="numeric"
                  value={cuit}
                  onChange={(e) => setCuit(e.target.value)}
                  placeholder="CUIT (ej: 30-71234567-8)"
                  className={`${inputCls} ${cuitMal ? "border-red-400" : ""}`}
                />
                {cuitMal && <p className="text-xs font-bold text-red-600">Ese CUIT no es válido: revisá los números.</p>}
                <p className="text-xs text-piedra">Se guardan en la ficha del cliente.</p>
              </div>
            )}
          </div>
        ) : nuevoCliente ? (
          <ClienteNuevoRapido pedirCuit onElegido={elegirCliente} onCancelar={() => setNuevoCliente(false)} />
        ) : (
          <div className="space-y-2">
            <ClienteSelector
              valor={null}
              onChange={(c) => c && elegirCliente({ id: c.id, nombre: c.nombre_comercial, razon_social: c.razon_social, cuit: c.cuit })}
              placeholder="Buscar cliente: nombre, razón social, teléfono o CUIT"
            />
            <button
              type="button"
              onClick={() => setNuevoCliente(true)}
              className="inline-flex min-h-11 items-center gap-1 text-[15px] font-bold text-marino underline"
            >
              <Plus className="h-4 w-4" /> Cliente nuevo (con CUIT)
            </button>
          </div>
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
