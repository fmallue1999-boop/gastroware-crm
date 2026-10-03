import Link from "next/link";
import type { ReactNode } from "react";
import { FileText, Sparkles } from "lucide-react";
import { dinero, fechaCorta } from "@/lib/format";
import { nombreCategoria, nombreMedio } from "@/lib/viaticos";
import type { Gasto } from "@/lib/servidor/viaticos";

/** Un gasto de viáticos con su comprobante y lo que decidió dirección (v1.25). */
export default function TarjetaGasto({ g, url, children }: { g: Gasto; url?: string | null; children?: ReactNode }) {
  const pdf = (g.archivo_path ?? "").toLowerCase().endsWith(".pdf");
  const comprobante = [g.tipo_comprobante, g.numero_comprobante].filter(Boolean).join(" ");
  return (
    <div className={`space-y-2 rounded-2xl bg-white p-3.5 shadow-sm ${g.decision === "rechazado" ? "ring-1 ring-red-200" : ""}`}>
      <div className="flex gap-3">
        {g.archivo_path && url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" className="shrink-0" aria-label="Ver el comprobante">
            {pdf ? (
              <span className="flex h-20 w-16 items-center justify-center rounded-xl bg-crema text-piedra">
                <FileText className="h-7 w-7" />
              </span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt="Comprobante" className="h-20 w-16 rounded-xl object-cover" />
            )}
          </a>
        ) : (
          <span className="flex h-20 w-16 shrink-0 items-center justify-center rounded-xl border border-dashed border-borde text-center text-[11px] leading-tight text-ambar">
            sin compro&shy;bante
          </span>
        )}
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-[16px] font-extrabold">{dinero(g.importe, g.moneda)}</span>
            <span className="text-[15px] font-bold">{nombreCategoria(g.categoria)}</span>
            <span className="text-[13px] text-piedra">{fechaCorta(g.fecha)}</span>
          </p>
          <p className="text-[14px] text-tinta/80">
            {nombreMedio(g.medio_pago)}
            {g.comercio ? ` · ${g.comercio}` : ""}
          </p>
          {(g.cuit || comprobante || g.iva) && (
            <p className="text-[13px] text-piedra">{[g.cuit ? `CUIT ${g.cuit}` : null, comprobante || null, g.iva ? `IVA ${dinero(g.iva, g.moneda)}` : null].filter(Boolean).join(" · ")}</p>
          )}
          {g.detalle && <p className="text-[14px]">{g.detalle}</p>}
          {g.cliente && g.cliente_id && (
            <Link href={`/clientes/${g.cliente_id}`} className="text-[14px] font-bold text-azul underline">
              Visita: {g.cliente.nombre_comercial}
            </Link>
          )}
          {g.leido_por_ia && (
            <p className="flex items-center gap-1 text-[12px] text-violeta">
              <Sparkles className="h-3 w-3" /> Datos leídos por la IA
            </p>
          )}
        </div>
      </div>
      {g.decision === "aprobado" && <p className="rounded-xl bg-verde-soft px-3 py-1.5 text-[14px] font-bold text-verde">✓ Aprobado</p>}
      {g.decision === "rechazado" && <p className="rounded-xl bg-red-50 px-3 py-1.5 text-[14px] font-bold text-red-600">Rechazado: {g.motivo_rechazo}</p>}
      {children}
    </div>
  );
}
