"use client";

import { useRef, useState } from "react";
import { Check, Search } from "lucide-react";
import { buscarClientes } from "@/lib/actions";
import { telefonoProlijo } from "@/lib/format";

export type ClienteElegido = { id: string; nombre_comercial: string; telefono?: string | null };

/** Buscar y elegir un contacto de la base (nombre, empresa, teléfono, CUIT o serie). */
export default function ClienteSelector({
  valor,
  onChange,
  placeholder = "Buscar cliente: nombre, teléfono o serie del equipo",
}: {
  valor: ClienteElegido | null;
  onChange: (c: ClienteElegido | null) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<ClienteElegido[]>([]);
  const [buscando, setBuscando] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (valor)
    return (
      <div className="flex min-h-11 items-center gap-2 rounded-xl bg-verde-soft px-3 py-2">
        <Check className="h-4 w-4 shrink-0 text-verde" />
        <span className="min-w-0 flex-1 truncate text-[15px] font-bold">{valor.nombre_comercial}</span>
        <button type="button" onClick={() => onChange(null)} className="text-[14px] text-azul underline">
          Cambiar
        </button>
      </div>
    );

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-piedra" />
        <input
          type="search"
          value={q}
          placeholder={placeholder}
          onChange={(e) => {
            const v = e.target.value;
            setQ(v);
            if (timer.current) clearTimeout(timer.current);
            if (v.trim().length < 2) {
              setResultados([]);
              return;
            }
            setBuscando(true);
            timer.current = setTimeout(async () => {
              setResultados((await buscarClientes(v)) as ClienteElegido[]);
              setBuscando(false);
            }, 250);
          }}
          className="min-h-11 w-full rounded-xl border border-borde bg-white py-2 pl-9 pr-3 text-[15px] outline-none focus:border-marino"
        />
      </div>
      {(buscando || resultados.length > 0) && (
        <div className="mt-1 space-y-1">
          {buscando && <p className="px-1 text-[14px] text-piedra">Buscando…</p>}
          {resultados.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onChange(c);
                setResultados([]);
                setQ("");
              }}
              className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-borde bg-white px-3 text-left"
            >
              <span className="truncate text-[15px] font-bold">{c.nombre_comercial}</span>
              {c.telefono && <span className="shrink-0 text-xs text-piedra">{telefonoProlijo(c.telefono)}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
