"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

/**
 * Avisa que hay una versión nueva publicada (v1.21.2). La app instalada en el
 * celular puede quedar días con la versión que se abrió: cada tanto (y al
 * volver a la app) pregunta cuál es la versión publicada y, si cambió, ofrece
 * actualizar con un toque. No recarga sola para no perder lo que se esté
 * escribiendo.
 */
export default function AvisoVersion({ version }: { version: string }) {
  const [nueva, setNueva] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    const revisar = async () => {
      try {
        const r = await fetch("/api/version", { cache: "no-store" });
        if (!r.ok) return;
        const { version: publicada } = (await r.json()) as { version?: string };
        if (vivo && publicada && publicada !== version) setNueva(publicada);
      } catch {
        // sin conexión: se vuelve a probar más tarde
      }
    };
    const alVolver = () => {
      if (document.visibilityState === "visible") revisar();
    };
    revisar();
    const intervalo = setInterval(revisar, 5 * 60 * 1000);
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      vivo = false;
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [version]);

  if (!nueva) return null;
  return (
    <div className="mx-4 mt-3 flex items-center gap-3 rounded-2xl bg-marino px-4 py-3 text-white lg:mx-7">
      <p className="min-w-0 flex-1 text-[15px] font-semibold">Hay una versión nueva del sistema (v{nueva}).</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 text-[14px] font-extrabold text-marino"
      >
        <RefreshCw className="h-4 w-4" /> Actualizar
      </button>
    </div>
  );
}
