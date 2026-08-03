"use client";

import { useState, useTransition } from "react";
import { agregarEquipo } from "@/lib/actions";
import type { Producto } from "@/lib/types";

const inputCls =
  "rounded-xl border border-borde bg-white px-3 py-2.5 text-sm outline-none focus:border-tinta";

export default function EquipoForm({
  clienteId,
  productos,
}: {
  clienteId: string;
  productos: Producto[];
}) {
  const [pending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [esAjeno, setEsAjeno] = useState(false);
  const [productoId, setProductoId] = useState("");
  const [marcaModelo, setMarcaModelo] = useState("");
  const [numeroSerie, setNumeroSerie] = useState("");
  const [fecha, setFecha] = useState("");
  const [garantiaHasta, setGarantiaHasta] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="w-full rounded-xl border border-dashed border-borde py-2 text-sm text-piedra"
      >
        + Cargar equipo (propio o de otra marca, con n° de serie)
      </button>
    );
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await agregarEquipo({
        clienteId,
        productoId: esAjeno ? null : productoId,
        marcaModelo: esAjeno ? marcaModelo : null,
        numeroSerie,
        fecha: fecha || null,
        garantiaHasta: garantiaHasta || null,
      });
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      setAbierto(false);
      setProductoId("");
      setMarcaModelo("");
      setNumeroSerie("");
      setFecha("");
      setGarantiaHasta("");
    });
  }

  return (
    <form onSubmit={enviar} className="space-y-2 rounded-xl border border-borde bg-white p-3">
      <label className="flex items-center gap-2 text-sm text-tinta/80">
        <input
          type="checkbox"
          checked={esAjeno}
          onChange={(e) => setEsAjeno(e.target.checked)}
        />
        Es un equipo de otra marca (no lo vendimos nosotros)
      </label>

      {esAjeno ? (
        <input
          type="text"
          required
          placeholder="Marca y modelo (ej: Sammic CA-301)"
          value={marcaModelo}
          onChange={(e) => setMarcaModelo(e.target.value)}
          className={`${inputCls} w-full`}
        />
      ) : (
        <select
          required
          value={productoId}
          onChange={(e) => setProductoId(e.target.value)}
          className={`${inputCls} w-full`}
        >
          <option value="">¿Qué equipo o consumible?…</option>
          {productos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
              {p.es_consumible ? " (recompra)" : ""}
            </option>
          ))}
        </select>
      )}

      <input
        type="text"
        placeholder="Número de serie (opcional)"
        value={numeroSerie}
        onChange={(e) => setNumeroSerie(e.target.value)}
        className={`${inputCls} w-full`}
      />

      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs text-piedra">
          Fecha de compra (aprox.)
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className={`${inputCls} mt-1 w-full`}
          />
        </label>
        <label className="block text-xs text-piedra">
          Garantía hasta (si no, se calcula sola)
          <input
            type="date"
            value={garantiaHasta}
            onChange={(e) => setGarantiaHasta(e.target.value)}
            className={`${inputCls} mt-1 w-full`}
          />
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || (!esAjeno && !productoId)}
          className="flex-1 rounded-xl bg-tinta py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Cargar"}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="rounded-xl border border-borde px-4 py-2 text-sm"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
