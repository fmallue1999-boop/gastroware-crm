"use client";

import { useState } from "react";
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
          <p className="truncate text-[15px] font-semibold">{item.nombre}</p>
          <p className="flex items-center gap-1.5 truncate text-[15px] text-tinta/80">
            <PuntoNivel nivel={item.nivel} />
            <span className="truncate">{item.interes}</span>
          </p>
          {(item.nota || item.detalle) && (
            <p className="truncate text-xs text-piedra">
              {[item.detalle, item.nota].filter(Boolean).join(" · ")}
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
                className="flex h-11 w-11 items-center justify-center rounded-full bg-green-600 text-white"
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
              anotando ? "bg-tinta text-white" : "border border-borde text-tinta"
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
            compacto
            onGuardado={() => setAnotando(false)}
          />
        </div>
      )}
    </div>
  );
}
