"use client";

import { useTransition } from "react";
import { setObjecion } from "@/lib/actions";
import { OBJECIONES, ACCION_POR_OBJECION } from "@/lib/constants";

export default function ObjecionControl({
  oportunidadId,
  objecion,
}: {
  oportunidadId: string;
  objecion: string | null;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <section className="rounded-xl border border-borde bg-white p-4">
      <h2 className="text-sm font-semibold mb-2">Objeción principal</h2>
      <select
        value={objecion ?? ""}
        disabled={pending}
        onChange={(e) =>
          startTransition(() =>
            setObjecion(oportunidadId, e.target.value).then(() => {})
          )
        }
        className="w-full rounded-xl border border-borde bg-white px-3 py-2.5 text-sm"
      >
        <option value="">Sin registrar…</option>
        {OBJECIONES.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      {objecion && ACCION_POR_OBJECION[objecion] && (
        <p className="mt-2 rounded-lg bg-celeste-soft px-3 py-2 text-sm text-sky-900">
          💡 {ACCION_POR_OBJECION[objecion]}
        </p>
      )}
    </section>
  );
}
