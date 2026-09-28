"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, X } from "lucide-react";

const CLAVE = "guia_vista_octubre";

/**
 * Bienvenida al modelo por puestos en Mi día: invita a leer la guía del
 * puesto. Se oculta con "Ya la vi" (queda recordado en este navegador).
 */
export default function AvisoGuia({ puesto }: { puesto: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let vista = false;
    try {
      vista = window.localStorage.getItem(CLAVE) === "1";
    } catch {
      vista = false;
    }
    // Se decide en el navegador (localStorage no existe en el servidor)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(!vista);
  }, []);

  if (!visible) return null;
  const cerrar = () => {
    try {
      window.localStorage.setItem(CLAVE, "1");
    } catch {
      // sin almacenamiento: se oculta solo por esta vez
    }
    setVisible(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-marino p-4 text-white shadow-sm">
      <BookOpen className="h-6 w-6 shrink-0 text-[#6fc3e2]" />
      <div className="min-w-0 flex-1">
        <p className="text-[16px] font-extrabold">Desde octubre el CRM trabaja por puestos</p>
        <p className="text-[14px] text-white/80">Mirá en 5 minutos cómo se usa como {puesto}: qué ves cada día y cómo se hace cada cosa.</p>
      </div>
      <div className="flex gap-2">
        <Link href="/guia" className="inline-flex min-h-11 items-center rounded-xl bg-verde px-4 text-[15px] font-extrabold text-white">
          Ver la guía
        </Link>
        <button type="button" onClick={cerrar} aria-label="Ya la vi" className="inline-flex min-h-11 items-center gap-1 rounded-xl px-3 text-[14px] font-bold text-white/80 hover:bg-white/10">
          <X className="h-4 w-4" /> Ya la vi
        </button>
      </div>
    </div>
  );
}
