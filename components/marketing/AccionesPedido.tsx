"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Send, X } from "lucide-react";
import { actualizarPedidoMaterial, cancelarPedidoMaterial, decidirPedidoContenido, elegirDestinoPedido, enviarPedidoAprobar } from "@/lib/actions";
import { sePuedeTrabajar } from "@/lib/pedidos-contenido";

const btn = "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-4 text-[15px] font-bold disabled:opacity-50";
const campo = "min-h-11 w-full rounded-xl border border-borde bg-white px-3 text-[15px] outline-none focus:border-marino";

/**
 * Lo que se hace con un pedido de contenido según quién sos (v1.23):
 * marketing lo toma, elige dónde va a quedar en Material y lo manda a
 * aprobar; dirección aprueba o pide cambios; quien lo pidió puede cancelarlo.
 */
export default function AccionesPedido({
  pedido,
  hacePedidos,
  esDireccion,
  esMio,
  archivos,
  espacios,
}: {
  pedido: { id: string; estado: string; espacio_destino_id: string | null; fecha_comprometida: string | null };
  /** Marketing (o gestor): lo toma, sube y manda a aprobar. */
  hacePedidos: boolean;
  esDireccion: boolean;
  esMio: boolean;
  /** Cuántos archivos entregó. */
  archivos: number;
  /** Espacios de Material donde puede quedar. */
  espacios: { id: string; etiqueta: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fecha, setFecha] = useState(pedido.fecha_comprometida ?? "");
  const [destino, setDestino] = useState(pedido.espacio_destino_id ?? "");
  const [cambios, setCambios] = useState(false);
  const [correccion, setCorreccion] = useState("");
  const [msg, setMsg] = useState<{ texto: string; error?: boolean } | null>(null);
  const trabajable = sePuedeTrabajar(pedido.estado);

  function correr(fn: () => Promise<{ error?: string } | { ok: true }>, ok: string) {
    setMsg(null);
    startTransition(async () => {
      const r = (await fn()) as { error?: string };
      if (r?.error) setMsg({ texto: r.error, error: true });
      else {
        setMsg({ texto: ok });
        setCambios(false);
        router.refresh();
      }
    });
  }

  const partes: React.ReactNode[] = [];

  // Marketing: tomarlo, fecha, dónde queda y mandarlo a aprobar
  if (hacePedidos && trabajable) {
    partes.push(
      <div key="mkt" className="space-y-3 rounded-2xl border border-borde bg-white p-3.5 shadow-sm">
        <p className="text-[15px] font-extrabold">Marketing</p>
        <label className="flex flex-wrap items-center gap-2 text-[14px] text-piedra">
          Lo doy para el
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="min-h-11 rounded-xl border border-borde bg-white px-3 text-[15px]" />
          <button
            type="button"
            disabled={pending}
            onClick={() => correr(() => actualizarPedidoMaterial(pedido.id, { estado: "en_curso", fechaComprometida: fecha || null }), pedido.estado === "pedido" ? "Lo tomaste" : "Guardado")}
            className={`${btn} border border-marino bg-white text-marino`}
          >
            {pedido.estado === "pedido" ? "Lo tomo" : "Guardar fecha"}
          </button>
        </label>
        <label className="block text-[14px] text-piedra">
          Cuando se apruebe, queda en Material en:
          <select
            value={destino}
            onChange={(e) => {
              setDestino(e.target.value);
              correr(() => elegirDestinoPedido(pedido.id, e.target.value || null), "Guardado");
            }}
            className={`${campo} mt-1`}
          >
            <option value="">Pedidos aprobados (después lo acomodás)</option>
            {espacios.map((e) => (
              <option key={e.id} value={e.id}>
                {e.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={pending || archivos === 0}
          onClick={() => correr(() => enviarPedidoAprobar(pedido.id), "Mandado a dirección para aprobar")}
          className={`${btn} w-full bg-marino text-white`}
        >
          <Send className="h-4 w-4" /> Mandar a aprobar{archivos ? ` (${archivos} archivo${archivos === 1 ? "" : "s"})` : ""}
        </button>
        {archivos === 0 && <p className="text-xs text-piedra">Subí arriba lo que hiciste para poder mandarlo a aprobar.</p>}
      </div>
    );
  }

  // Dirección: aprobar o pedir cambios
  if (esDireccion && pedido.estado === "para_aprobar") {
    partes.push(
      <div key="dir" className="space-y-2 rounded-2xl border-2 border-violeta/40 bg-violeta-soft p-3.5">
        <p className="text-[15px] font-extrabold">¿Lo aprobás?</p>
        {cambios ? (
          <>
            <textarea value={correccion} onChange={(e) => setCorreccion(e.target.value)} rows={3} placeholder="¿Qué hay que cambiar?" className={`${campo} py-2`} />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pending || !correccion.trim()}
                onClick={() => correr(() => decidirPedidoContenido(pedido.id, "cambios", correccion), "Le pediste cambios a marketing")}
                className={`${btn} flex-1 bg-naranja text-white`}
              >
                Pedir cambios
              </button>
              <button type="button" onClick={() => setCambios(false)} className={`${btn} border border-borde bg-white`}>
                Volver
              </button>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => correr(() => decidirPedidoContenido(pedido.id, "aprobado"), "Aprobado: quedó en Material")}
              className={`${btn} bg-verde text-white`}
            >
              <Check className="h-4 w-4" /> Aprobar
            </button>
            <button type="button" disabled={pending} onClick={() => setCambios(true)} className={`${btn} border border-naranja bg-white text-naranja`}>
              Pedir cambios
            </button>
          </div>
        )}
      </div>
    );
  }

  // Cancelar: dirección siempre que no esté cerrado; quien lo pidió mientras se trabaja
  const puedeCancelar = (esDireccion && !["aprobado", "entregado", "cancelado"].includes(pedido.estado)) || (esMio && trabajable);
  if (puedeCancelar) {
    partes.push(
      <button
        key="cancelar"
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm("¿Cancelar este pedido?")) return;
          correr(() => (esDireccion ? decidirPedidoContenido(pedido.id, "cancelado") : cancelarPedidoMaterial(pedido.id)), "Pedido cancelado");
        }}
        className="inline-flex min-h-10 items-center gap-1 text-[14px] font-semibold text-piedra underline"
      >
        <X className="h-4 w-4" /> Cancelar el pedido
      </button>
    );
  }

  if (!partes.length && !msg) return null;
  return (
    <div className="space-y-3">
      {partes}
      {msg && <p className={`text-[15px] font-bold ${msg.error ? "text-red-600" : "text-verde"}`}>{msg.error ? msg.texto : `✓ ${msg.texto}`}</p>}
    </div>
  );
}
