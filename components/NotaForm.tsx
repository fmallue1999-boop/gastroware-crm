"use client";

import { useState, useTransition } from "react";
import { agregarNota } from "@/lib/actions";

export default function NotaForm({
  clienteId,
  oportunidadId,
}: {
  clienteId: string;
  oportunidadId?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [texto, setTexto] = useState("");

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    startTransition(async () => {
      await agregarNota(clienteId, texto, oportunidadId ?? null);
      setTexto("");
    });
  }

  return (
    <form onSubmit={enviar} className="flex gap-2">
      <input
        type="text"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Agregar nota rápida…"
        className="flex-1 rounded-xl border border-borde bg-white px-3 py-2 text-sm outline-none focus:border-tinta"
      />
      <button
        disabled={pending || !texto.trim()}
        className="rounded-xl bg-tinta px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        Guardar
      </button>
    </form>
  );
}
