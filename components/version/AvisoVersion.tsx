"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, X } from "lucide-react";
import { VERSION, VERSIONES, versionCorta } from "@/lib/novedades";

const CLAVE = "version_vista";

/**
 * Aviso de versión nueva en Mi día: aparece una vez por versión, hasta que
 * la persona toca "Entendido" o abre las novedades. La primera versión
 * (1.0) no se anuncia: ya la presenta la guía.
 */
export default function AvisoVersion() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let vista: string | null = null;
    try {
      vista = window.localStorage.getItem(CLAVE);
      if (!vista && VERSION === "1.0.0") window.localStorage.setItem(CLAVE, VERSION);
    } catch {
      vista = VERSION;
    }
    // Se decide en el navegador (localStorage no existe en el servidor)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(vista !== VERSION && !(vista === null && VERSION === "1.0.0"));
  }, []);

  if (!visible) return null;
  const marcar = () => {
    try {
      window.localStorage.setItem(CLAVE, VERSION);
    } catch {
      // sin almacenamiento: se oculta solo por esta vez
    }
    setVisible(false);
  };
  const actual = VERSIONES[0];

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-celeste bg-white p-4 shadow-sm">
      <Sparkles className="h-6 w-6 shrink-0 text-marino" />
      <div className="min-w-0 flex-1">
        <p className="text-[16px] font-extrabold">
          GastroWare OS se actualizó a {versionCorta()}: {actual.titulo}
        </p>
        <p className="text-[14px] text-piedra">{actual.cambios[0]}</p>
      </div>
      <div className="flex gap-2">
        <Link href="/novedades" onClick={marcar} className="inline-flex min-h-11 items-center rounded-xl bg-marino px-4 text-[15px] font-extrabold text-white">
          Ver novedades
        </Link>
        <button type="button" onClick={marcar} aria-label="Entendido" className="inline-flex min-h-11 items-center gap-1 rounded-xl px-3 text-[14px] font-bold text-piedra hover:bg-crema">
          <X className="h-4 w-4" /> Entendido
        </button>
      </div>
    </div>
  );
}
