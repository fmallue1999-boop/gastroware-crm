"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, Trash2 } from "lucide-react";
import {
  borrarIngresoStock,
  crearIngresoStock,
  guardarStock,
  recibirIngresoStock,
} from "@/lib/actions";
import { fechaCorta, hoyISO } from "@/lib/format";
import type { IngresoStock } from "@/lib/types";

const inputCls =
  "rounded-xl border border-borde bg-white px-3 py-2 text-sm outline-none focus:border-tinta";

/** Stock editable en línea: un número, un tilde. */
export function StockEditable({
  productoId,
  stock,
}: {
  productoId: string;
  stock: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [valor, setValor] = useState(String(stock));
  const [error, setError] = useState<string | null>(null);
  const cambiado = valor !== String(stock);

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        min={0}
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        className={`${inputCls} w-20 text-center font-semibold`}
        aria-label="Stock"
      />
      {cambiado && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const res = await guardarStock(productoId, Number(valor));
              if (res && "error" in res && res.error) setError(res.error);
              router.refresh();
            })
          }
          aria-label="Guardar stock"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-tinta text-white disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
        </button>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

/** Ingresos previstos de un producto: lista + alta + recibir. */
export function IngresosProducto({
  productoId,
  ingresos,
}: {
  productoId: string;
  ingresos: IngresoStock[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [cantidad, setCantidad] = useState("");
  const [fecha, setFecha] = useState("");
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);

  function accion(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      const res = (await fn()) as { error?: string } | null | undefined;
      if (res && typeof res === "object" && "error" in res && res.error) setError(res.error);
      router.refresh();
    });
  }

  function agregar(e: React.FormEvent) {
    e.preventDefault();
    accion(async () => {
      const res = await crearIngresoStock({
        productoId,
        cantidad: Number(cantidad),
        fechaEstimada: fecha || null,
        nota,
      });
      if (!(res && "error" in res && res.error)) {
        setCantidad("");
        setFecha("");
        setNota("");
        setAbierto(false);
      }
      return res;
    });
  }

  return (
    <div className="space-y-1.5">
      {ingresos.map((i) => (
        <div
          key={i.id}
          className="flex items-center justify-between gap-2 rounded-xl bg-crema px-3 py-2 text-sm"
        >
          <span>
            <span className="font-medium">Llegan {i.cantidad}</span>
            {i.fecha_estimada ? ` el ${fechaCorta(i.fecha_estimada)}` : " (fecha a confirmar)"}
            {i.nota ? <span className="text-piedra"> · {i.nota}</span> : null}
          </span>
          <span className="flex shrink-0 gap-1">
            <button
              type="button"
              disabled={pending}
              onClick={() => accion(() => recibirIngresoStock(i.id))}
              className="rounded-lg bg-green-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
            >
              Ya llegó
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => accion(() => borrarIngresoStock(i.id))}
              aria-label="Borrar ingreso"
              className="rounded-lg border border-borde px-2 py-1 text-piedra disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </span>
        </div>
      ))}

      {abierto ? (
        <form onSubmit={agregar} className="flex flex-wrap items-center gap-1.5">
          <input
            type="number"
            min={1}
            required
            placeholder="Cant."
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            className={`${inputCls} w-20`}
          />
          <input
            type="date"
            min={hoyISO()}
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className={inputCls}
          />
          <input
            type="text"
            placeholder="Nota (opcional)"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            className={`${inputCls} min-w-32 flex-1`}
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-tinta px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
          >
            Guardar
          </button>
          <button
            type="button"
            onClick={() => setAbierto(false)}
            className="text-xs text-piedra underline"
          >
            Cancelar
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="inline-flex items-center gap-1 text-xs text-sky-700 underline"
        >
          <Plus className="h-3 w-3" /> Cargar ingreso previsto
        </button>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
