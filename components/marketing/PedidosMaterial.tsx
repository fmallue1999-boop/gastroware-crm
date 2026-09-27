"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { actualizarPedidoMaterial, pedirMaterial } from "@/lib/actions";
import { fechaCorta } from "@/lib/format";

export type PedidoMaterial = {
  id: string;
  titulo: string;
  detalle: string | null;
  para_fecha: string | null;
  estado: "pedido" | "en_curso" | "entregado";
  fecha_comprometida: string | null;
  entregado_at: string | null;
  created_at: string;
  quien: string | null;
};

const cls = "min-h-11 w-full rounded-xl border border-borde bg-white px-3 text-[15px] outline-none focus:border-marino";
const ESTADO: Record<string, { label: string; color: string }> = {
  pedido: { label: "Pedido", color: "bg-ambar-soft text-ambar" },
  en_curso: { label: "En curso", color: "bg-azul-soft text-azul" },
  entregado: { label: "Entregado", color: "bg-verde-soft text-verde" },
};

function Fila({ p, gestiona }: { p: PedidoMaterial; gestiona: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fecha, setFecha] = useState(p.fecha_comprometida ?? "");
  const mover = (estado: PedidoMaterial["estado"]) =>
    startTransition(async () => {
      await actualizarPedidoMaterial(p.id, { estado, fechaComprometida: fecha || null });
      router.refresh();
    });
  return (
    <div className={`rounded-2xl bg-white p-3.5 shadow-sm ${p.estado === "entregado" ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${ESTADO[p.estado].color}`}>{ESTADO[p.estado].label}</span>
        <p className="text-[16px] font-extrabold">{p.titulo}</p>
      </div>
      {p.detalle && <p className="mt-1 text-[15px]">{p.detalle}</p>}
      <p className="text-xs text-piedra">
        {p.quien ?? "—"} · pedido {fechaCorta(p.created_at)}
        {p.para_fecha ? ` · lo necesita para el ${fechaCorta(p.para_fecha)}` : ""}
        {p.fecha_comprometida ? ` · marketing lo entrega el ${fechaCorta(p.fecha_comprometida)}` : ""}
      </p>
      {gestiona && p.estado !== "entregado" && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1 text-[14px] text-piedra">
            Entrego el
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="min-h-10 rounded-xl border border-borde bg-white px-2 text-[14px]" />
          </label>
          <button type="button" disabled={pending} onClick={() => mover("en_curso")} className="min-h-10 rounded-xl border border-borde bg-white px-3 text-[14px] font-bold">
            En curso
          </button>
          <button type="button" disabled={pending} onClick={() => mover("entregado")} className="min-h-10 rounded-xl bg-verde px-3 text-[14px] font-bold text-white">
            Entregado
          </button>
        </div>
      )}
    </div>
  );
}

/** Pedidos de material a marketing: cualquiera pide; marketing compromete fecha y entrega. */
export default function PedidosMaterial({ pedidos, gestiona }: { pedidos: PedidoMaterial[]; gestiona: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [detalle, setDetalle] = useState("");
  const [para, setPara] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abiertos = pedidos.filter((p) => p.estado !== "entregado");
  const entregados = pedidos.filter((p) => p.estado === "entregado");

  return (
    <div className="space-y-3">
      {abierto ? (
        <form
          className="space-y-2 rounded-2xl bg-white p-4 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            startTransition(async () => {
              const r = await pedirMaterial({ titulo, detalle, paraFecha: para || null });
              if (r && "error" in r && r.error) setError(r.error);
              else {
                setAbierto(false);
                setTitulo("");
                setDetalle("");
                setPara("");
                router.refresh();
              }
            });
          }}
        >
          <input required value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="¿Qué necesitás? (folleto, video, ficha, posteo…)" className={cls} />
          <textarea value={detalle} onChange={(e) => setDetalle(e.target.value)} rows={2} placeholder="Para qué cliente o evento, detalles" className={`${cls} py-2`} />
          <label className="flex items-center gap-2 text-[14px] text-piedra">
            Lo necesito para el
            <input type="date" value={para} onChange={(e) => setPara(e.target.value)} className={cls} />
          </label>
          {error && <p className="text-[14px] font-bold text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button disabled={pending} className="min-h-11 rounded-xl bg-marino px-4 text-[15px] font-extrabold text-white disabled:opacity-50">
              Pedir
            </button>
            <button type="button" onClick={() => setAbierto(false)} className="min-h-11 rounded-xl border border-borde px-4 text-[15px] text-piedra">
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setAbierto(true)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-marino px-4 text-[15px] font-extrabold text-white">
          <Plus className="h-4 w-4" /> Pedir material
        </button>
      )}
      {abiertos.length === 0 && <p className="rounded-2xl border border-dashed border-borde p-6 text-center text-[15px] text-piedra">No hay pedidos abiertos.</p>}
      <div className="grid gap-2 lg:grid-cols-2">
        {abiertos.map((p) => (
          <Fila key={p.id} p={p} gestiona={gestiona} />
        ))}
      </div>
      {entregados.length > 0 && (
        <details>
          <summary className="cursor-pointer text-[15px] font-bold text-piedra">Entregados ({entregados.length})</summary>
          <div className="mt-2 grid gap-2 lg:grid-cols-2">
            {entregados.map((p) => (
              <Fila key={p.id} p={p} gestiona={false} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
