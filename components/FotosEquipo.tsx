"use client";

import { useState, useTransition } from "react";
import { Camera, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { agregarFotoEquipo, borrarFotoEquipo } from "@/lib/actions";

export default function FotosEquipo({
  equipoId,
  fotos,
}: {
  equipoId: string;
  fotos: { id: string; url: string | null }[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function subir(archivo: File | null) {
    if (!archivo) return;
    if (archivo.size > 10 * 1024 * 1024) {
      setError("La foto no puede superar los 10 MB.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const path = `equipos/${equipoId}/${Date.now()}-${archivo.name.replace(/[^\w.\-]/g, "_")}`;
      const { error: errUp } = await supabase.storage
        .from("servicio")
        .upload(path, archivo);
      if (errUp) {
        setError("No se pudo subir: " + errUp.message);
        return;
      }
      const res = await agregarFotoEquipo(equipoId, path);
      if (res && "error" in res && res.error) setError(res.error);
    });
  }

  function borrar(id: string) {
    startTransition(async () => {
      const res = await borrarFotoEquipo(id);
      if (res && "error" in res && res.error) setError(res.error);
    });
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {fotos.map((f) =>
          f.url ? (
            <div key={f.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={f.url}
                alt="Foto del equipo"
                className="h-24 w-24 rounded-xl border border-borde object-cover"
              />
              <button
                type="button"
                disabled={pending}
                onClick={() => borrar(f.id)}
                aria-label="Borrar foto"
                className="absolute -right-1.5 -top-1.5 rounded-full border border-borde bg-white p-1 text-piedra shadow-sm hover:text-red-600"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ) : null
        )}
        <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-borde text-xs text-piedra hover:bg-crema">
          <Camera className="h-5 w-5" />
          {pending ? "Subiendo…" : "Agregar"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => subir(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
