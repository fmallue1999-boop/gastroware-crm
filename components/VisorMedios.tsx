"use client";

import { useEffect } from "react";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { esVideo } from "@/lib/contenidos";

export type Medio = { id: string; nombre: string; mime: string | null; url: string | null };

/** Vista ampliada de imágenes y videos, con anterior/siguiente y descargar. */
export default function Visor({ archivos, indice, onCerrar, onMover }: { archivos: Medio[]; indice: number; onCerrar: () => void; onMover: (i: number) => void }) {
  const a = archivos[indice];
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
      if (e.key === "ArrowRight" && indice < archivos.length - 1) onMover(indice + 1);
      if (e.key === "ArrowLeft" && indice > 0) onMover(indice - 1);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [indice, archivos.length, onCerrar, onMover]);
  if (!a) return null;
  return (
    <div data-visor className="fixed inset-0 z-[60] flex flex-col bg-black/90" role="dialog" aria-label={a.nombre}>
      <div className="flex items-center justify-between gap-2 px-4 py-3 text-white">
        <p className="min-w-0 truncate text-sm font-bold">
          {a.nombre} <span className="font-normal text-white/60">· {indice + 1} de {archivos.length}</span>
        </p>
        <div className="flex shrink-0 gap-2">
          {a.url && (
            <a href={`${a.url}&download=${encodeURIComponent(a.nombre)}`} download={a.nombre} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10" aria-label="Descargar">
              <Download className="h-5 w-5" />
            </a>
          )}
          <button type="button" onClick={onCerrar} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-4">
        {a.url && esVideo(a.mime) ? (
          <video key={a.id} src={a.url} controls autoPlay playsInline className="max-h-full max-w-full" />
        ) : a.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.url} alt={a.nombre} className="max-h-full max-w-full object-contain" />
        ) : (
          <p className="text-white/70">No se pudo abrir el archivo.</p>
        )}
        {indice > 0 && (
          <button type="button" onClick={() => onMover(indice - 1)} className="absolute left-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white" aria-label="Anterior">
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        {indice < archivos.length - 1 && (
          <button type="button" onClick={() => onMover(indice + 1)} className="absolute right-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white" aria-label="Siguiente">
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>
    </div>
  );
}