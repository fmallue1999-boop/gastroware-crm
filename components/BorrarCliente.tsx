"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { eliminarCliente } from "@/lib/actions";

/** Borrado de cliente con confirmación en dos pasos. Solo se muestra a dirección/admin. */
export default function BorrarCliente({
  clienteId,
  nombre,
}: {
  clienteId: string;
  nombre: string;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function borrar() {
    setError(null);
    startTransition(async () => {
      const res = await eliminarCliente(clienteId);
      if (res && "error" in res) setError(res.error);
    });
  }

  if (!confirmando) {
    return (
      <div className="pt-2 text-center">
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className="inline-flex items-center gap-1.5 text-sm text-red-600 underline"
        >
          <Trash2 className="h-4 w-4" /> Eliminar cliente
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm">
      <p className="font-medium text-red-800">
        ¿Eliminar a {nombre}?
      </p>
      <p className="mt-1 text-red-700">
        Desaparece de todos los listados, se cierran sus consultas abiertas y se
        cancelan sus tareas pendientes. El historial queda guardado en la base
        por si hay que recuperarlo.
      </p>
      {error && <p className="mt-2 text-red-600">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={borrar}
          disabled={pending}
          className="rounded-xl bg-red-600 px-4 py-2 font-medium text-white disabled:opacity-60"
        >
          {pending ? "Eliminando…" : "Sí, eliminar"}
        </button>
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          disabled={pending}
          className="rounded-xl border border-borde bg-white px-4 py-2 text-piedra"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
