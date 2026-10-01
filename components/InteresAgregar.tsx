"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { crearInteres } from "@/lib/actions";
import { CATEGORIAS_PRODUCTO, NIVELES_INTERES } from "@/lib/constants";
import { fechaCorta } from "@/lib/format";
import { textoStock, type InfoStock } from "@/lib/stock";
import type { Producto } from "@/lib/types";

const inputCls =
  "min-h-11 w-full rounded-2xl border border-borde bg-white px-3 py-2.5 text-[15px] outline-none focus:border-marino";
export const chipCls = (activo: boolean) =>
  `min-h-11 rounded-full px-3.5 py-2 text-[15px] font-medium ${
    activo ? "bg-marino text-white" : "border border-borde bg-white text-piedra"
  }`;

/** Selector de productos del catálogo, agrupado por categoría, con chips de lo elegido. */
export function SelectorProductos({
  productos,
  elegidos,
  onChange,
}: {
  productos: Producto[];
  elegidos: string[];
  onChange: (ids: string[]) => void;
}) {
  const grupos = Object.entries(CATEGORIAS_PRODUCTO)
    .map(([cat, label]) => ({ label, items: productos.filter((p) => p.categoria === cat) }))
    .filter((g) => g.items.length > 0);
  return (
    <div>
      {elegidos.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {elegidos.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1.5 rounded-full bg-marino px-3 py-1.5 text-sm text-white"
            >
              {productos.find((p) => p.id === id)?.nombre ?? "Producto"}
              <button
                type="button"
                onClick={() => onChange(elegidos.filter((x) => x !== id))}
                aria-label="Quitar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <select
        value=""
        onChange={(e) => {
          const id = e.target.value;
          if (id && !elegidos.includes(id)) onChange([...elegidos, id]);
        }}
        className={inputCls}
      >
        <option value="">{elegidos.length === 0 ? "Elegir del catálogo…" : "Agregar otro…"}</option>
        {grupos.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.items.map((p) => (
              <option key={p.id} value={p.id} disabled={elegidos.includes(p.id)}>
                {p.nombre}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

/**
 * "+ Otro interés" en la ficha: producto (o texto), cuánto le interesa
 * (obligatorio, sin default) y, si no hay stock, lista de espera.
 */
export default function InteresAgregar({
  clienteId,
  productos,
  stockInfo = {},
  abiertoInicial = false,
  onCerrar,
}: {
  clienteId: string;
  productos: Producto[];
  stockInfo?: Record<string, InfoStock>;
  /** Abre directo el formulario (desde "Nueva operación"). */
  abiertoInicial?: boolean;
  /** Al guardar o cancelar (para cerrar el menú que lo abrió). */
  onCerrar?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(abiertoInicial);
  const [ids, setIds] = useState<string[]>([]);
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [texto, setTexto] = useState("");
  const [nivel, setNivel] = useState("");
  const [enEspera, setEnEspera] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const sinStock = ids.some((id) => (stockInfo[id]?.stock ?? 1) <= 0);

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await crearInteres({
        clienteId,
        productoIds: ids,
        cantidades,
        texto,
        nivel,
        enEspera: enEspera && sinStock,
      });
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      setAbierto(false);
      setIds([]);
      setTexto("");
      setNivel("");
      setEnEspera(false);
      setAviso(enEspera && sinStock ? "Pasó a lista de espera" : "Interés cargado");
      setTimeout(() => setAviso(null), 2000);
      onCerrar?.();
      router.refresh();
    });
  }

  if (!abierto) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="min-h-11 w-full rounded-2xl border border-dashed border-borde bg-white py-2.5 text-[15px] font-medium text-tinta"
        >
          + Otro interés
        </button>
        {aviso && <p className="mt-2 text-center text-sm font-medium text-verde">✓ {aviso}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={guardar} className="space-y-2.5 rounded-2xl border border-borde bg-crema/60 p-3">
      <p className="text-sm font-semibold">¿Qué le interesa?</p>
      <SelectorProductos
        productos={productos}
        elegidos={ids}
        onChange={(nuevos) => {
          setIds(nuevos);
          if (nuevos.some((id) => (stockInfo[id]?.stock ?? 1) <= 0)) setEnEspera(true);
        }}
      />
      {ids.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-sm font-semibold">¿Cuántos?</p>
          {ids.map((id) => {
            const n = cantidades[id] ?? 1;
            return (
              <div key={id} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-[15px]">{productos.find((p) => p.id === id)?.nombre}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={n}
                  onChange={(e) => setCantidades({ ...cantidades, [id]: Math.max(1, Number(e.target.value) || 1) })}
                  aria-label="Cantidad"
                  className="h-10 w-16 rounded-xl border border-borde bg-white text-center text-[16px] font-bold"
                />
              </div>
            );
          })}
        </div>
      )}
      {ids.map((id) => {
        const info = stockInfo[id];
        if (!info) return null;
        return (
          <p key={id} className={`text-sm ${info.stock > 0 ? "text-verde" : "text-ambar"}`}>
            {productos.find((p) => p.id === id)?.nombre}: {textoStock(info, fechaCorta)}
          </p>
        );
      })}
      <input
        type="text"
        placeholder="…o escribilo con tus palabras"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        className={inputCls}
      />
      <div>
        <p className="mb-1.5 text-xs text-piedra">¿Cuánto le interesa?</p>
        <div className="flex flex-wrap gap-1.5">
          {NIVELES_INTERES.map((n) => (
            <button
              key={n.value}
              type="button"
              onClick={() => setNivel(n.value)}
              className={chipCls(nivel === n.value)}
            >
              {n.label}
            </button>
          ))}
        </div>
      </div>
      {sinStock && (
        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-2xl border border-ambar-soft bg-ambar-soft px-3.5 py-2.5 text-[15px] text-ambar">
          <input
            type="checkbox"
            checked={enEspera}
            onChange={(e) => setEnEspera(e.target.checked)}
            className="h-4 w-4 accent-tinta"
          />
          Poner en lista de espera (lo quiere y no hay stock)
        </label>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || (ids.length === 0 && !texto.trim()) || !nivel}
          className="min-h-11 flex-1 rounded-2xl bg-marino py-2.5 text-[15px] font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Guardar interés"}
        </button>
        <button
          type="button"
          onClick={() => {
            setAbierto(false);
            setError(null);
            onCerrar?.();
          }}
          className="min-h-11 rounded-2xl border border-borde px-4 text-[15px] text-piedra"
        >
          Cancelar
        </button>
      </div>
      {!nivel && (ids.length > 0 || texto.trim()) && (
        <p className="text-xs text-piedra">Falta elegir cuánto le interesa.</p>
      )}
    </form>
  );
}
