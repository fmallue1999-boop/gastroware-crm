"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { eliminarOperacion } from "@/lib/actions";

/**
 * "Eliminar (mal cargada)" para dirección (v1.17): pide el motivo y confirma.
 * Borra la venta o el interés con sus cotizaciones, los equipos que creó (salvo
 * los que ya tienen service), la factura sin cobro, y devuelve el stock si se
 * había entregado. En la ficha queda el registro.
 */
export default function EliminarOperacion({ oportunidadId, venta = false, irA }: { oportunidadId: string; venta?: boolean; irA?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const que = venta ? "venta" : "interés";

  if (!abierto)
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex min-h-9 items-center gap-1 text-[13px] font-semibold text-piedra underline hover:text-red-700"
      >
        <Trash2 className="h-3.5 w-3.5" /> Eliminar {que} (mal cargada)
      </button>
    );

  return (
    <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-3">
      <p className="text-[14px] font-bold text-red-800">¿Eliminar {venta ? "esta venta" : "este interés"}?</p>
      <p className="text-[13px] text-red-800/80">
        {venta
          ? "Se borra con sus cotizaciones, los equipos que cargó (salvo los que ya tienen un service) y la factura sin cobro. Si ya se había entregado, vuelve el stock."
          : "Se borra con sus cotizaciones."}{" "}
        En la ficha del cliente queda anotado qué se eliminó y por qué.
      </p>
      <input
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="Motivo (ej: cargada dos veces, cliente equivocado)"
        className="min-h-11 w-full rounded-xl border border-borde bg-white px-3 text-base outline-none focus:border-marino"
      />
      {error && <p className="text-sm font-semibold text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending || !motivo.trim()}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const r = await eliminarOperacion(oportunidadId, motivo);
              if ("error" in r && r.error) return setError(r.error);
              if (irA) router.push(irA);
              else router.refresh();
            });
          }}
          className="min-h-11 flex-1 rounded-xl bg-red-700 px-4 text-[15px] font-bold text-white disabled:opacity-50"
        >
          {pending ? "Eliminando…" : "Sí, eliminar"}
        </button>
        <button type="button" disabled={pending} onClick={() => setAbierto(false)} className="min-h-11 rounded-xl border border-borde bg-white px-4 text-[15px]">
          No
        </button>
      </div>
    </div>
  );
}
