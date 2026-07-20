"use client";

import { useTransition } from "react";
import { setTemperatura } from "@/lib/actions";
import { TEMPERATURAS } from "@/lib/constants";

export default function TemperaturaControl({
  oportunidadId,
  temperatura,
}: {
  oportunidadId: string;
  temperatura: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const estilos: Record<string, string> = {
    caliente: "bg-red-100 text-red-700 border-red-200",
    tibio: "bg-amber-100 text-amber-700 border-amber-200",
    frio: "bg-crema-deep text-piedra border-borde",
  };
  return (
    <select
      value={temperatura ?? ""}
      disabled={pending}
      onChange={(e) =>
        startTransition(() =>
          setTemperatura(oportunidadId, e.target.value).then(() => {})
        )
      }
      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${estilos[temperatura ?? ""] ?? "border-borde text-piedra"}`}
    >
      <option value="">Temp…</option>
      {TEMPERATURAS.map((t) => (
        <option key={t.value} value={t.value}>
          {t.label}
        </option>
      ))}
    </select>
  );
}
