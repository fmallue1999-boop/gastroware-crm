"use client";

import { useTransition } from "react";
import { Lightbulb } from "lucide-react";
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
    <section className="rounded-2xl border border-borde bg-white shadow-sm p-4">
      <h2 className="text-sm font-semibold mb-2">Objeción principal</h2>
      <select
        value={objecion ?? ""}
        disabled={pending}
        onChange={(e) =>
          startTransition(() =>
            setObjecion(oportunidadId, e.target.value).then(() => {})
          )
        }
        className="w-full rounded-2xl border border-borde bg-white shadow-sm px-3 py-2.5 text-sm"
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
          <Lightbulb className="mr-1 -mt-0.5 inline h-3.5 w-3.5" />
          {ACCION_POR_OBJECION[objecion]}
        </p>
      )}
    </section>
  );
}
