"use client";

import { useState } from "react";
import { nombreAccion, nombreLinea } from "@/lib/actividad";
import Link from "next/link";
import { MessageCircle, PenLine, Phone } from "lucide-react";
import { linkWhatsApp } from "@/lib/format";
import AnotarContacto from "@/components/AnotarContacto";
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
  accion?: string | null;
  /** Vendedor a cargo (cuando dirección mira todo el equipo). */
  responsable?: string | null;
};

/**
 * Una fila de Pendientes, igual en todos los bloques: contacto · qué le
 * interesa (con puntito de nivel) · nota del próximo contacto · WhatsApp,
 * Llamar, Anotar. "Anotar" abre ¿Qué pasó? acá mismo; al guardar, la fila
 * se va del bloque (cambió la fecha) o pasa a Sin fecha.
 */
export default function PendienteFila({ item }: { item: Pendiente }) {
  const [anotando, setAnotando] = useState(false);
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
          {(item.nota || item.detalle || item.accion || item.responsable) && (
            <p className="truncate text-xs text-piedra">
              {[nombreAccion(item.accion), item.detalle, item.nota, item.responsable].filter(Boolean).join(" · ")}
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
            onClick={() => setAnotando(!anotando)}
            aria-label="Anotar"
            className={`flex h-11 w-11 items-center justify-center rounded-full ${
              anotando ? "bg-marino text-white" : "border border-borde text-tinta"
            }`}
          >
            <PenLine className="h-5 w-5" />
          </button>
        </div>
      </div>
      {anotando && (
        <div className="mt-2">
          <AnotarContacto
            clienteId={item.clienteId}
            oportunidadId={item.id}
            proximoActual={{ fecha: item.proximo ?? null, accion: item.accion ?? null }}
            compacto
            onGuardado={() => setAnotando(false)}
          />
        </div>
      )}
    </div>
  );
}
