"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarPlus, Cog, Droplets, Plus, Refrigerator, X } from "lucide-react";
import InteresAgregar from "@/components/InteresAgregar";
import type { InfoStock } from "@/lib/stock";
import type { Producto } from "@/lib/types";

/**
 * "+ Nueva operación" en la ficha (v1.9): cada apartado por separado para
 * que no se mezclen. Interés en equipos (acá mismo), venta de consumibles,
 * pedido de repuesto o una tarea.
 */
export default function NuevaOperacion({
  clienteId,
  productosEquipos,
  stockInfo,
  tareaHref,
}: {
  clienteId: string;
  productosEquipos: Producto[];
  stockInfo: Record<string, InfoStock>;
  tareaHref: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [equipos, setEquipos] = useState(false);

  if (equipos)
    return (
      <InteresAgregar
        clienteId={clienteId}
        productos={productosEquipos}
        stockInfo={stockInfo}
        abiertoInicial
        onCerrar={() => {
          setEquipos(false);
          setAbierto(false);
        }}
      />
    );

  if (!abierto)
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="flex min-h-12 w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-marino/40 bg-white text-[15px] font-bold text-marino"
      >
        <Plus className="h-4 w-4" /> Nueva operación
      </button>
    );

  const opcion = "flex min-h-14 items-center gap-3 rounded-xl border border-borde bg-white px-3.5 text-left hover:border-marino";
  return (
    <div className="space-y-2 rounded-2xl border border-borde bg-crema/60 p-3">
      <div className="flex items-center justify-between">
        <p className="text-[15px] font-extrabold">¿Qué operación?</p>
        <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar" className="flex h-9 w-9 items-center justify-center rounded-full text-piedra hover:bg-white">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button type="button" onClick={() => setEquipos(true)} className={opcion}>
          <Refrigerator className="h-5 w-5 shrink-0 text-azul" />
          <span>
            <span className="block text-[15px] font-bold">Interés en un equipo</span>
            <span className="block text-xs text-piedra">Consulta para cotizar y vender</span>
          </span>
        </button>
        <Link href={`/consumibles/venta?cliente=${clienteId}`} className={opcion}>
          <Droplets className="h-5 w-5 shrink-0 text-verde" />
          <span>
            <span className="block text-[15px] font-bold">Venta de consumibles</span>
            <span className="block text-xs text-piedra">Registra la compra y la reposición</span>
          </span>
        </Link>
        <Link href={`/repuestos/nueva?cliente=${clienteId}`} className={opcion}>
          <Cog className="h-5 w-5 shrink-0 text-violeta" />
          <span>
            <span className="block text-[15px] font-bold">Pedido de repuesto</span>
            <span className="block text-xs text-piedra">Validar la pieza, cotizar y vender</span>
          </span>
        </Link>
        <Link href={tareaHref} className={opcion}>
          <CalendarPlus className="h-5 w-5 shrink-0 text-ambar" />
          <span>
            <span className="block text-[15px] font-bold">Tarea o recordatorio</span>
            <span className="block text-xs text-piedra">Para vos o para alguien del equipo</span>
          </span>
        </Link>
      </div>
    </div>
  );
}
