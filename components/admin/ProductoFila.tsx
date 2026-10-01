"use client";

import { useState, useTransition } from "react";
import { guardarProducto } from "@/lib/actions";
import { precioEn } from "@/lib/precios";
import type { Producto } from "@/lib/types";

const txt = (n: number | null | undefined) => (n != null ? String(n) : "");
const num = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));

/**
 * Un producto del catálogo: precio de lista en pesos y en dólares (los dos
 * opcionales), la moneda principal (con la que arranca al cotizar), garantía
 * y, en los consumibles, cada cuánto repone.
 */
export default function ProductoFila({ producto }: { producto: Producto }) {
  const [pending, startTransition] = useTransition();
  const inicialArs = txt(precioEn(producto, "ARS"));
  const inicialUsd = txt(precioEn(producto, "USD"));
  const [ars, setArs] = useState(inicialArs);
  const [usd, setUsd] = useState(inicialUsd);
  const [moneda, setMoneda] = useState(producto.moneda === "USD" ? "USD" : "ARS");
  const [garantia, setGarantia] = useState(txt(producto.garantia_meses));
  const [iva, setIva] = useState(String(producto.iva_pct ?? 10.5));
  const [reposicion, setReposicion] = useState(txt(producto.frecuencia_recompra_dias));
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  const cambiado =
    ars !== inicialArs ||
    usd !== inicialUsd ||
    moneda !== (producto.moneda === "USD" ? "USD" : "ARS") ||
    garantia !== txt(producto.garantia_meses) ||
    iva !== String(producto.iva_pct ?? 10.5) ||
    reposicion !== txt(producto.frecuencia_recompra_dias);

  const guardar = (patch?: { activo?: boolean }) => {
    setError(null);
    setGuardado(false);
    startTransition(async () => {
      const res = await guardarProducto(producto.id, {
        precio_ars: num(ars),
        precio_usd: num(usd),
        moneda,
        garantia_meses: num(garantia),
        iva_pct: Number(iva),
        ...(producto.es_consumible ? { frecuencia_recompra_dias: num(reposicion) } : {}),
        ...patch,
      });
      if (res && "error" in res && res.error) setError(res.error);
      else setGuardado(true);
    });
  };

  const input = "rounded-xl border border-borde px-2.5 py-1.5 text-sm text-tinta";
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-borde/60 px-4 py-2.5 last:border-0">
      <div className="min-w-44 flex-1">
        <p className={`text-sm font-medium ${producto.activo ? "" : "text-piedra line-through"}`}>{producto.nombre}</p>
        <p className="text-xs text-piedra">
          {producto.marca ?? ""}
          {producto.es_consumible ? " · consumible" : ""}
        </p>
      </div>
      <label className="flex items-center gap-1 text-xs text-piedra" title="Precio de lista en pesos">
        $
        <input type="number" min={0} value={ars} placeholder="pesos" onChange={(e) => setArs(e.target.value)} className={`${input} w-28`} />
      </label>
      <label className="flex items-center gap-1 text-xs text-piedra" title="Precio de lista en dólares">
        USD
        <input type="number" min={0} value={usd} placeholder="dólares" onChange={(e) => setUsd(e.target.value)} className={`${input} w-24`} />
      </label>
      <label className="flex items-center gap-1 text-xs text-piedra" title="La moneda con la que arranca al cotizar">
        principal
        <select value={moneda} onChange={(e) => setMoneda(e.target.value)} className={input}>
          <option value="ARS">pesos</option>
          <option value="USD">dólares</option>
        </select>
      </label>
      <label className="flex items-center gap-1 text-xs text-piedra" title="El IVA que se suma en la cotización">
        IVA
        <select value={iva} onChange={(e) => setIva(e.target.value)} className={input}>
          <option value="10.5">10,5%</option>
          <option value="21">21%</option>
          <option value="27">27%</option>
          <option value="0">exento</option>
        </select>
      </label>
      {producto.es_consumible && (
        <label className="flex items-center gap-1 text-xs text-piedra" title="Se reinicia con cada compra y se puede ajustar por cliente">
          repone cada
          <input type="number" min={1} max={730} value={reposicion} placeholder="—" onChange={(e) => setReposicion(e.target.value)} className={`${input} w-16`} />
          días
        </label>
      )}
      <label className="flex items-center gap-1 text-xs text-piedra">
        garantía
        <input type="number" min={0} value={garantia} placeholder="—" onChange={(e) => setGarantia(e.target.value)} className={`${input} w-16`} />
        meses
      </label>
      {cambiado && (
        <button type="button" disabled={pending} onClick={() => guardar()} className="rounded-xl bg-marino px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60">
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
      {guardado && !cambiado && <span className="text-xs text-verde">Guardado</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
