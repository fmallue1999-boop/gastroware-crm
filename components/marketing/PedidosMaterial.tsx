"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Paperclip, Plus } from "lucide-react";
import { pedirMaterial } from "@/lib/actions";
import { fechaCorta } from "@/lib/format";
import { ESTADOS_PEDIDO, agruparPedidos, estadoDe } from "@/lib/pedidos-contenido";

export type PedidoMaterial = {
  id: string;
  titulo: string;
  detalle: string | null;
  para_fecha: string | null;
  estado: string;
  fecha_comprometida: string | null;
  entregado_at: string | null;
  created_at: string;
  quien: string | null;
  /** Quién de marketing lo está haciendo. */
  hace: string | null;
  /** Cuántos archivos entregó marketing (o quedaron en Material). */
  archivos: number;
};

const cls = "min-h-11 w-full rounded-xl border border-borde bg-white px-3 text-[15px] outline-none focus:border-marino";

function Fila({ p }: { p: PedidoMaterial }) {
  const e = ESTADOS_PEDIDO[estadoDe(p.estado)];
  return (
    <Link href={`/marketing/pedidos/${p.id}`} className="flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-sm hover:bg-crema/50">
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${e.clase}`}>{e.label}</span>
          <span className="min-w-0 text-[16px] font-extrabold">{p.titulo}</span>
        </span>
        {p.detalle && <span className="mt-0.5 line-clamp-2 block text-[14px] text-tinta/80">{p.detalle}</span>}
        <span className="mt-1 block text-xs text-piedra">
          {p.quien ? `Lo pidió ${p.quien}` : "Pedido"} · {fechaCorta(p.created_at)}
          {p.para_fecha ? ` · lo necesita para el ${fechaCorta(p.para_fecha)}` : ""}
          {p.fecha_comprometida ? ` · marketing lo da el ${fechaCorta(p.fecha_comprometida)}` : ""}
          {p.hace ? ` · lo hace ${p.hace}` : ""}
        </span>
      </span>
      {p.archivos > 0 && (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-crema px-2 py-0.5 text-xs font-bold text-piedra">
          <Paperclip className="h-3 w-3" /> {p.archivos}
        </span>
      )}
      <ChevronRight className="h-5 w-5 shrink-0 text-piedra" />
    </Link>
  );
}

/**
 * Pedidos de contenido a marketing (v1.23): pedir uno nuevo y la lista por
 * estado (primero lo que está para aprobar y lo que tiene cambios). Cada
 * pedido se abre en su página: archivos, aprobación y dónde queda en Material.
 */
export default function PedidosMaterial({ pedidos }: { pedidos: PedidoMaterial[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [detalle, setDetalle] = useState("");
  const [fecha, setFecha] = useState("");
  const [error, setError] = useState<string | null>(null);
  const grupos = agruparPedidos(pedidos);
  const cerrados = new Set(["aprobado", "entregado", "cancelado"]);

  return (
    <div className="space-y-4">
      {abierto ? (
        <form
          className="space-y-2 rounded-2xl bg-white p-3.5 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            startTransition(async () => {
              const r = await pedirMaterial({ titulo, detalle, paraFecha: fecha || null });
              if ("error" in r && r.error) return setError(r.error);
              setTitulo("");
              setDetalle("");
              setFecha("");
              setAbierto(false);
              router.refresh();
            });
          }}
        >
          <p className="text-[15px] font-extrabold">Pedir contenido a marketing</p>
          <input autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="¿Qué necesitás? (ej: flyer de la Speed Up para feria)" className={cls} />
          <textarea value={detalle} onChange={(e) => setDetalle(e.target.value)} rows={3} placeholder="Detalle: para qué es, medidas, texto, dónde se usa…" className={`${cls} py-2`} />
          <label className="flex items-center gap-2 text-[14px] text-piedra">
            Lo necesito para el
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="min-h-11 rounded-xl border border-borde bg-white px-3 text-[15px]" />
          </label>
          {error && <p className="text-sm font-bold text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={pending || !titulo.trim()} className="min-h-11 rounded-xl bg-marino px-4 text-[15px] font-bold text-white disabled:opacity-50">
              {pending ? "Pidiendo…" : "Pedir"}
            </button>
            <button type="button" onClick={() => setAbierto(false)} className="min-h-11 rounded-xl border border-borde bg-white px-4 text-[15px]">
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setAbierto(true)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-marino px-4 text-[15px] font-bold text-white">
          <Plus className="h-4 w-4" /> Pedir contenido
        </button>
      )}

      {grupos.length === 0 && <p className="rounded-2xl border border-dashed border-borde p-6 text-center text-[15px] text-piedra">Todavía no hay pedidos.</p>}
      {grupos.map((g) =>
        cerrados.has(g.estado) ? (
          <details key={g.estado} className="group">
            <summary className="min-h-10 cursor-pointer list-none text-xs font-bold uppercase tracking-wide text-piedra [&::-webkit-details-marker]:hidden">
              {ESTADOS_PEDIDO[g.estado].label} ({g.pedidos.length}) ▾
            </summary>
            <div className="mt-2 space-y-2">
              {g.pedidos.map((p) => (
                <Fila key={p.id} p={p} />
              ))}
            </div>
          </details>
        ) : (
          <section key={g.estado} className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-piedra">
              {ESTADOS_PEDIDO[g.estado].label} ({g.pedidos.length})
            </p>
            {g.pedidos.map((p) => (
              <Fila key={p.id} p={p} />
            ))}
          </section>
        )
      )}
    </div>
  );
}
