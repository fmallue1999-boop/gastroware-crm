"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { registrarCotizacion, type ItemCotizacion } from "@/lib/actions";
import { createClient } from "@/lib/supabase/client";
import { dinero } from "@/lib/format";
import type { Producto } from "@/lib/types";
import { precioEn, textoPrecios } from "@/lib/precios";
import { FORMAS_PAGO_VENTA } from "@/lib/constants";

const inputCls =
  "w-full rounded-2xl border border-borde bg-white shadow-sm px-3 py-2.5 text-sm outline-none focus:border-marino";

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
  const [formaDetalle, setFormaDetalle] = useState("");
  const [conDescuento, setConDescuento] = useState(false);
  const [descuento, setDescuento] = useState("");
  const [motivoDescuento, setMotivoDescuento] = useState("");
  const [vigencia, setVigencia] = useState("7");
  const [notas, setNotas] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [condicionEspecial, setCondicionEspecial] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotal = lineas.reduce((s, l) => s + l.cantidad * l.precioUnit, 0);
  const pctDescuento = conDescuento ? Math.min(99, Math.max(0, Number(descuento.replace(",", ".")) || 0)) : 0;
  const total = Math.round(subtotal * (1 - pctDescuento / 100) * 100) / 100;
  const bajoLista = lineas.some((l) => {
    const lista = precioEn(productos.find((x) => x.id === l.productoId), moneda);
    return lista != null && l.precioUnit < lista - 0.5;
  });
  // Productos sin precio de lista en la moneda elegida (hay que ponerlo a mano)
  const sinPrecio = lineas.filter((l) => l.productoId && precioEn(productos.find((x) => x.id === l.productoId), moneda) == null);

  /** Cambiar de moneda: las líneas con precio de lista pasan al precio en la otra moneda. */
  function cambiarMoneda(nueva: string) {
    setLineas(
      lineas.map((l) => {
        const p = productos.find((x) => x.id === l.productoId);
        if (!p) return l;
        const antes = precioEn(p, moneda);
        const despues = precioEn(p, nueva);
        // Solo si no se tocó a mano el precio de lista
        return despues != null && (antes == null || l.precioUnit === antes) ? { ...l, precioUnit: despues } : l;
      })
    );
    setMoneda(nueva);
  }

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
        precioUnit: precioEn(p, moneda) ?? 0,
      },
    ]);
    setClave(clave + 1);
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
        monto: subtotal || null,
        moneda,
        forma_pago: [formaPago, formaDetalle.trim()].filter(Boolean).join(" — "),
        descuentoPct: pctDescuento || null,
        descuentoMotivo: motivoDescuento,
        archivoPath,
        notas,
        vigenciaDias: vigencia ? Number(vigencia) : null,
        condicionEspecial,
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
          <p className="mb-2 rounded-lg bg-ambar-soft border border-ambar-soft px-3 py-2 text-sm text-ambar">
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
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">Cotizar en</span>
        {[
          { v: "ARS", l: "Pesos" },
          { v: "USD", l: "Dólares" },
        ].map((m) => (
          <button
            key={m.v}
            type="button"
            onClick={() => cambiarMoneda(m.v)}
            className={`min-h-9 rounded-full px-3.5 text-sm font-bold ${moneda === m.v ? "bg-marino text-white" : "border border-borde bg-white text-piedra"}`}
          >
            {m.l}
          </button>
        ))}
      </div>
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
              {textoPrecios(p, dinero) ? ` — ${textoPrecios(p, dinero)}` : " — sin precio de lista"}
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
            <span className="text-xs text-piedra">{moneda === "USD" ? "En dólares" : "En pesos"}</span>
            <p className="text-sm font-bold">
              {pctDescuento ? (
                <>
                  <span className="font-normal text-piedra">Subtotal {dinero(subtotal, moneda)} · −{pctDescuento}% · </span>
                  Total: {dinero(total, moneda)}
                </>
              ) : (
                <>Total: {dinero(total, moneda)}</>
              )}
            </p>
          </div>
        </div>
      )}

      {sinPrecio.length > 0 && (
        <p className="rounded-xl bg-ambar-soft px-3 py-2 text-sm text-ambar">
          Sin precio de lista en {moneda === "USD" ? "dólares" : "pesos"}: {sinPrecio.map((l) => l.descripcion).join(", ")}. Ponelo a mano o cargalo en el catálogo.
        </p>
      )}

      {/* Descuento especial para la operación */}
      <div className="space-y-2 rounded-2xl border border-borde bg-white p-3 shadow-sm">
        <label className="flex min-h-10 items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={conDescuento} onChange={(e) => setConDescuento(e.target.checked)} className="h-5 w-5" />
          Pide un descuento especial para esta operación
        </label>
        {conDescuento && (
          <div className="grid grid-cols-[6rem_1fr] gap-2">
            <label className="flex items-center gap-1 text-sm">
              <input
                type="number"
                min={0}
                max={99}
                step="any"
                value={descuento}
                onChange={(e) => setDescuento(e.target.value)}
                className="w-16 rounded-xl border border-borde px-2 py-2 text-center text-sm"
                aria-label="Porcentaje de descuento"
              />
              %
            </label>
            <input
              type="text"
              placeholder="Motivo (ej: compra 3 equipos, cliente de años)"
              value={motivoDescuento}
              onChange={(e) => setMotivoDescuento(e.target.value)}
              className={inputCls}
            />
          </div>
        )}
      </div>

      {/* Forma de pago */}
      <div className="space-y-2">
        <p className="text-sm font-semibold">Forma de pago</p>
        <div className="flex flex-wrap gap-1.5">
          {FORMAS_PAGO_VENTA.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormaPago(formaPago === f ? "" : f)}
              className={`min-h-9 rounded-full px-3 text-sm font-semibold ${formaPago === f ? "bg-marino text-white" : "border border-borde bg-white text-piedra"}`}
            >
              {f}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Detalle (opcional: ej. 50% anticipo + 3 cuotas)"
          value={formaDetalle}
          onChange={(e) => setFormaDetalle(e.target.value)}
          className={inputCls}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
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

      <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
        <input type="checkbox" checked={condicionEspecial} onChange={(e) => setCondicionEspecial(e.target.checked)} className="h-5 w-5" />
        Tiene una condición especial (plazo, financiación, bonificación)
      </label>
      {(bajoLista || condicionEspecial || pctDescuento > 0) && (
        <p className="rounded-xl bg-ambar-soft px-3 py-2 text-sm font-semibold text-ambar">
          {pctDescuento > 0 ? `Descuento especial ${pctDescuento}%` : condicionEspecial ? "Condición especial" : "Por debajo de lista"}: si pasa lo que podés dar solo, queda
          esperando la aprobación de dirección (con el motivo) antes de imprimirla o mandarla.
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-2xl bg-marino py-2.5 text-sm font-medium text-white disabled:opacity-60"
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
