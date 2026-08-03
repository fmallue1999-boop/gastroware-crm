"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { actualizarOT } from "@/lib/actions";
import { dinero } from "@/lib/format";
import { TIPOS_OT } from "@/lib/constants";
import { EstadoOTBadge } from "@/components/Badges";
import type { OrdenTrabajo, Usuario } from "@/lib/types";

export default function FilaOT({
  ot,
  tecnicos,
}: {
  ot: OrdenTrabajo;
  tecnicos: Usuario[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const editable = ["abierta", "en_proceso"].includes(ot.estado);

  function actualizar(patch: Record<string, string | null>) {
    startTransition(async () => {
      await actualizarOT(ot.id, patch);
      router.refresh();
    });
  }

  return (
    <tr className="border-b border-borde/60 transition-colors last:border-0 hover:bg-crema/50">
      <td className="px-3 py-2">
        <Link href={`/servicio/${ot.id}`} className="font-semibold hover:underline">
          OT-{ot.numero}
        </Link>
      </td>
      <td className="max-w-40 truncate px-3 py-2">
        <Link href={`/servicio/${ot.id}`} className="hover:underline">
          {ot.cliente?.nombre_comercial}
        </Link>
      </td>
      <td className="max-w-36 truncate px-3 py-2 text-piedra">
        {ot.equipo
          ? (ot.equipo.producto?.nombre ?? ot.equipo.marca_modelo)
          : "—"}
      </td>
      <td className="px-3 py-2 text-piedra">
        {TIPOS_OT.find((t) => t.value === ot.tipo)?.label}
      </td>
      <td className="px-3 py-2">
        {editable ? (
          <input
            type="date"
            defaultValue={ot.fecha_programada ?? ""}
            disabled={pending}
            onChange={(e) =>
              actualizar({ fecha_programada: e.target.value || null })
            }
            className="rounded-lg border border-borde bg-white px-2 py-1 text-xs outline-none focus:border-celeste-deep"
          />
        ) : (
          <span className="text-piedra">{ot.fecha_programada ?? "—"}</span>
        )}
      </td>
      <td className="px-3 py-2">
        {editable ? (
          <select
            defaultValue={ot.tecnico_id ?? ""}
            disabled={pending}
            onChange={(e) => actualizar({ tecnico_id: e.target.value || null })}
            className="max-w-28 rounded-lg border border-borde bg-white px-2 py-1 text-xs outline-none focus:border-celeste-deep"
          >
            <option value="">Sin asignar</option>
            {tecnicos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-piedra">{ot.tecnico?.nombre ?? "—"}</span>
        )}
      </td>
      <td className="px-3 py-2 text-right font-medium">
        {ot.total != null ? dinero(ot.total) : "—"}
      </td>
      <td className="px-3 py-2">
        <EstadoOTBadge estado={ot.estado} />
      </td>
    </tr>
  );
}
