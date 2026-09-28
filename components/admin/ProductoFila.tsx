"use client";

import { useState, useTransition } from "react";
import { guardarProducto } from "@/lib/actions";
import type { Producto } from "@/lib/types";

export default function ProductoFila({ producto }: { producto: Producto }) {
  const [pending, startTransition] = useTransition();
  const [precio, setPrecio] = useState(
    producto.precio_referencia != null ? String(producto.precio_referencia) : ""
  );
  const [garantia, setGarantia] = useState(
    producto.garantia_meses != null ? String(producto.garantia_meses) : ""
  );
  const [reposicion, setReposicion] = useState(
    producto.frecuencia_recompra_dias != null ? String(producto.frecuencia_recompra_dias) : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  const cambiado =
    precio !== (producto.precio_referencia != null ? String(producto.precio_referencia) : "") ||
    garantia !== (producto.garantia_meses != null ? String(producto.garantia_meses) : "") ||
    reposicion !== (producto.frecuencia_recompra_dias != null ? String(producto.frecuencia_recompra_dias) : "");

  const guardar = (patch?: { activo?: boolean }) => {
    setError(null);
    setGuardado(false);
    startTransition(async () => {
      const res = await guardarProducto(producto.id, {
        precio_referencia: precio === "" ? null : Number(precio),
        garantia_meses: garantia === "" ? null : Number(garantia),
        ...(producto.es_consumible ? { frecuencia_recompra_dias: reposicion === "" ? null : Number(reposicion) } : {}),
        ...patch,
      });
      if (res && "error" in res && res.error) setError(res.error);
      else setGuardado(true);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-borde/60 px-4 py-2.5 last:border-0">
      <div className="min-w-44 flex-1">
        <p className={`text-sm font-medium ${producto.activo ? "" : "text-piedra line-through"}`}>
          {producto.nombre}
        </p>
        <p className="text-xs text-piedra">
          {producto.marca ?? ""}
          {producto.es_consumible ? " · consumible" : ""}
        </p>
      </div>
      <label className="flex items-center gap-1 text-xs text-piedra">
        {producto.moneda}
        <input
          type="number"
          min={0}
          value={precio}
          placeholder="precio"
          onChange={(e) => setPrecio(e.target.value)}
          className="w-28 rounded-xl border border-borde px-2.5 py-1.5 text-sm text-tinta"
        />
      </label>
      {producto.es_consumible && (
        <label className="flex items-center gap-1 text-xs text-piedra" title="Se reinicia con cada compra y se puede ajustar por cliente">
          repone cada
          <input
            type="number"
            min={1}
            max={730}
            value={reposicion}
            placeholder="—"
            onChange={(e) => setReposicion(e.target.value)}
            className="w-16 rounded-xl border border-borde px-2.5 py-1.5 text-sm text-tinta"
          />
          días
        </label>
      )}
      <label className="flex items-center gap-1 text-xs text-piedra">
        garantía
        <input
          type="number"
          min={0}
          value={garantia}
          placeholder="—"
          onChange={(e) => setGarantia(e.target.value)}
          className="w-16 rounded-xl border border-borde px-2.5 py-1.5 text-sm text-tinta"
        />
        meses
      </label>
      {cambiado && (
        <button
          type="button"
          disabled={pending}
          onClick={() => guardar()}
          className="rounded-xl bg-marino px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
        >
          Guardar
        </button>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => guardar({ activo: !producto.activo })}
        className="rounded-xl border border-borde px-3 py-1.5 text-xs text-piedra hover:bg-crema"
      >
        {producto.activo ? "Ocultar" : "Activar"}
      </button>
      {guardado && !cambiado && (
        <span className="text-xs text-verde">Guardado</span>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
