"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cambiarEstadoOT } from "@/lib/actions";
import type { OrdenTrabajo } from "@/lib/types";

export default function OTAdminControl({
  ot,
  rol,
}: {
  ot: OrdenTrabajo;
  rol: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [nroFactura, setNroFactura] = useState("");
  const [error, setError] = useState<string | null>(null);

  function mover(estado: string, nro?: string) {
    setError(null);
    startTransition(async () => {
      const res = await cambiarEstadoOT(ot.id, estado, nro);
      if (res && "error" in res && res.error) setError(res.error);
      router.refresh();
    });
  }

  if (ot.estado === "facturada") {
    return (
      <div className="rounded-xl bg-green-100 p-3 text-sm font-medium text-green-800">
        ✅ Facturada — factura {ot.nro_factura}
      </div>
    );
  }

  if (ot.estado === "anulada") {
    return (
      <div className="rounded-xl bg-crema-deep p-3 text-sm text-piedra">
        Orden anulada.{" "}
        <button onClick={() => mover("abierta")} className="underline" disabled={pending}>
          Reabrir
        </button>
      </div>
    );
  }

  const esAdmin = rol === "admin";

  return (
    <div className="rounded-xl border border-borde bg-white p-4 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-piedra">
        Administración
      </p>

      {ot.estado === "cerrada_tecnico" && esAdmin && (
        <button
          onClick={() => mover("facturable")}
          disabled={pending}
          className="w-full rounded-xl bg-tinta py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          Aprobar → lista para facturar (calcula el total)
        </button>
      )}
      {ot.estado === "cerrada_tecnico" && !esAdmin && (
        <p className="text-sm text-piedra">
          Esperando revisión de administración.
        </p>
      )}

      {ot.estado === "facturable" && esAdmin && (
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="N° de factura en ZEUS"
            value={nroFactura}
            onChange={(e) => setNroFactura(e.target.value)}
            className="flex-1 rounded-xl border border-borde bg-white px-3 py-2 text-sm outline-none focus:border-tinta"
          />
          <button
            onClick={() => mover("facturada", nroFactura)}
            disabled={pending || !nroFactura.trim()}
            className="rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Facturada
          </button>
        </div>
      )}
      {ot.estado === "facturable" && !esAdmin && (
        <p className="text-sm text-piedra">Lista para facturar en ZEUS.</p>
      )}

      {["cerrada_tecnico", "facturable"].includes(ot.estado) && (
        <button
          onClick={() => mover("en_proceso")}
          disabled={pending}
          className="text-xs text-piedra underline"
        >
          Reabrir para corregir
        </button>
      )}

      {["abierta", "en_proceso"].includes(ot.estado) && (
        <button
          onClick={() => mover("anulada")}
          disabled={pending}
          className="text-xs text-piedra underline"
        >
          Anular orden
        </button>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
