"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  actualizarOT,
  cambiarEstadoOT,
  agregarItemOT,
  borrarItemOT,
  agregarFotoOT,
  guardarFirmaOT,
} from "@/lib/actions";
import { createClient } from "@/lib/supabase/client";
import { dinero } from "@/lib/format";
import type { OrdenTrabajo, OTFoto, OTItem, Producto } from "@/lib/types";

const inputCls =
  "rounded-xl border border-borde bg-white px-3 py-2.5 text-sm outline-none focus:border-tinta";

async function subirArchivo(otId: string, archivo: File, carpeta: string) {
  const supabase = createClient();
  const path = `${carpeta}/${otId}/${Date.now()}-${archivo.name.replace(/[^\w.\-]/g, "_")}`;
  const { error } = await supabase.storage.from("servicio").upload(path, archivo);
  if (error) throw new Error(error.message);
  return supabase.storage.from("servicio").getPublicUrl(path).data.publicUrl;
}

export default function OTTrabajo({
  ot,
  items,
  fotos,
  refacciones,
  editable,
}: {
  ot: OrdenTrabajo;
  items: OTItem[];
  fotos: OTFoto[];
  refacciones: Producto[];
  editable: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [trabajo, setTrabajo] = useState(ot.trabajo_realizado ?? "");
  const [horas, setHoras] = useState(ot.horas ? String(ot.horas) : "");
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ítem nuevo
  const [itemTipo, setItemTipo] = useState<"refaccion" | "gasto">("refaccion");
  const [itemDesc, setItemDesc] = useState("");
  const [itemProductoId, setItemProductoId] = useState("");
  const [itemCant, setItemCant] = useState("1");
  const [itemPrecio, setItemPrecio] = useState("");
  const [itemTicket, setItemTicket] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  function guardarTrabajo() {
    startTransition(async () => {
      await actualizarOT(ot.id, {
        trabajo_realizado: trabajo,
        horas: horas ? Number(horas) : null,
      });
      if (ot.estado === "abierta") await cambiarEstadoOT(ot.id, "en_proceso");
      setGuardado(true);
      setTimeout(() => setGuardado(false), 1500);
      router.refresh();
    });
  }

  function elegirRefaccion(id: string) {
    setItemProductoId(id);
    const p = refacciones.find((r) => r.id === id);
    if (p) {
      setItemDesc(p.nombre);
      if (p.precio_referencia) setItemPrecio(String(p.precio_referencia));
    }
  }

  async function agregarItem(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubiendo(true);
    try {
      let comprobanteUrl: string | null = null;
      if (itemTicket) {
        comprobanteUrl = await subirArchivo(ot.id, itemTicket, "tickets");
      }
      const res = await agregarItemOT({
        otId: ot.id,
        tipo: itemTipo,
        descripcion: itemDesc,
        productoId: itemProductoId || null,
        cantidad: Number(itemCant) || 1,
        precioUnit: Number(itemPrecio) || 0,
        refacturable: !ot.es_garantia || itemTipo === "gasto",
        comprobanteUrl,
      });
      if (res && "error" in res && res.error) setError(res.error);
      else {
        setItemDesc("");
        setItemProductoId("");
        setItemCant("1");
        setItemPrecio("");
        setItemTicket(null);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir");
    } finally {
      setSubiendo(false);
    }
  }

  async function subirFoto(archivo: File | null) {
    if (!archivo) return;
    setSubiendo(true);
    try {
      const url = await subirArchivo(ot.id, archivo, "fotos");
      await agregarFotoOT(ot.id, url);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir la foto");
    } finally {
      setSubiendo(false);
    }
  }

  function cerrar() {
    setError(null);
    startTransition(async () => {
      await actualizarOT(ot.id, {
        trabajo_realizado: trabajo,
        horas: horas ? Number(horas) : null,
      });
      const res = await cambiarEstadoOT(ot.id, "cerrada_tecnico");
      if (res && "error" in res && res.error) setError(res.error);
      router.refresh();
    });
  }

  if (!editable) {
    return (
      <section className="rounded-xl border border-borde bg-white p-4 space-y-3">
        <div>
          <h2 className="text-sm font-semibold">Trabajo realizado</h2>
          <p className="mt-1 text-sm text-tinta/80 whitespace-pre-wrap">
            {ot.trabajo_realizado ?? "—"}
          </p>
          <p className="mt-1 text-xs text-piedra">{ot.horas ?? 0} horas</p>
        </div>
        {items.length > 0 && (
          <ListaItems items={items} borrable={false} onBorrar={() => {}} />
        )}
        {fotos.length > 0 && <GrillaFotos fotos={fotos} />}
        {ot.firma_url && (
          <div>
            <h3 className="text-xs font-semibold text-piedra mb-1">
              Firmado por {ot.firmante ?? "el cliente"}
            </h3>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ot.firma_url} alt="Firma del cliente" className="h-20 rounded-lg border border-borde bg-white" />
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-xl border-2 border-celeste-deep bg-white p-4 space-y-4">
      <div>
        <h2 className="text-sm font-semibold mb-2">Carga del técnico</h2>
        <textarea
          placeholder="¿Qué se hizo? (trabajo realizado)"
          value={trabajo}
          onChange={(e) => setTrabajo(e.target.value)}
          rows={3}
          className={`${inputCls} w-full`}
        />
        <div className="mt-2 flex gap-2">
          <input
            type="number"
            step="0.5"
            placeholder="Horas trabajadas"
            value={horas}
            onChange={(e) => setHoras(e.target.value)}
            className={`${inputCls} flex-1`}
          />
          <button
            onClick={guardarTrabajo}
            disabled={pending}
            className="rounded-xl border border-tinta px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {guardado ? "✓" : "Guardar"}
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-piedra mb-2">
          Refacciones y gastos
        </h3>
        {items.length > 0 && (
          <ListaItems
            items={items}
            borrable
            onBorrar={(id) =>
              startTransition(async () => {
                await borrarItemOT(id);
                router.refresh();
              })
            }
          />
        )}
        <form onSubmit={agregarItem} className="mt-2 space-y-2 rounded-lg bg-crema p-3">
          <div className="flex gap-2">
            <select
              value={itemTipo}
              onChange={(e) => setItemTipo(e.target.value as "refaccion" | "gasto")}
              className={inputCls}
            >
              <option value="refaccion">Refacción</option>
              <option value="gasto">Gasto (ticket)</option>
            </select>
            {itemTipo === "refaccion" && refacciones.length > 0 && (
              <select
                value={itemProductoId}
                onChange={(e) => elegirRefaccion(e.target.value)}
                className={`${inputCls} flex-1 min-w-0`}
              >
                <option value="">Del catálogo…</option>
                {refacciones.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre}
                  </option>
                ))}
              </select>
            )}
          </div>
          <input
            type="text"
            required
            placeholder={itemTipo === "gasto" ? "Descripción (ej: peaje, materiales)" : "Descripción del repuesto"}
            value={itemDesc}
            onChange={(e) => setItemDesc(e.target.value)}
            className={`${inputCls} w-full`}
          />
          <div className="flex gap-2">
            <input type="number" step="any" placeholder="Cant." value={itemCant} onChange={(e) => setItemCant(e.target.value)} className={`${inputCls} w-20`} />
            <input type="number" step="any" required placeholder="Precio unit. $" value={itemPrecio} onChange={(e) => setItemPrecio(e.target.value)} className={`${inputCls} flex-1`} />
          </div>
          {itemTipo === "gasto" && (
            <label className="block text-xs text-piedra">
              Foto del ticket
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => setItemTicket(e.target.files?.[0] ?? null)}
                className="mt-1 block w-full text-xs"
              />
            </label>
          )}
          <button
            type="submit"
            disabled={subiendo}
            className="w-full rounded-lg border border-tinta py-2 text-sm font-medium disabled:opacity-50"
          >
            {subiendo ? "Subiendo…" : "+ Agregar"}
          </button>
        </form>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-piedra mb-2">
          Fotos del trabajo
        </h3>
        {fotos.length > 0 && <GrillaFotos fotos={fotos} />}
        <label className="mt-2 block">
          <span className="block w-full cursor-pointer rounded-lg border border-dashed border-borde py-2 text-center text-sm text-piedra">
            📷 {subiendo ? "Subiendo…" : "Sacar o subir foto"}
          </span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => subirFoto(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      <Firma ot={ot} />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={cerrar}
        disabled={pending}
        className="w-full rounded-xl bg-tinta py-3 font-medium text-white disabled:opacity-60"
      >
        Cerrar orden (pasa a administración)
      </button>
    </section>
  );
}

function ListaItems({
  items,
  borrable,
  onBorrar,
}: {
  items: OTItem[];
  borrable: boolean;
  onBorrar: (id: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      {items.map((i) => (
        <div key={i.id} className="flex items-center gap-2 text-sm">
          <span className="text-xs">{i.tipo === "gasto" ? "🧾" : "🔩"}</span>
          <span className="min-w-0 flex-1 truncate">
            {i.descripcion}
            {Number(i.cantidad) !== 1 ? ` × ${i.cantidad}` : ""}
          </span>
          {i.comprobante_url && (
            <a href={i.comprobante_url} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-700">
              ticket
            </a>
          )}
          <span className="shrink-0 font-medium">
            {dinero(Number(i.cantidad) * Number(i.precio_unit))}
          </span>
          {borrable && (
            <button onClick={() => onBorrar(i.id)} className="text-piedra/80 hover:text-red-600">
              ✕
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function GrillaFotos({ fotos }: { fotos: OTFoto[] }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {fotos.map((f) => (
        <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={f.url} alt="Foto del trabajo" className="h-20 w-full rounded-lg border border-borde object-cover" />
        </a>
      ))}
    </div>
  );
}

function Firma({ ot }: { ot: OrdenTrabajo }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);
  const [hayTrazo, setHayTrazo] = useState(false);
  const [firmante, setFirmante] = useState(ot.firmante ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (ot.firma_url) {
    return (
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-piedra mb-1">
          Firmado por {ot.firmante ?? "el cliente"} ✓
        </h3>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ot.firma_url} alt="Firma del cliente" className="h-20 rounded-lg border border-borde bg-white" />
      </div>
    );
  }

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvasRef.current!.width,
      y: ((e.clientY - rect.top) / rect.height) * canvasRef.current!.height,
    };
  }

  function empezar(e: React.PointerEvent<HTMLCanvasElement>) {
    dibujando.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    canvasRef.current!.setPointerCapture(e.pointerId);
  }

  function mover(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dibujando.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111111";
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setHayTrazo(true);
  }

  function limpiar() {
    const c = canvasRef.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setHayTrazo(false);
  }

  async function guardar() {
    if (!hayTrazo) return;
    setError(null);
    setGuardando(true);
    const res = await guardarFirmaOT(
      ot.id,
      canvasRef.current!.toDataURL("image/png"),
      firmante
    );
    setGuardando(false);
    if (res && "error" in res && res.error) setError(res.error);
    else router.refresh();
  }

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-piedra mb-2">
        Firma del cliente
      </h3>
      <input
        type="text"
        placeholder="Nombre de quien firma"
        value={firmante}
        onChange={(e) => setFirmante(e.target.value)}
        className="mb-2 w-full rounded-xl border border-borde bg-white px-3 py-2 text-sm outline-none focus:border-tinta"
      />
      <canvas
        ref={canvasRef}
        width={600}
        height={200}
        onPointerDown={empezar}
        onPointerMove={mover}
        onPointerUp={() => (dibujando.current = false)}
        className="w-full touch-none rounded-xl border border-borde bg-white"
      />
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={limpiar}
          className="rounded-lg border border-borde px-3 py-1.5 text-xs"
        >
          Limpiar
        </button>
        <button
          type="button"
          onClick={guardar}
          disabled={!hayTrazo || guardando}
          className="rounded-lg bg-tinta px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {guardando ? "Guardando…" : "Guardar firma"}
        </button>
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
