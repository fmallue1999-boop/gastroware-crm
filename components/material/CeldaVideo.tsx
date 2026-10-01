"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play, Plus } from "lucide-react";
import { registrarArchivosMaterial } from "@/lib/actions";
import { aceptaArchivo, videoTipoDe, type VideoTipo } from "@/lib/material";
import { nombreSeguro, subirArchivo } from "@/lib/subir";
import Visor, { type Medio } from "@/components/VisorMedios";

/**
 * Una celda de "Material por producto": ▶ Ver video si el producto tiene un
 * video de ese tipo; si no, + Agregar (lo sube ya asociado al producto y al
 * tipo). Es el mismo video que se ve en la página del producto.
 */
export default function CeldaVideo({ video, productoId, tipo, puedeGestionar }: { video: Medio | null; productoId: string; tipo: VideoTipo; puedeGestionar: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [ver, setVer] = useState(false);
  const [avance, setAvance] = useState(0);
  const [error, setError] = useState<string | null>(null);

  if (video)
    return (
      <>
        <button type="button" onClick={() => setVer(true)} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-verde px-3 text-[13px] font-bold text-white">
          <Play className="h-3.5 w-3.5" /> Ver video
        </button>
        {ver && <Visor archivos={[video]} indice={0} onCerrar={() => setVer(false)} onMover={() => {}} />}
      </>
    );

  if (!puedeGestionar) return <span className="text-sm text-piedra/60">—</span>;

  function subir(f: File | undefined) {
    if (!f) return;
    const invalido = aceptaArchivo("videos", f);
    if (invalido) {
      setError(invalido);
      return;
    }
    setError(null);
    startTransition(async () => {
      const path = `producto/${productoId}/videos/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${nombreSeguro(f.name)}`;
      const r = await subirArchivo("material", path, f, setAvance);
      if (r.error) {
        setError(r.error);
        return;
      }
      const g = await registrarArchivosMaterial({ dueno: "producto", duenoId: productoId, espacio: "videos", videoTipo: tipo, archivos: [{ path, nombre: f.name, mime: f.type || null, tamano: f.size }] });
      if (g && "error" in g && g.error) setError(g.error);
      router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <label
        className="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-full border border-dashed border-borde px-3 text-[13px] font-bold text-piedra hover:border-marino hover:text-marino"
        title={`Subir el video de ${videoTipoDe(tipo).label.toLowerCase()}`}
      >
        <Plus className="h-3.5 w-3.5" /> {pending ? `Subiendo ${avance}%` : "Agregar"}
        <input type="file" accept="video/*" disabled={pending} onChange={(e) => subir(e.target.files?.[0])} className="sr-only" />
      </label>
      {error && <span className="max-w-48 text-xs font-bold text-red-600">{error}</span>}
    </span>
  );
}
