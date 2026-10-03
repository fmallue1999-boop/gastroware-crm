"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Paperclip, Send } from "lucide-react";
import { rendirGastos } from "@/lib/actions/viaticos";
import { nombreCategoria, nombreMedio, textoTotales, totalPorMoneda } from "@/lib/viaticos";
import { fechaCorta, dinero } from "@/lib/format";

export type GastoLista = {
  id: string;
  fecha: string;
  categoria: string;
  importe: number;
  moneda: string;
  medio_pago: string;
  comercio: string | null;
  detalle: string | null;
  conComprobante: boolean;
  cliente: string | null;
};

/**
 * Los gastos propios sin rendir (v1.25): se tildan los que se rinden (todos
 * de entrada), se ve el total y se mandan a dirección con un toque.
 */
export default function RendirGastos({ gastos }: { gastos: GastoLista[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [elegidos, setElegidos] = useState<Set<string>>(() => new Set(gastos.map((g) => g.id)));
  const [nota, setNota] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Si cambia la lista (se cargó o borró un gasto), los nuevos entran tildados
  const [ids, setIds] = useState(() => gastos.map((g) => g.id).join(","));
  const idsAhora = gastos.map((g) => g.id).join(",");
  if (ids !== idsAhora) {
    setIds(idsAhora);
    setElegidos(new Set(gastos.map((g) => g.id)));
  }

  const seleccion = gastos.filter((g) => elegidos.has(g.id));
  const total = textoTotales(totalPorMoneda(seleccion));
  const sinComprobante = seleccion.filter((g) => !g.conComprobante).length;

  function alternar(id: string) {
    setConfirmando(false);
    setElegidos((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function rendir() {
    setError(null);
    startTransition(async () => {
      const r = await rendirGastos([...elegidos], nota);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      router.push(`/viaticos/rendicion/${r.id}`);
    });
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-borde/70 overflow-hidden rounded-2xl border border-borde bg-white">
        {gastos.map((g) => (
          <li key={g.id} className="flex items-center gap-3 px-3 py-2.5">
            <input
              type="checkbox"
              checked={elegidos.has(g.id)}
              onChange={() => alternar(g.id)}
              className="h-5 w-5 shrink-0 accent-marino"
              aria-label={`Rendir el gasto del ${fechaCorta(g.fecha)}`}
            />
            <Link href={`/viaticos/gasto/${g.id}`} className="flex min-w-0 flex-1 items-center gap-2">
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-[15px] font-bold">{nombreCategoria(g.categoria)}</span>
                  <span className="text-[15px]">{dinero(g.importe, g.moneda)}</span>
                  {!g.conComprobante && <span className="text-xs font-bold text-ambar">sin comprobante</span>}
                </span>
                <span className="block truncate text-[13px] text-piedra">
                  {fechaCorta(g.fecha)} · {[g.comercio, g.detalle, g.cliente].filter(Boolean).join(" · ") || "sin detalle"}
                  {g.medio_pago !== "propio" ? ` · ${nombreMedio(g.medio_pago)}` : ""}
                </span>
              </span>
              {g.conComprobante && <Paperclip className="h-4 w-4 shrink-0 text-piedra" aria-label="Con comprobante" />}
              <ChevronRight className="h-4 w-4 shrink-0 text-piedra/60" />
            </Link>
          </li>
        ))}
      </ul>

      <div className="space-y-2 rounded-2xl bg-white p-3.5 shadow-sm">
        <p className="text-[15px]">
          {seleccion.length ? (
            <>
              <span className="font-extrabold">
                {seleccion.length} {seleccion.length === 1 ? "gasto" : "gastos"}
              </span>{" "}
              por <span className="font-extrabold">{total}</span>
              {sinComprobante > 0 && <span className="text-ambar"> · {sinComprobante} sin comprobante</span>}
            </>
          ) : (
            <span className="text-piedra">Tildá los gastos que rendís.</span>
          )}
        </p>
        {confirmando ? (
          <div className="space-y-2">
            <input
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              maxLength={500}
              placeholder="Comentario para dirección (opcional): ej. viaje a Rosario"
              className="min-h-11 w-full min-w-0 rounded-xl border border-borde bg-white px-3 text-[15px] outline-none focus:border-marino"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={rendir}
                disabled={pending || !seleccion.length}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-marino px-4 text-[15px] font-extrabold text-white disabled:opacity-50 sm:flex-none"
              >
                <Send className="h-4 w-4" /> {pending ? "Mandando…" : "Mandar a dirección"}
              </button>
              <button type="button" onClick={() => setConfirmando(false)} className="min-h-11 px-3 text-[15px] text-piedra underline">
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            disabled={!seleccion.length}
            className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-marino px-4 text-[15px] font-extrabold text-white disabled:opacity-50 sm:w-auto"
          >
            <Send className="h-4 w-4" /> Rendir {seleccion.length === gastos.length ? "todo" : `${seleccion.length} ${seleccion.length === 1 ? "gasto" : "gastos"}`}
          </button>
        )}
        {error && <p className="text-[14px] font-bold text-red-600">{error}</p>}
      </div>
    </div>
  );
}
