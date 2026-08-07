"use client";

import { useState, useTransition } from "react";
import { ImageUp } from "lucide-react";
import { setConfigValor } from "@/lib/actions";
import { createClient } from "@/lib/supabase/client";

/** Logo de la empresa para los documentos imprimibles. Se guarda en el bucket público. */
export default function SubirLogo({ logoActual }: { logoActual: string | null }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function subir(file: File | null) {
    if (!file) return;
    setError(null);
    if (file.size > 2 * 1024 * 1024) {
      setError("El logo no puede pesar más de 2 MB");
      return;
    }
    startTransition(async () => {
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `logo/logo-${Date.now()}.${ext}`;
      const { error: errUp } = await supabase.storage
        .from("biblioteca")
        .upload(path, file, { upsert: true });
      if (errUp) {
        setError(errUp.message);
        return;
      }
      const { data } = supabase.storage.from("biblioteca").getPublicUrl(path);
      const res = await setConfigValor("logo_url", data.publicUrl);
      if (res && "error" in res && res.error) setError(res.error);
    });
  }

  return (
    <section className="rounded-2xl border border-borde bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold">Logo de la empresa</h2>
      <p className="mt-0.5 text-xs text-piedra">
        Aparece en el membrete de cotizaciones, comprobantes de service, hojas
        de inspección y propuestas de financiación. Ideal: PNG con fondo
        transparente.
      </p>
      <div className="mt-3 flex items-center gap-4">
        {logoActual ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoActual}
            alt="Logo actual"
            className="h-14 w-auto rounded-lg border border-borde bg-white object-contain p-1"
          />
        ) : (
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-tinta text-2xl font-bold text-white">
            G
          </span>
        )}
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-borde bg-white px-3.5 py-2 text-sm shadow-sm">
          <ImageUp className="h-4 w-4" />
          {pending ? "Subiendo…" : logoActual ? "Cambiar logo" : "Subir logo"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            disabled={pending}
            onChange={(e) => subir(e.target.files?.[0] ?? null)}
          />
        </label>
        {logoActual && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await setConfigValor("logo_url", "");
              })
            }
            className="text-xs text-piedra underline"
          >
            Volver al logo G
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}
