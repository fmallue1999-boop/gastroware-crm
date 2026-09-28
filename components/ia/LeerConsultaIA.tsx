"use client";

import { useState, useTransition } from "react";
import { ImageUp, Sparkles } from "lucide-react";
import { iaLeerConsulta, type ConsultaLeida } from "@/lib/actions";

/** Reduce la imagen a máx 1400px y la devuelve como JPEG base64 (sin prefijo). */
async function comprimir(archivo: File): Promise<string> {
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
}

/**
 * "Cargar desde un mensaje": se pega el WhatsApp (o se sube la captura del
 * chat) y la IA completa el formulario. La persona revisa y guarda.
 */
export default function LeerConsultaIA({
  textoInicial = "",
  onDatos,
}: {
  textoInicial?: string;
  onDatos: (d: ConsultaLeida) => void | Promise<void>;
}) {
  const [abierto, setAbierto] = useState(Boolean(textoInicial));
  const [texto, setTexto] = useState(textoInicial);
  const [imagen, setImagen] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ texto: string; error?: boolean } | null>(null);

  if (!abierto)
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-violeta/30 bg-violeta-soft px-4 text-[15px] font-bold text-violeta"
      >
        <Sparkles className="h-5 w-5" /> Cargar desde un mensaje o una captura (IA)
      </button>
    );

  return (
    <div className="space-y-2 rounded-2xl border border-violeta/30 bg-violeta-soft p-3">
      <p className="flex items-center gap-1.5 text-[15px] font-extrabold text-violeta">
        <Sparkles className="h-4 w-4" /> Pegá el mensaje o subí la captura del chat
      </p>
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={4}
        placeholder="Ej: Hola, soy Juan de Café Sol en Quilmes, quería precio de la exprimidora… mi cel 11…"
        className="w-full rounded-xl border border-borde bg-white px-3 py-2 text-[15px] outline-none focus:border-violeta"
      />
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-borde bg-white px-3 text-[14px] font-bold">
          <ImageUp className="h-4 w-4" /> {imagen ? "✓ Captura lista" : "Subir captura"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                setImagen(await comprimir(f));
              } catch {
                setMsg({ texto: "No se pudo leer la imagen", error: true });
              }
            }}
          />
        </label>
        <button
          type="button"
          disabled={pending || (!texto.trim() && !imagen)}
          onClick={() => {
            setMsg(null);
            startTransition(async () => {
              const r = await iaLeerConsulta({ texto, imagenBase64: imagen ?? undefined, mediaType: "image/jpeg" });
              if (!r || "error" in r) {
                setMsg({ texto: (r as { error?: string })?.error ?? "No se pudo leer", error: true });
                return;
              }
              await onDatos(r.datos);
              setMsg({ texto: "Listo: revisá los datos de abajo y tocá Guardar." });
            });
          }}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-violeta px-4 text-[14px] font-extrabold text-white disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" /> {pending ? "Leyendo…" : "Completar con IA"}
        </button>
        <button type="button" onClick={() => setAbierto(false)} className="px-2 text-[14px] text-piedra underline">
          Cerrar
        </button>
      </div>
      {msg && <p className={`text-[14px] font-bold ${msg.error ? "text-red-600" : "text-verde"}`}>{msg.texto}</p>}
    </div>
  );
}
