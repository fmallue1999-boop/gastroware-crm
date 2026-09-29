"use client";

import { useState } from "react";
import { FileText, Share2 } from "lucide-react";

/** Nombre del archivo que manda el servidor (filename*=UTF-8''…). */
function nombreDe(res: Response, porDefecto: string) {
  const cd = res.headers.get("Content-Disposition") ?? "";
  const utf = /filename\*=UTF-8''([^;]+)/i.exec(cd)?.[1];
  if (utf) return decodeURIComponent(utf);
  return /filename="([^"]+)"/i.exec(cd)?.[1] ?? porDefecto;
}

/**
 * Ver el PDF de la cotización (con las fichas anexadas) y compartirlo:
 * en el celular abre WhatsApp, mail, etc. con el archivo; en la compu lo baja.
 */
export default function BotonesPdfCotizacion({
  cotizacionId,
  version,
  compacto,
}: {
  cotizacionId: string;
  version: number;
  compacto?: boolean;
}) {
  const [estado, setEstado] = useState<"listo" | "armando" | "error">("listo");
  const url = `/cotizacion/${cotizacionId}/pdf?v=${version}`;

  async function compartir() {
    setEstado("armando");
    try {
      const res = await fetch(url);
      if (!res.ok || !(res.headers.get("Content-Type") ?? "").includes("pdf")) throw new Error("sin pdf");
      const nombre = nombreDe(res, "Cotizacion.pdf");
      const archivo = new File([await res.blob()], nombre, { type: "application/pdf" });
      if (navigator.canShare?.({ files: [archivo] })) {
        try {
          await navigator.share({ files: [archivo], title: nombre.replace(/\.pdf$/i, "") });
        } catch (e) {
          // Cerrar el menú de compartir no es un error
          if ((e as Error).name !== "AbortError") throw e;
        }
      } else {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(archivo);
        link.download = nombre;
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
      }
      setEstado("listo");
    } catch {
      setEstado("error");
    }
  }

  if (compacto)
    return (
      <span className="inline-flex flex-wrap items-center gap-3">
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-azul underline">
          Ver PDF
        </a>
        <button type="button" onClick={compartir} disabled={estado === "armando"} className="text-azul underline disabled:opacity-60">
          {estado === "armando" ? "Armando…" : "Compartir"}
        </button>
        {estado === "error" && <span className="text-xs text-red-600">No se pudo armar el PDF</span>}
      </span>
    );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-borde bg-white px-4 text-[15px] font-bold text-tinta"
      >
        <FileText className="h-4 w-4" /> Ver PDF
      </a>
      <button
        type="button"
        onClick={compartir}
        disabled={estado === "armando"}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-verde px-4 text-[15px] font-bold text-white disabled:opacity-60"
      >
        <Share2 className="h-4 w-4" /> {estado === "armando" ? "Armando el PDF…" : "Compartir (WhatsApp, mail…)"}
      </button>
      {estado === "error" && <p className="w-full text-sm text-red-600">No se pudo armar el PDF. Probá de nuevo.</p>}
    </div>
  );
}
