import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, FileText, Maximize2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { dinero, fechaCorta, hoyISO } from "@/lib/format";
import { ETAPAS, ETAPAS_ABIERTAS } from "@/lib/constants";
import { textoProximo } from "@/components/PuntoNivel";
import BotonesPdfCotizacion from "@/components/BotonesPdfCotizacion";
import ConversacionInteres from "@/components/ConversacionInteres";

type Opp = {
  id: string;
  cliente_id: string;
  etapa: string;
  mensaje_inicial: string | null;
  proximo_contacto: string | null;
  proximo_nota: string | null;
  proxima_accion: string | null;
  proximo_hora: string | null;
  pedido_estado: string | null;
  producto: { nombre: string } | null;
  cliente: { nombre_comercial: string } | null;
  comercial: { nombre: string | null } | null;
  cotizaciones: {
    id: string;
    numero: number;
    versiones: { version: number; total: number | null; moneda: string; iva_pct: number | null; created_at: string; aprobacion: string | null }[] | null;
  }[] | null;
};

/**
 * La conversación del equipo de un interés en pantalla propia (v1.26):
 * adonde llevan los avisos ("te mencionó", "escribió") y el embudo. Arriba,
 * de qué interés se trata; abajo, el chat.
 */
export default async function ConversacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase
    .from("oportunidades")
    .select(
      "id, cliente_id, etapa, mensaje_inicial, proximo_contacto, proximo_nota, proxima_accion, proximo_hora, pedido_estado, producto:productos(nombre), cliente:clientes(nombre_comercial), comercial:usuarios!oportunidades_comercial_id_fkey(nombre), cotizaciones(id, numero, versiones:cotizacion_versiones(version, total, moneda, iva_pct, created_at, aprobacion))"
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const o = data as unknown as Opp;
  const abierto = (ETAPAS_ABIERTAS as readonly string[]).includes(o.etapa);
  const etapa = ETAPAS.find((e) => e.value === o.etapa)?.label ?? o.etapa;
  const prox = abierto ? textoProximo(o.proximo_contacto, o.proximo_nota, hoyISO(), o.proxima_accion, o.proximo_hora) : null;
  const cot = [...(o.cotizaciones ?? [])].sort((a, b) => b.numero - a.numero)[0] ?? null;
  const vigente = cot ? [...(cot.versiones ?? [])].sort((a, b) => b.version - a.version)[0] ?? null : null;
  const bloqueada = vigente?.aprobacion === "pendiente" || vigente?.aprobacion === "rechazada";
  const ficha = `/clientes/${o.cliente_id}${abierto ? `?interes=${o.id}` : ""}`;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href={ficha} className="inline-flex min-h-10 items-center gap-1 text-[14px] font-bold text-piedra hover:text-marino">
        <ChevronLeft className="h-4 w-4" /> {o.cliente?.nombre_comercial ?? "Volver"}
      </Link>

      <div className="space-y-2 rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[17px] font-extrabold leading-tight">{o.cliente?.nombre_comercial ?? "Contacto"}</p>
            <p className="text-[15px] text-tinta/80">{o.producto?.nombre ?? o.mensaje_inicial ?? "Interés"}</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px]">
              <span className="rounded-full bg-crema px-2 py-0.5 text-xs font-bold text-tinta/80">{etapa}</span>
              {o.comercial?.nombre && <span className="text-piedra">lo atiende {o.comercial.nombre}</span>}
              {prox && <span className={prox.clase}>· {prox.texto}</span>}
            </p>
          </div>
          <Link
            href={ficha}
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border border-borde bg-white px-3 text-[14px] font-bold text-tinta"
          >
            <Maximize2 className="h-4 w-4" /> Abrir ficha
          </Link>
        </div>
        {cot && vigente && (
          <div className="space-y-2 rounded-xl bg-crema p-3">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px]">
              <FileText className="h-4 w-4 text-piedra" />
              <span className="font-bold">
                Cotización N° {cot.numero}
                {vigente.version > 1 ? ` v${vigente.version}` : ""}
              </span>
              <span>
                {dinero(vigente.total ?? 0, vigente.moneda)}
                {Number(vigente.iva_pct ?? 0) > 0 ? " + IVA" : ""}
              </span>
              <span className="text-sm text-piedra">· {fechaCorta(vigente.created_at)}</span>
              {vigente.aprobacion === "pendiente" && <span className="rounded-full bg-ambar-soft px-2 py-0.5 text-xs font-bold text-ambar">esperando aprobación</span>}
              {vigente.aprobacion === "rechazada" && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-600">rechazada</span>}
            </p>
            {!bloqueada && <BotonesPdfCotizacion cotizacionId={cot.id} version={vigente.version} compacto />}
          </div>
        )}
      </div>

      <ConversacionInteres oportunidadId={o.id} pagina />
    </div>
  );
}
