"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, MessageCircle } from "lucide-react";
import { aprobarCondicion, registrarCobro, registrarPromesa, registrarSinRespuesta } from "@/lib/actions";
import { dinero, fechaCorta, linkWhatsApp, sumarDias } from "@/lib/format";
import { diasDeAtraso, mensajeReclamo } from "@/lib/cobranzas";
import LinkContacto from "@/components/LinkContacto";

export type FacturaFila = {
  id: string;
  cliente_id: string;
  numero: string;
  tipo: string;
  fecha: string;
  vencimiento: string | null;
  monto: number | null;
  moneda: string;
  cobro_estado: string;
  promesa_fecha: string | null;
  ultimo_reclamo_at: string | null;
  condicion_aprobada_at: string | null;
  condicion_nota: string | null;
  oportunidad_id: string | null;
  cliente: { nombre_comercial: string; telefono: string | null } | null;
  frenaDespacho?: boolean;
};

const TIPO: Record<string, string> = { venta: "Venta", servicio: "Service", consumible: "Consumible", repuesto: "Repuesto" };

/** Una factura para cobrar: cobrado, prometió (fecha), sin respuesta, reclamar por WhatsApp; dirección aprueba condición. */
export default function CobranzaFila({ f, hoy, puedeAprobar }: { f: FacturaFila; hoy: string; puedeAprobar: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [modo, setModo] = useState<null | "promesa" | "condicion">(null);
  const [fecha, setFecha] = useState(sumarDias(2, hoy));
  const [texto, setTexto] = useState("");
  const [msg, setMsg] = useState<{ texto: string; alerta?: boolean } | null>(null);
  const atraso = diasDeAtraso(f.vencimiento, hoy);
  const cobrada = f.cobro_estado === "cobrado";

  function correr(fn: () => Promise<{ error?: string; aviso?: string } | { ok: true; aviso?: string }>, ok: string) {
    setMsg(null);
    startTransition(async () => {
      const r = (await fn()) as { error?: string; aviso?: string };
      if (r?.error) setMsg({ texto: r.error, alerta: true });
      else {
        setModo(null);
        setMsg(r?.aviso ? { texto: r.aviso, alerta: true } : { texto: ok });
        router.refresh();
      }
    });
  }

  const montoTexto = f.monto != null ? dinero(f.monto, f.moneda) : "";
  return (
    <div className={`rounded-2xl bg-white p-3.5 shadow-sm ${cobrada ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <LinkContacto id={f.cliente_id} className="block truncate text-[16px] font-extrabold hover:underline">
            {f.cliente?.nombre_comercial ?? "Cliente"}
          </LinkContacto>
          <p className="text-[14px] text-tinta/80">
            {TIPO[f.tipo] ?? f.tipo} · factura {f.numero}
            {f.vencimiento ? ` · vence ${fechaCorta(f.vencimiento)}` : ""}
          </p>
          {atraso > 0 && !cobrada && <p className="text-[14px] font-bold text-red-600">{atraso} días de atraso</p>}
          {f.cobro_estado === "prometido" && f.promesa_fecha && (
            <p className="text-[14px] font-bold text-azul">Prometió pagar el {fechaCorta(f.promesa_fecha)}</p>
          )}
          {f.cobro_estado === "sin_respuesta" && <p className="text-[14px] font-bold text-ambar">Reclamada sin respuesta</p>}
          {f.frenaDespacho && !cobrada && (
            <p className="text-[14px] font-bold text-violeta">Frena un despacho: sin cobro no se prepara</p>
          )}
          {f.condicion_aprobada_at && <p className="text-xs text-piedra">Condición aprobada: {f.condicion_nota}</p>}
          {f.ultimo_reclamo_at && !cobrada && <p className="text-xs text-piedra">Último reclamo {fechaCorta(f.ultimo_reclamo_at)}</p>}
        </div>
        <p className="shrink-0 text-[17px] font-extrabold">{montoTexto || "—"}</p>
      </div>

      {!cobrada &&
        (modo === "promesa" ? (
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              type="date"
              value={fecha}
              min={hoy}
              onChange={(e) => setFecha(e.target.value)}
              className="min-h-11 rounded-xl border border-borde bg-white px-3 text-[15px]"
            />
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Comentario (opcional)"
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-borde bg-white px-3 text-[15px]"
            />
            <button
              type="button"
              disabled={pending}
              onClick={() => correr(() => registrarPromesa(f.id, fecha, texto), "Promesa anotada")}
              className="min-h-11 rounded-xl bg-marino px-4 text-[15px] font-bold text-white"
            >
              Guardar
            </button>
            <button type="button" onClick={() => setModo(null)} className="px-2 text-[14px] text-piedra underline">
              Cancelar
            </button>
          </div>
        ) : modo === "condicion" ? (
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              autoFocus
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Condición (ej: e-cheq a 30 días)"
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-borde bg-white px-3 text-[15px]"
            />
            <button
              type="button"
              disabled={pending || !texto.trim()}
              onClick={() => correr(() => aprobarCondicion(f.id, texto), "Condición aprobada")}
              className="min-h-11 rounded-xl bg-violeta px-4 text-[15px] font-bold text-white disabled:opacity-50"
            >
              Aprobar
            </button>
            <button type="button" onClick={() => setModo(null)} className="px-2 text-[14px] text-piedra underline">
              Cancelar
            </button>
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => correr(() => registrarCobro(f.id), "Cobro registrado")}
              className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-verde px-4 text-[15px] font-extrabold text-white disabled:opacity-50"
            >
              <Check className="h-4 w-4" /> Cobrado
            </button>
            <button type="button" onClick={() => setModo("promesa")} className="min-h-11 rounded-xl border border-borde bg-white px-3 text-[15px] font-bold">
              Prometió…
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => correr(() => registrarSinRespuesta(f.id), "Anotado")}
              className="min-h-11 rounded-xl border border-borde bg-white px-3 text-[15px] font-bold"
            >
              Sin respuesta
            </button>
            {f.cliente?.telefono && (
              <a
                href={linkWhatsApp(f.cliente.telefono, mensajeReclamo({ numero: f.numero, vencimiento: f.vencimiento, montoTexto }, hoy))}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-borde bg-white px-3 text-[15px] font-bold text-verde"
              >
                <MessageCircle className="h-4 w-4" /> Reclamar
              </a>
            )}
            {puedeAprobar && !f.condicion_aprobada_at && (
              <button type="button" onClick={() => setModo("condicion")} className="min-h-11 rounded-xl border border-violeta bg-white px-3 text-[15px] font-bold text-violeta">
                Aprobar condición
              </button>
            )}
          </div>
        ))}
      {msg && <p className={`mt-1.5 text-[14px] font-bold ${msg.alerta ? "text-ambar" : "text-verde"}`}>{msg.texto}</p>}
    </div>
  );
}
