"use client";

import { useState, useTransition } from "react";
import { registrarCotizacion } from "@/lib/actions";
import { createClient } from "@/lib/supabase/client";
import { FORMAS_PAGO } from "@/lib/constants";

const inputCls =
  "rounded-xl border border-borde bg-white px-3 py-2.5 text-sm outline-none focus:border-tinta";

export default function CotizacionForm({
  oportunidadId,
  monedaDefault,
  advertencia,
}: {
  oportunidadId: string;
  monedaDefault: string;
  advertencia: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [monto, setMonto] = useState("");
  const [moneda, setMoneda] = useState(monedaDefault);
  const [formaPago, setFormaPago] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      let archivo_url: string | null = null;

      if (archivo) {
        const supabase = createClient();
        const path = `${oportunidadId}/${Date.now()}-${archivo.name.replace(/[^\w.\-]/g, "_")}`;
        const { error: errUpload } = await supabase.storage
          .from("cotizaciones")
          .upload(path, archivo);
        if (errUpload) {
          setError("No se pudo subir el archivo: " + errUpload.message);
          return;
        }
        const { data } = supabase.storage
          .from("cotizaciones")
          .getPublicUrl(path);
        archivo_url = data.publicUrl;
      }

      const res = await registrarCotizacion({
        oportunidadId,
        monto: monto ? Number(monto) : null,
        moneda,
        forma_pago: formaPago,
        archivo_url,
      });
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      setAbierto(false);
      setMonto("");
      setArchivo(null);
    });
  }

  if (!abierto) {
    return (
      <div>
        {advertencia && (
          <p className="mb-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
            ⚠️ {advertencia}
          </p>
        )}
        <button
          onClick={() => setAbierto(true)}
          className="w-full rounded-xl border border-dashed border-borde py-2.5 text-sm text-piedra"
        >
          + Registrar cotización enviada
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="space-y-2">
      {advertencia && (
        <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
          ⚠️ {advertencia}
        </p>
      )}
      <div className="grid grid-cols-3 gap-2">
        <input
          type="number"
          required
          placeholder="Monto"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          className={`${inputCls} col-span-2`}
        />
        <select
          value={moneda}
          onChange={(e) => setMoneda(e.target.value)}
          className={inputCls}
        >
          <option value="ARS">ARS</option>
          <option value="USD">USD</option>
        </select>
      </div>
      <select
        value={formaPago}
        onChange={(e) => setFormaPago(e.target.value)}
        className={`${inputCls} w-full`}
      >
        <option value="">Forma de pago (opcional)…</option>
        {FORMAS_PAGO.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>
      <label className="block text-sm text-piedra">
        PDF o foto de la cotización (opcional)
        <input
          type="file"
          accept=".pdf,image/*"
          onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
          className="mt-1 block w-full text-sm"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-xl bg-tinta py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Guardar y activar seguimiento"}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="rounded-xl border border-borde px-4 py-2.5 text-sm"
        >
          Cancelar
        </button>
      </div>
      <p className="text-xs text-piedra/80">
        Al guardar se crean solas las tareas D+2, D+5, D+10 y D+20.
      </p>
    </form>
  );
}
