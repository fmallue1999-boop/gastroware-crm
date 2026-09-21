"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export type Panel = { key: string; label: string; badge?: number; contenido: React.ReactNode };

/**
 * Los desplegables de la cabecera de la ficha (Equipos, Services,
 * Cotizaciones, Datos): un toque abre uno, otro toque lo cierra.
 */
export default function PanelesFicha({ paneles, abiertoInicial = null }: { paneles: Panel[]; abiertoInicial?: string | null }) {
  const [abierto, setAbierto] = useState<string | null>(abiertoInicial);
  const actual = paneles.find((p) => p.key === abierto);
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {paneles.map((p) => {
          const activo = p.key === abierto;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => setAbierto(activo ? null : p.key)}
              aria-expanded={activo}
              className={`inline-flex min-h-10 items-center gap-1 rounded-full px-3.5 text-[15px] font-semibold ${
                activo ? "bg-marino text-white" : "border border-borde bg-white text-tinta"
              }`}
            >
              {p.label}
              {p.badge ? <span className={activo ? "text-white/80" : "text-piedra"}> {p.badge}</span> : null}
              <ChevronDown className={`h-4 w-4 transition-transform ${activo ? "rotate-180" : ""}`} />
            </button>
          );
        })}
      </div>
      {actual && <div className="mt-2 rounded-2xl border border-borde bg-white p-3.5">{actual.contenido}</div>}
    </div>
  );
}
