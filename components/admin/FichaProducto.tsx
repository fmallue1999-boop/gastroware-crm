"use client";

import { useState, useTransition } from "react";
import { crearSubidaBiblioteca, guardarProducto } from "@/lib/actions";
import { createClient } from "@/lib/supabase/client";
import type { Producto } from "@/lib/types";
import VideoModelo from "@/components/VideoModelo";
import FichasCotizacion, { type FichaLite } from "@/components/admin/FichasCotizacion";

const inputCls =
  "w-full rounded-xl border border-borde px-3 py-2 text-sm outline-none focus:border-marino";

/** Ficha de venta del producto: descripción, argumentos e imagen.
 *  La usan el cotizador, la IA y la API pública del catálogo.
 *  v1.8: código, detalle técnico y los PDF que se anexan a la cotización. */
export default function FichaProducto({ producto, fichas }: { producto: Producto; fichas: FichaLite[] }) {
  const [pending, startTransition] = useTransition();
  const [descripcion, setDescripcion] = useState(producto.descripcion ?? "");
  const [destacados, setDestacados] = useState(
    (producto.destacados ?? []).join("\n")
  );
  const [imagenUrl, setImagenUrl] = useState(producto.imagen_url ?? "");
  const [codigo, setCodigo] = useState(producto.codigo ?? "");
  const [detalle, setDetalle] = useState(producto.detalle_tecnico ?? "");
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  async function subirImagen(archivo: File) {
    setError(null);
    if (archivo.size > 10 * 1024 * 1024) {
      setError("La imagen no puede superar los 10 MB.");
      return;
    }
    const firma = await crearSubidaBiblioteca(
      `${producto.id}-${archivo.name}`,
      "productos"
    );
    if ("error" in firma) {
      setError(firma.error ?? "No se pudo preparar la subida");
      return;
    }
    const supabase = createClient();
    const { error: errUp } = await supabase.storage
      .from("biblioteca")
      .uploadToSignedUrl(firma.path, firma.token, archivo);
    if (errUp) {
      setError("No se pudo subir la imagen: " + errUp.message);
      return;
    }
    const { data } = supabase.storage
      .from("biblioteca")
      .getPublicUrl(firma.path);
    setImagenUrl(data.publicUrl);
  }

  function guardar() {
    setError(null);
    setGuardado(false);
    startTransition(async () => {
      const res = await guardarProducto(producto.id, {
        descripcion: descripcion.trim() || null,
        destacados: destacados
          .split("\n")
          .map((d) => d.trim())
          .filter(Boolean),
        imagen_url: imagenUrl || null,
        codigo: codigo.trim() || null,
        detalle_tecnico: detalle.trim() || null,
      });
      if (res && "error" in res && res.error) setError(res.error);
      else setGuardado(true);
    });
  }

  return (
    <details className="border-t border-borde/60">
      <summary className="cursor-pointer px-4 py-2 text-xs font-medium text-azul list-none [&::-webkit-details-marker]:hidden">
        Ficha de venta {producto.descripcion ? "✓" : "(sin completar)"}
        {" · "}PDF para cotizar {fichas.length ? `(${fichas.length}) ✓` : "(sin cargar)"}
      </summary>
      <div className="space-y-2 px-4 pb-3">
        <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
          <input
            type="text"
            placeholder="Código (ej: 10216-G)"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            className={inputCls}
            aria-label="Código del producto"
          />
          <input
            type="text"
            placeholder="Detalle técnico para la cotización (ej: DIM. 480X550X890MM - 28 FRUTAS X MINUTO - 380W 220V)"
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
            className={inputCls}
            aria-label="Detalle técnico"
          />
        </div>
        <textarea
          placeholder="Descripción para el cliente (qué es, para quién, qué resuelve)"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={2}
          className={inputCls}
        />
        <textarea
          placeholder={"Argumentos de venta, uno por línea. Ej:\nGarantía oficial 5 años\nRepuestos y service local"}
          value={destacados}
          onChange={(e) => setDestacados(e.target.value)}
          rows={3}
          className={inputCls}
        />
        <div className="flex flex-wrap items-center gap-2">
          {imagenUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imagenUrl}
              alt={producto.nombre}
              className="h-12 w-12 rounded-lg border border-borde object-cover"
            />
          )}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void subirImagen(f);
            }}
            className="text-xs file:mr-2 file:rounded-xl file:border file:border-borde file:bg-white file:px-3 file:py-1.5 file:text-xs"
          />
          <button
            type="button"
            disabled={pending}
            onClick={guardar}
            className="ml-auto rounded-xl bg-marino px-3.5 py-1.5 text-xs font-medium text-white disabled:opacity-60"
          >
            {pending ? "Guardando…" : guardado ? "Guardado ✓" : "Guardar ficha"}
          </button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <FichasCotizacion productoId={producto.id} fichas={fichas} />
        <VideoModelo productoId={producto.id} inicial={producto.video_url} />
      </div>
    </details>
  );
}
