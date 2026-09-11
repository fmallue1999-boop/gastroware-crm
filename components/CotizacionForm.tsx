"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { registrarCotizacion, type ItemCotizacion } from "@/lib/actions";
import { createClient } from "@/lib/supabase/client";
import { dinero } from "@/lib/format";
import type { Producto } from "@/lib/types";

const inputCls =
  "w-full rounded-2xl border border-borde bg-white shadow-sm px-3 py-2.5 text-sm outline-none focus:border-tinta";

type Linea = ItemCotizacion & { clave: number };

export default function CotizacionForm({
  oportunidadId,
  monedaDefault,
  advertencia,
  productos,
}: {
  oportunidadId: string;
  monedaDefault: string;
  advertencia: string | null;
  productos: Producto[];
}) {
  const [pending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [clave, setClave] = useState(1);
  const [moneda, setMoneda] = useState(monedaDefault);
  const [formaPago, setFormaPago] = useState("");
  const [vigencia, setVigencia] = useState("7");
  const [notas, setNotas] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const total = lineas.reduce((s, l) => s + l.cantidad * l.precioUnit, 0);

  function agregarProducto(id: string) {
    if (!id) return;
    const p = productos.find((x) => x.id === id);
    if (!p) return;
    setLineas([
      ...lineas,
      {
        clave,
        productoId: p.id,
        descripcion: p.nombre,
        cantidad: 1,
        precioUnit: p.precio_referencia ?? 0,
      },
    ]);
    setClave(clave + 1);
    if (lineas.length === 0) setMoneda(p.moneda);
  }

  function agregarLibre() {
    setLineas([
      ...lineas,
      { clave, productoId: null, descripcion: "", cantidad: 1, precioUnit: 0 },
    ]);
    setClave(clave + 1);
  }

  function cambiar(k: number, patch: Partial<Linea>) {
    setLineas(lineas.map((l) => (l.clave === k ? { ...l, ...patch } : l)));
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (lineas.length === 0) {
      setError("Agregá al menos un producto o línea.");
      return;
    }
    startTransition(async () => {
      let archivoPath: string | null = null;
      if (archivo) {
        const supabase = createClient();
        const path = `cotizaciones/${oportunidadId}/${Date.now()}-${archivo.name.replace(/[^\w.\-]/g, "_")}`;
        const { error: errUpload } = await supabase.storage
          .from("documentos")
          .upload(path, archivo);
        if (errUpload) {
          setError("No se pudo subir el archivo: " + errUpload.message);
          return;
        }
        archivoPath = path;
      }

      const res = await registrarCotizacion({
        oportunidadId,
        monto: total || null,
        moneda,
        forma_pago: formaPago,
        archivoPath,
        notas,
        vigenciaDias: vigencia ? Number(vigencia) : null,
        items: lineas.map((l) => ({
          productoId: l.productoId,
          descripcion: l.descripcion,
          cantidad: l.cantidad,
          precioUnit: l.precioUnit,
        })),
      });
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      setAbierto(false);
      setLineas([]);
      setArchivo(null);
    });
  }

  if (!abierto) {
    return (
      <div>
        {advertencia && (
          <p className="mb-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
            {advertencia}
          </p>
        )}
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="w-full rounded-2xl border border-dashed border-borde py-2.5 text-sm text-piedra"
        >
          + Armar cotización (elegís del catálogo y sale prolija)
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <select
          value=""
          onChange={(e) => agregarProducto(e.target.value)}
          className={`${inputCls} flex-1 min-w-48`}
        >
          <option value="">+ Agregar producto del catálogo…</option>
          {productos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
              {p.precio_referencia
                ? ` — ${dinero(p.precio_referencia, p.moneda)}`
                : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={agregarLibre}
          className="inline-flex items-center gap-1 rounded-2xl border border-borde px-3 py-2 text-sm text-piedra"
        >
          <Plus className="h-3.5 w-3.5" /> Línea libre
        </button>
      </div>

      {lineas.length > 0 && (
        <div className="space-y-1.5 rounded-2xl border border-borde bg-white p-3 shadow-sm">
          {lineas.map((l) => (
            <div key={l.clave} className="flex items-center gap-1.5">
              <input
                type="text"
                required
                placeholder="Descripción"
                value={l.descripcion}
                onChange={(e) => cambiar(l.clave, { descripcion: e.target.value })}
                className="min-w-0 flex-1 rounded-xl border border-borde px-2.5 py-1.5 text-sm"
              />
              <input
                type="number"
                min={1}
                value={l.cantidad}
                onChange={(e) =>
                  cambiar(l.clave, { cantidad: Number(e.target.value) || 1 })
                }
                className="w-14 rounded-xl border border-borde px-2 py-1.5 text-center text-sm"
              />
              <input
                type="number"
                min={0}
                step="any"
                value={l.precioUnit}
                onChange={(e) =>
                  cambiar(l.clave, { precioUnit: Number(e.target.value) || 0 })
                }
                className="w-28 rounded-xl border border-borde px-2 py-1.5 text-right text-sm"
              />
              <button
                type="button"
                onClick={() =>
                  setLineas(lineas.filter((x) => x.clave !== l.clave))
                }
                aria-label="Quitar línea"
                className="shrink-0 text-piedra/60 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-borde/60 pt-2">
            <select
              value={moneda}
              onChange={(e) => setMoneda(e.target.value)}
              className="rounded-xl border border-borde px-2.5 py-1.5 text-sm"
            >
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
            </select>
            <p className="text-sm font-bold">Total: {dinero(total, moneda)}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          placeholder="Forma de pago (ej: 50% anticipo + 3 cuotas)"
          value={formaPago}
          onChange={(e) => setFormaPago(e.target.value)}
          className={inputCls}
        />
        <label className="flex items-center gap-2 text-sm text-piedra">
          Válida por
          <input
            type="number"
            min={1}
            value={vigencia}
            onChange={(e) => setVigencia(e.target.value)}
            className="w-16 rounded-xl border border-borde px-2 py-2 text-center text-sm text-tinta"
          />
          días
        </label>
      </div>

      <textarea
        placeholder="Condiciones o aclaraciones (opcional: entrega, instalación, IVA…)"
        value={notas}
        onChange={(e) => setNotas(e.target.value)}
        rows={2}
        className={inputCls}
      />

      <label className="block text-xs text-piedra">
        PDF propio (opcional, si ya la armaste afuera):
        <input
          type="file"
          accept=".pdf,image/*"
          onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
          className="mt-1 block w-full text-xs file:mr-2 file:rounded-xl file:border file:border-borde file:bg-white file:px-3 file:py-1.5 file:text-xs"
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-2xl bg-tinta py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Guardar cotización"}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="rounded-2xl border border-borde px-4 py-2.5 text-sm"
        >
          Cancelar
        </button>
      </div>
      <p className="text-[11px] text-piedra">
        Al guardar queda la versión con sus ítems y podés abrir la cotización
        imprimible para mandarla al cliente.
      </p>
    </form>
  );
}
