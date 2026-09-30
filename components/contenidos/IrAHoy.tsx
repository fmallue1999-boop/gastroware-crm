"use client";

import { useEffect } from "react";

/** Al abrir el mes, el calendario se desplaza solo hasta la columna de hoy. */
export default function IrAHoy({ clave }: { clave: string }) {
  useEffect(() => {
    const hoy = document.querySelector<HTMLElement>("[data-calendario] [data-hoy]");
    const caja = hoy?.closest<HTMLElement>("[data-calendario]");
    if (!hoy || !caja) return;
    // Que se vea hoy con un par de días antes (la columna de títulos queda fija)
    caja.scrollLeft = Math.max(0, hoy.offsetLeft - 88 - hoy.offsetWidth * 2);
  }, [clave]);
  return null;
}
