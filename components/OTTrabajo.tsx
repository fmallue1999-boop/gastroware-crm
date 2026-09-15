"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Cog,
  Receipt,
  Play,
  Square,
  Clock,
  AlertTriangle,
} from "lucide-react";
import {
  actualizarOT,
  agregarItemOT,
  borrarItemOT,
  agregarFotoOT,
  guardarFirmaOT,
  iniciarTiempo,
  detenerTiempo,
  cargarTiempoManual,
  finalizarOTTecnico,
  transicionarOT,
} from "@/lib/actions";
import { createClient } from "@/lib/supabase/client";
import { dinero } from "@/lib/format";
import { ESTADOS_ITEM_OT } from "@/lib/constants";
import type { OrdenTrabajo, OTItem, OTTiempo, Repuesto } from "@/lib/types";

const inputCls =
  "rounded-2xl border border-borde bg-white px-3 py-2.5 text-sm outline-none focus:border-tinta";

async function subirArchivo(otId: string, archivo: File, carpeta: string) {
  if (archivo.size > 10 * 1024 * 1024) throw new Error("Máximo 10 MB");
  const supabase = createClient();
  const path = `${carpeta}/${otId}/${Date.now()}-${archivo.name.replace(/[^\w.\-]/g, "_")}`;
  const { error } = await supabase.storage.from("servicio").upload(path, archivo);
  if (error) throw new Error(error.message);
  return path;
}

export default function OTTrabajo({
  ot,
  items,
  fotos,
  tiempos,
  repuestos,
  editable,
  firmaUrl,
  transicionesTecnico,
}: {
  ot: OrdenTrabajo;
  items: OTItem[];
  fotos: { id: string; momento: string; url: string | null }[];
  tiempos: OTTiempo[];
  repuestos: Repuesto[];
  editable: boolean;
  firmaUrl: string | null;
  transicionesTecnico: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [diagnostico, setDiagnostico] = useState(ot.diagnostico ?? "");
  const [trabajo, setTrabajo] = useState(ot.trabajo_realizado ?? "");
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  // Ítem nuevo
  const [itemTipo, setItemTipo] = useState<"refaccion" | "gasto">("refaccion");
  const [itemDesc, setItemDesc] = useState("");
  const [itemRepuestoId, setItemRepuestoId] = useState("");
  const [itemCant, setItemCant] = useState("1");
  const [itemPrecio, setItemPrecio] = useState("");
  const [itemEstado, setItemEstado] = useState("pendiente");
  const [itemTicket, setItemTicket] = useState<File | null>(null);

  // Tiempo manual
  const [minManual, setMinManual] = useState("");
  const [justif, setJustif] = useState("");

  const cronometro = tiempos.find((t) => !t.fin && !t.manual);
  const minutosTotales = tiempos.reduce((s, t) => s + (t.minutos ?? 0), 0);

  function guardarTextos() {
    startTransition(async () => {
      await actualizarOT(ot.id, {
        diagnostico: diagnostico.trim() || null,
        trabajo_realizado: trabajo.trim() || null,
      });
      setGuardado(true);
      setTimeout(() => setGuardado(false), 1500);
      router.refresh();
    });
  }

  function elegirRepuesto(id: string) {
    setItemRepuestoId(id);
    const r = repuestos.find((x) => x.id === id);
    if (r) {
      setItemDesc(r.descripcion);
      if (r.precio) setItemPrecio(String(r.precio));
    }
  }

  async function agregarItem(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubiendo(true);
    try {
      let comprobantePath: string | null = null;
      if (itemTicket) comprobantePath = await subirArchivo(ot.id, itemTicket, "tickets");
      const res = await agregarItemOT({
        otId: ot.id,
        tipo: itemTipo,
        descripcion: itemDesc,
        repuestoId: itemRepuestoId || null,
        cantidad: Number(itemCant) || 1,
        precioUnit: Number(itemPrecio) || 0,
        estado: itemEstado,
        comprobantePath,
      });
      if (res && "error" in res && res.error) setError(res.error);
      else {
        setItemDesc(""); setItemRepuestoId(""); setItemCant("1");
        setItemPrecio(""); setItemTicket(null); setItemEstado("pendiente");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir");
    } finally {
      setSubiendo(false);
    }
  }

  async function subirFoto(archivo: File | null, momento: "antes" | "despues") {
    if (!archivo) return;
    setSubiendo(true);
    try {
      const path = await subirArchivo(ot.id, archivo, "fotos");
      await agregarFotoOT(ot.id, path, momento);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir la foto");
    } finally {
      setSubiendo(false);
    }
  }

  function accion(fn: () => Promise<{ error?: string } | { ok: boolean } | void>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res && "error" in res && res.error) setError(res.error);
      router.refresh();
    });
  }

  if (!editable) {
    return (
      <section className="space-y-3 rounded-2xl border border-borde bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-sm font-semibold">Diagnóstico</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm text-tinta/80">
            {ot.diagnostico ?? "—"}
          </p>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Trabajo realizado</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm text-tinta/80">
            {ot.trabajo_realizado ?? "—"}
          </p>
          <p className="mt-1 text-xs text-piedra">
            <Clock className="mr-1 -mt-0.5 inline h-3.5 w-3.5" />
            {(minutosTotales / 60).toFixed(1)} horas trabajadas
          </p>
        </div>
        {items.length > 0 && <ListaItems items={items} borrable={false} onBorrar={() => {}} />}
        {fotos.length > 0 && <GrillaFotos fotos={fotos} />}
        {firmaUrl && (
          <div>
            <h3 className="mb-1 text-xs font-semibold text-piedra">
              Firmado por {ot.firmante ?? "el cliente"}
            </h3>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={firmaUrl} alt="Firma del cliente" className="h-20 rounded-lg border border-borde bg-white" />
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border-2 border-celeste-deep bg-white p-4 shadow-sm">
      {ot.estado === "devuelto_tecnico" && ot.observacion_admin && (
        <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Devuelta por administración: {ot.observacion_admin}
        </p>
      )}

      {/* Cronómetro */}
      <div className="rounded-xl bg-crema p-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">
            <Clock className="mr-1 -mt-0.5 inline h-4 w-4" />
            {(minutosTotales / 60).toFixed(1)} h trabajadas
          </p>
          {cronometro ? (
            <button
              onClick={() => accion(() => detenerTiempo(ot.id))}
              disabled={pending}
              className="flex items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-2 text-sm font-medium text-white"
            >
              <Square className="h-4 w-4" /> Detener
            </button>
          ) : (
            <button
              onClick={() => accion(() => iniciarTiempo(ot.id))}
              disabled={pending}
              className="flex items-center gap-1.5 rounded-xl bg-green-600 px-3.5 py-2 text-sm font-medium text-white"
            >
              <Play className="h-4 w-4" /> Iniciar trabajo
            </button>
          )}
        </div>
        {cronometro && (
          <p className="mt-1 text-xs text-piedra">
            Corriendo desde{" "}
            {new Date(cronometro.inicio).toLocaleTimeString("es-AR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-piedra underline">
            Cargar tiempo a mano (requiere justificación)
          </summary>
          <div className="mt-2 flex flex-wrap gap-2">
            <input type="number" placeholder="Minutos" value={minManual} onChange={(e) => setMinManual(e.target.value)} className={`${inputCls} w-24`} />
            <input type="text" placeholder="Justificación" value={justif} onChange={(e) => setJustif(e.target.value)} className={`${inputCls} min-w-40 flex-1`} />
            <button
              onClick={() => accion(async () => { const r = await cargarTiempoManual(ot.id, Number(minManual), justif); if (!(r && "error" in r && r.error)) { setMinManual(""); setJustif(""); } return r; })}
              disabled={pending}
              className="rounded-xl border border-tinta px-3 py-2 text-sm font-medium"
            >
              Cargar
            </button>
          </div>
        </details>
      </div>

      {/* Diagnóstico y trabajo */}
      <div>
        <textarea
          placeholder="Diagnóstico: ¿qué tiene el equipo?"
          value={diagnostico}
          onChange={(e) => setDiagnostico(e.target.value)}
          rows={2}
          className={`${inputCls} w-full`}
        />
        <textarea
          placeholder="Trabajo realizado"
          value={trabajo}
          onChange={(e) => setTrabajo(e.target.value)}
          rows={3}
          className={`${inputCls} mt-2 w-full`}
        />
        <button
          onClick={guardarTextos}
          disabled={pending}
          className="mt-2 w-full rounded-xl border border-tinta py-2 text-sm font-medium disabled:opacity-50"
        >
          {guardado ? "✓ Guardado" : "Guardar diagnóstico y trabajo"}
        </button>
      </div>

      {/* Repuestos y gastos */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-piedra">
          Repuestos y gastos
        </h3>
        {items.length > 0 && (
          <ListaItems
            items={items}
            borrable
            onBorrar={(id) => accion(() => borrarItemOT(id))}
          />
        )}
        <form onSubmit={agregarItem} className="mt-2 space-y-2 rounded-xl bg-crema p-3">
          <div className="flex gap-2">
            <select value={itemTipo} onChange={(e) => setItemTipo(e.target.value as "refaccion" | "gasto")} className={inputCls}>
              <option value="refaccion">Repuesto</option>
              <option value="gasto">Gasto (ticket)</option>
            </select>
            {itemTipo === "refaccion" && repuestos.length > 0 && (
              <select value={itemRepuestoId} onChange={(e) => elegirRepuesto(e.target.value)} className={`${inputCls} min-w-0 flex-1`}>
                <option value="">Del catálogo…</option>
                {repuestos.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.codigo_interno ? `${r.codigo_interno} · ` : ""}{r.descripcion}
                  </option>
                ))}
              </select>
            )}
          </div>
          <input
            type="text"
            required
            placeholder={itemTipo === "gasto" ? "Descripción (peaje, materiales…)" : "Descripción del repuesto"}
            value={itemDesc}
            onChange={(e) => setItemDesc(e.target.value)}
            className={`${inputCls} w-full`}
          />
          <div className="flex gap-2">
            <input type="number" step="any" placeholder="Cant." value={itemCant} onChange={(e) => setItemCant(e.target.value)} className={`${inputCls} w-20`} />
            <input type="number" step="any" required placeholder="Precio unit. $" value={itemPrecio} onChange={(e) => setItemPrecio(e.target.value)} className={`${inputCls} flex-1`} />
            <select value={itemEstado} onChange={(e) => setItemEstado(e.target.value)} className={inputCls}>
              {ESTADOS_ITEM_OT.map((x) => (
                <option key={x.value} value={x.value}>{x.label}</option>
              ))}
            </select>
          </div>
          {itemTipo === "gasto" && (
            <label className="block text-xs text-piedra">
              Foto del ticket
              <input type="file" accept="image/*" capture="environment" onChange={(e) => setItemTicket(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-xs" />
            </label>
          )}
          <button type="submit" disabled={subiendo} className="w-full rounded-xl border border-tinta py-2 text-sm font-medium disabled:opacity-50">
            {subiendo ? "Subiendo…" : "+ Agregar"}
          </button>
        </form>
      </div>

      {/* Fotos antes / después */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-piedra">
          Fotos del trabajo
        </h3>
        {fotos.length > 0 && <GrillaFotos fotos={fotos} />}
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(["antes", "despues"] as const).map((m) => (
            <label key={m} className="block">
              <span className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-borde py-2 text-sm text-piedra">
                <Camera className="h-4 w-4" /> {m === "antes" ? "Antes" : "Después"}
              </span>
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => subirFoto(e.target.files?.[0] ?? null, m)} />
            </label>
          ))}
        </div>
      </div>

      <Firma ot={ot} firmaUrl={firmaUrl} />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="space-y-2">
        {transicionesTecnico
          .filter((t) => !["finalizado_tecnico"].includes(t))
          .map((t) => (
            <button
              key={t}
              onClick={() => accion(() => transicionarOT(ot.id, t))}
              disabled={pending}
              className="w-full rounded-xl border border-borde py-2 text-sm text-tinta/80 disabled:opacity-50"
            >
              {ETIQUETAS_TRANSICION[t] ?? t}
            </button>
          ))}
        {transicionesTecnico.includes("finalizado_tecnico") && (
          <button
            onClick={() => accion(() => finalizarOTTecnico(ot.id))}
            disabled={pending}
            className="w-full rounded-2xl bg-tinta py-3 font-semibold text-white disabled:opacity-60"
          >
            Finalizar trabajo (pasa a administración)
          </button>
        )}
      </div>
    </section>
  );
}

const ETIQUETAS_TRANSICION: Record<string, string> = {
  en_camino: "Marcar en camino",
  en_proceso: "Empezar / retomar trabajo",
  esperando_repuesto: "Necesito un repuesto",
  esperando_cliente: "Esperando respuesta del cliente",
};

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
          {i.tipo === "gasto" ? (
            <Receipt className="h-4 w-4 shrink-0 text-piedra" />
          ) : (
            <Cog className="h-4 w-4 shrink-0 text-piedra" />
          )}
          <span className="min-w-0 flex-1 truncate">
            {i.descripcion}
            {Number(i.cantidad) !== 1 ? ` × ${i.cantidad}` : ""}
          </span>
          <span className="shrink-0 rounded-full bg-crema px-2 py-0.5 text-[11px] text-piedra">
            {ESTADOS_ITEM_OT.find((x) => x.value === i.estado)?.label}
          </span>
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

function GrillaFotos({
  fotos,
}: {
  fotos: { id: string; momento: string; url: string | null }[];
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {fotos.map((f) =>
        f.url ? (
          <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer" className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.url} alt={`Foto ${f.momento}`} className="h-20 w-full rounded-lg border border-borde object-cover" />
            {f.momento !== "otro" && (
              <span className="absolute bottom-1 left-1 rounded bg-tinta/70 px-1 text-[10px] text-white">
                {f.momento}
              </span>
            )}
          </a>
        ) : null
      )}
    </div>
  );
}

function Firma({ ot, firmaUrl }: { ot: OrdenTrabajo; firmaUrl: string | null }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);
  const [hayTrazo, setHayTrazo] = useState(false);
  const [firmante, setFirmante] = useState(ot.firmante ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (firmaUrl) {
    return (
      <div>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-piedra">
          Firmado por {ot.firmante ?? "el cliente"} ✓
        </h3>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={firmaUrl} alt="Firma del cliente" className="h-20 rounded-lg border border-borde bg-white" />
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
    try {
      canvasRef.current!.setPointerCapture(e.pointerId);
    } catch {}
  }

  function mover(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dibujando.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#101828";
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
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-piedra">
        Firma y conformidad del cliente
      </h3>
      <input
        type="text"
        placeholder="Nombre de quien firma"
        value={firmante}
        onChange={(e) => setFirmante(e.target.value)}
        className="mb-2 w-full rounded-2xl border border-borde bg-white px-3 py-2 text-sm outline-none focus:border-tinta"
      />
      <canvas
        ref={canvasRef}
        width={600}
        height={200}
        onPointerDown={empezar}
        onPointerMove={mover}
        onPointerUp={() => (dibujando.current = false)}
        className="w-full touch-none rounded-2xl border border-borde bg-white"
      />
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={limpiar} className="rounded-lg border border-borde px-3 py-1.5 text-xs">
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
