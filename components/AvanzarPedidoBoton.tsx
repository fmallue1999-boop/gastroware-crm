"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { avanzarPedido } from "@/lib/actions";
import { PEDIDO_ESTADOS } from "@/lib/constants";
import type { PedidoEstado } from "@/lib/types";

/** Botón compacto para pasar el pedido al siguiente estado desde el tablero. */
export default function AvanzarPedidoBoton({
  oportunidadId,
  estado,
}: {
  oportunidadId: string;
  estado: PedidoEstado | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const idx = PEDIDO_ESTADOS.findIndex(
    (p) => p.value === (estado ?? "facturar")
  );
  const siguiente = PEDIDO_ESTADOS[idx + 1] ?? null;
  if (!siguiente) return null;

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await avanzarPedido(oportunidadId, siguiente.value);
          router.refresh();
        })
      }
      className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-xl border border-borde bg-crema/60 py-1.5 text-xs font-medium text-tinta disabled:opacity-50"
    >
      {pending ? "Guardando…" : siguiente.label}
      <ArrowRight className="h-3 w-3" />
    </button>
  );
}
