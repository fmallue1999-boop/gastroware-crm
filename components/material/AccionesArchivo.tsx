"use client";

import { useState } from "react";
import { Download, Share2 } from "lucide-react";

/** Link firmado que descarga el archivo con su nombre (en vez de abrirlo). */
export const linkDescarga = (url: string, nombre: string) => `${url}&download=${encodeURIComponent(nombre)}`;

/**
 * Descargar y Compartir un archivo del material. En el celular, Compartir
 * manda el archivo (no un link que vence) por WhatsApp, mail, etc.
 */
export default function AccionesArchivo({ url, nombre, mime, compacto = false }: { url: string | null; nombre: string; mime: string | null; compacto?: boolean }) {
  const [estado, setEstado] = useState<"listo" | "preparando" | "error">("listo");
  if (!url) return null;

  async function compartir() {
    setEstado("preparando");
    try {
      const res = await fetch(url!);
      if (!res.ok) throw new Error("sin archivo");
      const archivo = new File([await res.blob()], nombre, { type: mime || res.headers.get("Content-Type") || "application/octet-stream" });
      if (navigator.canShare?.({ files: [archivo] })) {
        try {
          await navigator.share({ files: [archivo], title: nombre });
        } catch (e) {
          if ((e as Error).name !== "AbortError") throw e;
        }
      } else {
        const a = document.createElement("a");
        a.href = linkDescarga(url!, nombre);
        a.download = nombre;
        a.click();
      }
      setEstado("listo");
    } catch {
      setEstado("error");
    }
  }

  const cls = compacto
    ? "inline-flex h-9 w-9 items-center justify-center rounded-full border border-borde bg-white text-tinta hover:bg-crema"
    : "inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-borde bg-white px-3 text-[14px] font-bold hover:bg-crema";
  return (
    <span className="inline-flex items-center gap-1.5">
      <a href={linkDescarga(url, nombre)} download={nombre} className={cls} aria-label={`Descargar ${nombre}`} title="Descargar">
        <Download className="h-4 w-4" />
        {!compacto && "Descargar"}
      </a>
      <button type="button" onClick={compartir} disabled={estado === "preparando"} className={`${cls} disabled:opacity-60`} aria-label={`Compartir ${nombre}`} title="Compartir">
        <Share2 className="h-4 w-4" />
        {!compacto && (estado === "preparando" ? "Preparando…" : "Compartir")}
      </button>
      {estado === "error" && <span className="text-xs font-bold text-red-600">No se pudo</span>}
    </span>
  );
}
