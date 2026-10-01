"use client";

import { useState } from "react";
import { nombreAccion, nombreLinea } from "@/lib/actividad";
import Link from "next/link";
import { CalendarClock, MessageCircle, PenLine, Phone } from "lucide-react";
import { linkWhatsApp } from "@/lib/format";
import AnotarContacto from "@/components/AnotarContacto";
import { PanelReprogramar } from "@/components/ReprogramarInteres";
import { PuntoNivel } from "@/components/PuntoNivel";

export type Pendiente = {
  id: string;
  clienteId: string;
  nombre: string;
  telefono: string | null;
  interes: string;
  nivel: string | null;
  nota: string | null;
  detalle?: string | null;
  /** Apartado: equipos, consumibles o repuestos. */
  linea?: string | null;
  /** Próximo contacto y su acción (para mantenerlo o cambiarlo). */
  proximo?: string | null;
  /** Hora del próximo contacto, si la tiene (HH:MM:SS). */
  hora?: string | null;
  accion?: string | null;
  /** Vendedor a cargo (cuando dirección mira todo el equipo). */
  responsable?: string | null;
};

/**
 * Una fila de Pendientes, igual en todos los bloques: contacto · qué le
 * interesa (con puntito de nivel) · nota del próximo contacto · WhatsApp,
 * Llamar, Reprogramar, Anotar. "Anotar" abre ¿Qué pasó? acá mismo; al guardar,
 * la fila se va del bloque (cambió la fecha) o pasa a Sin fecha. "Reprogramar"
 * mueve el contacto a otro día u hora sin anotar nada (v1.13).
 */
export default function PendienteFila({ item }: { item: Pendiente }) {
  const [abierto, setAbierto] = useState<"anotar" | "reprogramar" | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const anotando = abierto === "anotar";
  const reprogramando = abierto === "reprogramar";
  return (
    <div className="rounded-2xl border border-borde bg-white p-3 shadow-sm">
      <div className="flex items-start gap-2">
        <Link href={`/clientes/${item.clienteId}?interes=${item.id}`} className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-[15px] font-semibold">
            <span className="truncate">{item.nombre}</span>
            {item.linea && item.linea !== "equipos" && (
              <span className="shrink-0 rounded-full bg-violeta-soft px-2 py-0.5 text-[11px] font-bold text-violeta">{nombreLinea(item.linea)}</span>
            )}
          </p>
          <p className="flex items-center gap-1.5 truncate text-[15px] text-tinta/80">
            <PuntoNivel nivel={item.nivel} />
            <span className="truncate">{item.interes}</span>
          </p>
          {(item.nota || item.detalle || item.accion || item.hora || item.responsable) && (
            <p className="truncate text-xs text-piedra">
              {[
                [nombreAccion(item.accion), item.hora ? `a las ${item.hora.slice(0, 5)}` : null].filter(Boolean).join(" ") || null,
                item.detalle,
                item.nota,
                item.responsable,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </Link>
        <div className="flex shrink-0 gap-1.5">
          {item.telefono ? (
            <>
              <a
                href={linkWhatsApp(item.telefono)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-verde text-white"
              >
                <MessageCircle className="h-5 w-5" />
              </a>
              <a
                href={`tel:${item.telefono}`}
                aria-label="Llamar"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-borde text-tinta"
              >
                <Phone className="h-5 w-5" />
              </a>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setAbierto(reprogramando ? null : "reprogramar");
              setAviso(null);
            }}
            aria-label="Reprogramar"
            className={`flex h-11 w-11 items-center justify-center rounded-full ${
              reprogramando ? "bg-marino text-white" : "border border-borde text-tinta"
            }`}
          >
            <CalendarClock className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setAbierto(anotando ? null : "anotar");
              setAviso(null);
            }}
            aria-label="Anotar"
            className={`flex h-11 w-11 items-center justify-center rounded-full ${
              anotando ? "bg-marino text-white" : "border border-borde text-tinta"
            }`}
          >
            <PenLine className="h-5 w-5" />
          </button>
        </div>
      </div>
      {aviso && !abierto && <p className="mt-2 text-[15px] font-semibold text-verde">{aviso}</p>}
      {reprogramando && (
        <div className="mt-2">
          <PanelReprogramar
            oportunidadId={item.id}
            accion={item.accion}
            onListo={(t) => {
              setAviso(t);
              setAbierto(null);
            }}
            onCancelar={() => setAbierto(null)}
          />
        </div>
      )}
      {anotando && (
        <div className="mt-2">
          <AnotarContacto
            clienteId={item.clienteId}
            oportunidadId={item.id}
            proximoActual={{ fecha: item.proximo ?? null, accion: item.accion ?? null }}
            compacto
            onGuardado={() => setAbierto(null)}
          />
        </div>
      )}
    </div>
  );
}
