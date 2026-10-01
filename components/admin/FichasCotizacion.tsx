"use client";

import { useState, useTransition } from "react";
import { FileText, Trash2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { borrarDocumento, registrarDocumento } from "@/lib/actions";

export type FichaLite = { id: string; nombre: string; url: string | null };

/**
 * Fichas del producto (PDF o imagen) que se anexan solas al final de cada
 * cotización donde va este producto.
 */
export default function FichasCotizacion({ productoId, fichas }: { productoId: string; fichas: FichaLite[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function subir(archivo: File) {
    setError(null);
    if (!/\.(pdf|png|jpe?g)$/i.test(archivo.name)) {
      setError("Tiene que ser un PDF o una imagen (JPG o PNG).");
      return;
    }
    if (archivo.size > 10 * 1024 * 1024) {
      setError("El archivo no puede superar los 10 MB.");
      return;
    }
    startTransition(async () => {
      const supabase = createClient();
      const path = `producto/${productoId}/${Date.now()}-${archivo.name.replace(/[^\w.\-]/g, "_")}`;
      const { error: errUp } = await supabase.storage.from("documentos").upload(path, archivo);
      if (errUp) {
        setError("No se pudo subir: " + errUp.message);
        return;
      }
      const res = await registrarDocumento({ entidad: "producto", entidadId: productoId, tipo: "ficha", nombre: archivo.name, path });
      if (res && "error" in res && res.error) setError(res.error);
    });
  }

  function borrar(id: string) {
    startTransition(async () => {
      const res = await borrarDocumento(id);
      if (res && "error" in res && res.error) setError(res.error);
    });
  }

  return (
    <div className="space-y-1.5 rounded-xl bg-celeste-soft p-3">
      <p className="text-sm font-bold">PDF que se anexa a la cotización</p>
      <p className="text-xs text-piedra">
        Ficha técnica, folleto o info adicional. Sale sola al final del PDF de cada cotización que lleve este producto. Si el producto está vinculado en Material, la ficha que se cargue ahí también se anexa.
      </p>
      {fichas.map((f) => (
        <div key={f.id} className="flex items-center gap-2 text-sm">
          <FileText className="h-3.5 w-3.5 shrink-0 text-piedra" />
          {f.url ? (
            <a href={f.url} target="_blank" rel="noopener noreferrer" className="truncate text-azul hover:underline">
              {f.nombre}
            </a>
          ) : (
            <span className="truncate">{f.nombre}</span>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={() => borrar(f.id)}
            aria-label={`Quitar ${f.nombre}`}
            className="ml-auto shrink-0 text-piedra/60 hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <label className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-borde bg-white px-3 text-sm font-bold">
        <Upload className="h-4 w-4" /> {pending ? "Subiendo…" : "Cargar PDF"}
        <input
          type="file"
          accept=".pdf,image/png,image/jpeg"
          disabled={pending}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) subir(f);
          }}
          className="sr-only"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
