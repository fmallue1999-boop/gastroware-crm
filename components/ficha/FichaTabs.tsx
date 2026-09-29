"use client";

import { createContext, useContext, useState } from "react";

export type Pestana = { key: string; label: string; badge?: number; alerta?: boolean; contenido: React.ReactNode };

const IrA = createContext<(key: string) => void>(() => {});

/**
 * Las pestañas de la ficha (v1.9): Operaciones, Historial, Cotizaciones,
 * Equipos, Personas y Datos. En el celular la barra se desliza de costado.
 */
export default function FichaTabs({
  pestanas,
  inicial,
  cabecera,
  enPanel = false,
}: {
  pestanas: Pestana[];
  inicial?: string;
  /** Lo de arriba de la ficha (va adentro para poder saltar de pestaña desde ahí). */
  cabecera?: React.ReactNode;
  /** En el panel del costado la barra queda fija arriba al desplazar. */
  enPanel?: boolean;
}) {
  const [activa, setActiva] = useState(inicial && pestanas.some((p) => p.key === inicial) ? inicial : pestanas[0]?.key);
  const actual = pestanas.find((p) => p.key === activa) ?? pestanas[0];
  return (
    <IrA.Provider value={setActiva}>
      {cabecera}
      <div className={enPanel ? "sticky top-0 z-[5] -mx-4 mt-3 border-b border-borde bg-white px-4" : "mt-3 border-b border-borde"}>
        <nav className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist">
          {pestanas.map((p) => {
            const on = p.key === actual?.key;
            return (
              <button
                key={p.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setActiva(p.key)}
                className={`relative flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap px-3 text-[15px] font-bold ${
                  on ? "text-tinta" : "text-piedra hover:text-tinta"
                }`}
              >
                {p.label}
                {p.badge ? (
                  <span className={`rounded-full px-1.5 text-xs ${on ? "bg-marino text-white" : "bg-crema-deep text-piedra"}`}>{p.badge}</span>
                ) : null}
                {p.alerta && <span className="h-2 w-2 rounded-full bg-ambar" aria-label="Falta completar" />}
                {on && <span className="absolute inset-x-2 -bottom-px h-[3px] rounded-full bg-marino" />}
              </button>
            );
          })}
        </nav>
      </div>
      <div className="pt-3" role="tabpanel">
        {actual?.contenido}
      </div>
    </IrA.Provider>
  );
}

/** Botón para saltar a otra pestaña desde adentro del contenido (ej. "Ver todo el historial"). */
export function IrAPestana({ a, children, className }: { a: string; children: React.ReactNode; className?: string }) {
  const irA = useContext(IrA);
  return (
    <button type="button" onClick={() => irA(a)} className={className ?? "text-sm font-bold text-marino underline"}>
      {children}
    </button>
  );
}
