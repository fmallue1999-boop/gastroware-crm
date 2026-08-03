"use client";

import { useState, useTransition } from "react";
import { borrarMaterial } from "@/lib/actions";
import { linkWhatsApp } from "@/lib/format";

import {
  FileText,
  Video,
  Scale,
  Star,
  BookOpen,
  Building2,
  Paperclip,
  type LucideIcon,
} from "lucide-react";

const ICONOS: Record<string, LucideIcon> = {
  ficha: FileText,
  video: Video,
  comparativa: Scale,
  caso: Star,
  guia: BookOpen,
  institucional: Building2,
};

export default function MaterialItem({
  material,
  telefono,
  conBorrar,
}: {
  material: { id: string; nombre: string; tipo: string; url: string | null };
  telefono?: string | null;
  conBorrar?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    if (!material.url) return;
    await navigator.clipboard.writeText(material.url);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-borde bg-white shadow-sm px-3 py-2">
      {(() => {
        const Icono = ICONOS[material.tipo] ?? Paperclip;
        return <Icono className="h-4 w-4 shrink-0 text-piedra" aria-hidden />;
      })()}
      <span className="min-w-0 flex-1 truncate text-sm">{material.nombre}</span>
      {material.url && (
        <>
          <button
            onClick={copiar}
            className="shrink-0 rounded-lg border border-borde px-2.5 py-1 text-xs"
          >
            {copiado ? "✓" : "Copiar"}
          </button>
          <a
            href={
              telefono
                ? linkWhatsApp(telefono, `${material.nombre}: ${material.url}`)
                : `https://wa.me/?text=${encodeURIComponent(`${material.nombre}: ${material.url}`)}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-lg bg-green-600 px-2.5 py-1 text-xs font-medium text-white"
          >
            WhatsApp
          </a>
        </>
      )}
      {conBorrar && (
        <button
          onClick={() => startTransition(() => borrarMaterial(material.id).then(() => {}))}
          disabled={pending}
          title="Borrar"
          className="shrink-0 text-piedra/80 hover:text-red-600"
        >
          ✕
        </button>
      )}
    </div>
  );
}
