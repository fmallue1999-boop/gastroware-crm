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
  const [productoId, setProductoId] = useState("");
  const [fecha, setFecha] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="w-full rounded-xl border border-dashed border-borde py-2 text-sm text-piedra"
      >
        + Cargar equipo que ya tiene (activa recordatorios de consumibles)
      </button>
    );
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await agregarEquipo({
        clienteId,
        productoId,
        fecha: fecha || null,
      });
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      setAbierto(false);
      setProductoId("");
      setFecha("");
    });
  }

  return (
    <form onSubmit={enviar} className="space-y-2 rounded-xl border border-borde bg-white p-3">
      <select
        required
        value={productoId}
        onChange={(e) => setProductoId(e.target.value)}
        className={`${inputCls} w-full`}
      >
        <option value="">¿Qué equipo o consumible tiene?…</option>
        {productos.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nombre}
            {p.es_consumible ? " (recompra)" : ""}
          </option>
        ))}
      </select>
      <label className="block text-sm text-piedra">
        Fecha de compra (aprox., opcional)
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className={`${inputCls} mt-1 w-full`}
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || !productoId}
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
