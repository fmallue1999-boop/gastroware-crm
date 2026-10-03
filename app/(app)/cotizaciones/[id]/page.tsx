import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { dinero, fechaCorta } from "@/lib/format";
import { ETAPAS_ABIERTAS } from "@/lib/constants";
import BotonesPdfCotizacion from "@/components/BotonesPdfCotizacion";
import ConversacionCotizacion from "@/components/ConversacionCotizacion";

type Cot = {
  id: string;
  numero: number;
  oportunidad: {
    id: string;
    cliente_id: string;
    etapa: string;
    mensaje_inicial: string | null;
    producto: { nombre: string } | null;
    cliente: { nombre_comercial: string } | null;
  } | null;
  versiones: { version: number; total: number | null; moneda: string; iva_pct: number | null; created_at: string; aprobacion: string | null; aprobacion_nota: string | null }[] | null;
};

/**
 * La conversación de una cotización en pantalla propia (v1.24): adonde
 * llevan los avisos de "te mencionó" y "escribió en la cotización".
 */
export default async function ConversacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase
    .from("cotizaciones")
    .select(
      "id, numero, oportunidad:oportunidades(id, cliente_id, etapa, mensaje_inicial, producto:productos(nombre), cliente:clientes(nombre_comercial)), versiones:cotizacion_versiones(version, total, moneda, iva_pct, created_at, aprobacion, aprobacion_nota)"
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const c = data as unknown as Cot;
  const opp = c.oportunidad;
  const vigente = [...(c.versiones ?? [])].sort((a, b) => b.version - a.version)[0] ?? null;
  const abierta = Boolean(opp && (ETAPAS_ABIERTAS as readonly string[]).includes(opp.etapa));
  const ficha = opp ? `/clientes/${opp.cliente_id}${abierta ? `?interes=${opp.id}` : "?tab=cotizaciones"}` : "/clientes";
  const bloqueada = vigente?.aprobacion === "pendiente" || vigente?.aprobacion === "rechazada";

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href={ficha} className="inline-flex min-h-10 items-center gap-1 text-[14px] font-bold text-piedra hover:text-marino">
        <ChevronLeft className="h-4 w-4" /> {opp?.cliente?.nombre_comercial ?? "Volver"}
      </Link>

      <div className="space-y-2 rounded-2xl bg-white p-4 shadow-sm">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[16px]">
          <FileText className="h-4 w-4 text-piedra" />
          <span className="font-extrabold">
            Cotización N° {c.numero}
            {vigente && vigente.version > 1 ? ` v${vigente.version}` : ""}
          </span>
          {vigente && (
            <span>
              {dinero(vigente.total ?? 0, vigente.moneda)}
              {Number(vigente.iva_pct ?? 0) > 0 ? " + IVA" : ""}
            </span>
          )}
          {vigente && <span className="text-sm text-piedra">· {fechaCorta(vigente.created_at)}</span>}
          {vigente?.aprobacion === "pendiente" && <span className="rounded-full bg-ambar-soft px-2 py-0.5 text-xs font-bold text-ambar">esperando aprobación</span>}
          {vigente?.aprobacion === "rechazada" && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-600">rechazada</span>}
        </p>
        <p className="text-[15px] text-piedra">
          {opp?.cliente?.nombre_comercial ?? "Contacto"} · {opp?.producto?.nombre ?? opp?.mensaje_inicial ?? "Interés"}
        </p>
        {vigente && !bloqueada && <BotonesPdfCotizacion cotizacionId={c.id} version={vigente.version} />}
      </div>

      <ConversacionCotizacion cotizacionId={c.id} pagina />
    </div>
  );
}
