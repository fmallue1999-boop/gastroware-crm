"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { buscarClientes } from "@/lib/actions";
import type { Cliente } from "@/lib/types";

export default function BuscadorGlobal() {
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<Cliente[]>([]);
  const [buscando, setBuscando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function onChange(valor: string) {
    setQ(valor);
    if (timer.current) clearTimeout(timer.current);
    if (valor.trim().length < 2) {
      setResultados([]);
      return;
    }
    setBuscando(true);
    timer.current = setTimeout(async () => {
      const r = await buscarClientes(valor);
      setResultados(r);
      setBuscando(false);
    }, 250);
  }

  async function pegar() {
    try {
      const texto = await navigator.clipboard.readText();
      if (texto) onChange(texto.trim());
      if (inputRef.current) inputRef.current.value = texto.trim();
    } catch {
      // sin permiso de portapapeles
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="search"
          defaultValue={q}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Nombre o teléfono…"
          className="flex-1 rounded-xl border border-borde bg-white px-4 py-3 text-base outline-none focus:border-tinta"
        />
        <button
          onClick={pegar}
          className="rounded-xl border border-borde bg-white px-3 text-sm text-piedra"
          title="Pegar del portapapeles"
        >
          Pegar
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {buscando && <p className="text-sm text-piedra">Buscando…</p>}
        {!buscando && q.trim().length >= 2 && resultados.length === 0 && (
          <div className="rounded-xl border border-dashed border-borde p-4 text-sm text-piedra">
            No existe todavía.{" "}
            <Link href="/alta" className="text-sky-700 underline">
              Crear lead nuevo
            </Link>
          </div>
        )}
        {resultados.map((c) => (
          <Link
            key={c.id}
            href={`/clientes/${c.id}`}
            className="block rounded-xl border border-borde bg-white p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-medium">{c.nombre_comercial}</p>
              {c.estado === "cliente_activo" && (
                <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                  Cliente
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-piedra">
              {c.rubro}
              {c.ciudad ? ` · ${c.ciudad}` : ""}
              {c.telefono ? ` · ${c.telefono}` : ""}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
