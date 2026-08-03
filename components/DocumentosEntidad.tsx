"use client";

import { useState, useTransition } from "react";
import { FileText, Trash2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { registrarDocumento, borrarDocumento } from "@/lib/actions";
import { fechaCorta } from "@/lib/format";

const TIPOS = [
  { value: "factura", label: "Factura" },
  { value: "remito", label: "Remito" },
  { value: "manual", label: "Manual" },
  { value: "contrato", label: "Contrato" },
  { value: "foto", label: "Foto" },
  { value: "otro", label: "Otro" },
];

export type DocumentoConUrl = {
  id: string;
  tipo: string;
  nombre: string;
  created_at: string;
  url: string | null;
};

export default function DocumentosEntidad({
  entidad,
  entidadId,
  documentos,
  puedeBorrar,
}: {
  entidad: "cliente" | "equipo" | "orden" | "oportunidad" | "repuesto";
  entidadId: string;
  documentos: DocumentoConUrl[];
  puedeBorrar: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [tipo, setTipo] = useState("otro");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  function subir(e: React.FormEvent) {
    e.preventDefault();
    if (!archivo) return;
    if (archivo.size > 10 * 1024 * 1024) {
      setError("El archivo no puede superar los 10 MB.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const path = `${entidad}/${entidadId}/${Date.now()}-${archivo.name.replace(/[^\w.\-]/g, "_")}`;
      const { error: errUp } = await supabase.storage
        .from("documentos")
        .upload(path, archivo);
      if (errUp) {
        setError("No se pudo subir: " + errUp.message);
        return;
      }
      const res = await registrarDocumento({
        entidad,
        entidadId,
        tipo,
        nombre: archivo.name,
        path,
      });
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      setArchivo(null);
    });
  }

  function borrar(id: string) {
    startTransition(async () => {
      const res = await borrarDocumento(id);
      if (res && "error" in res && res.error) setError(res.error);
    });
  }

  return (
    <section className="rounded-2xl border border-borde bg-white shadow-sm p-4">
      <h2 className="mb-2 text-sm font-semibold">Documentos</h2>
      <div className="space-y-1.5">
        {documentos.map((d) => (
          <div key={d.id} className="flex items-center gap-2 text-sm">
            <FileText className="h-3.5 w-3.5 shrink-0 text-piedra" />
            {d.url ? (
              <a
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-sky-700 hover:underline"
              >
                {d.nombre}
              </a>
            ) : (
              <span className="truncate">{d.nombre}</span>
            )}
            <span className="shrink-0 text-xs text-piedra">
              {TIPOS.find((t) => t.value === d.tipo)?.label ?? d.tipo} ·{" "}
              {fechaCorta(d.created_at)}
            </span>
            {puedeBorrar && (
              <button
                type="button"
                disabled={pending}
                onClick={() => borrar(d.id)}
                aria-label={`Borrar ${d.nombre}`}
                className="shrink-0 text-piedra/60 hover:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
        {documentos.length === 0 && (
          <p className="text-sm text-piedra/80">Sin documentos adjuntos.</p>
        )}
      </div>

      <form onSubmit={subir} className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="file"
          onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
          className="max-w-56 text-xs text-piedra file:mr-2 file:rounded-xl file:border file:border-borde file:bg-white file:px-3 file:py-1.5 file:text-xs"
        />
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          className="rounded-xl border border-borde bg-white px-2.5 py-1.5 text-sm"
        >
          {TIPOS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        {archivo && (
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-xl bg-tinta px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
          >
            <Upload className="h-3 w-3" /> {pending ? "Subiendo…" : "Subir"}
          </button>
        )}
      </form>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </section>
  );
}
