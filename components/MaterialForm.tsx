"use client";

import { useState, useTransition } from "react";
import { crearMaterial, crearSubidaBiblioteca } from "@/lib/actions";
import { createClient } from "@/lib/supabase/client";
import type { Producto } from "@/lib/types";

const inputCls =
  "w-full rounded-2xl border border-borde bg-white shadow-sm px-3 py-2.5 text-sm outline-none focus:border-tinta";

const TIPOS = [
  "ficha",
  "folleto",
  "lista de precios",
  "video",
  "comparativa",
  "caso",
  "guia",
  "institucional",
] as const;

export default function MaterialForm({ productos }: { productos: Producto[] }) {
  const [pending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [modo, setModo] = useState<"archivo" | "link">("archivo");
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState("ficha");
  const [productoId, setProductoId] = useState("");
  const [url, setUrl] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="w-full rounded-2xl border border-dashed border-borde py-2.5 text-sm text-piedra"
      >
        + Agregar material (PDF, foto, lista, o link a video/web)
      </button>
    );
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      let urlFinal = url.trim();

      if (modo === "archivo") {
        if (!archivo) {
          setError("Elegí el archivo a subir.");
          return;
        }
        if (archivo.size > 25 * 1024 * 1024) {
          setError("El archivo no puede superar los 25 MB.");
          return;
        }
        const firma = await crearSubidaBiblioteca(archivo.name);
        if ("error" in firma) {
          setError(firma.error ?? "No se pudo preparar la subida");
          return;
        }
        const supabase = createClient();
        const { error: errUp } = await supabase.storage
          .from("biblioteca")
          .uploadToSignedUrl(firma.path, firma.token, archivo);
        if (errUp) {
          setError("No se pudo subir: " + errUp.message);
          return;
        }
        const { data } = supabase.storage
          .from("biblioteca")
          .getPublicUrl(firma.path);
        urlFinal = data.publicUrl;
      }

      const res = await crearMaterial({
        nombre: nombre.trim() || archivo?.name || "Material",
        tipo,
        producto_id: productoId || null,
        url: urlFinal,
      });
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      setNombre("");
      setUrl("");
      setArchivo(null);
      setAbierto(false);
    });
  }

  return (
    <form
      onSubmit={enviar}
      className="rounded-2xl border border-borde bg-white shadow-sm p-4 space-y-2"
    >
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => setModo("archivo")}
          className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium ${
            modo === "archivo"
              ? "bg-tinta text-white"
              : "border border-borde text-piedra"
          }`}
        >
          Subir archivo
        </button>
        <button
          type="button"
          onClick={() => setModo("link")}
          className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium ${
            modo === "link"
              ? "bg-tinta text-white"
              : "border border-borde text-piedra"
          }`}
        >
          Pegar link
        </button>
      </div>

      {modo === "archivo" ? (
        <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-borde px-3 py-4 text-center text-sm text-piedra hover:border-celeste">
          {archivo ? (
            <span className="font-medium text-tinta">{archivo.name}</span>
          ) : (
            "Tocá y elegí el PDF, foto o archivo (máx 25 MB)"
          )}
          <input
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setArchivo(f);
              if (f && !nombre) setNombre(f.name.replace(/\.[^.]+$/, ""));
            }}
          />
        </label>
      ) : (
        <input
          type="url"
          required
          placeholder="Link (YouTube, Drive, web…)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className={inputCls}
        />
      )}

      <input
        type="text"
        placeholder="Nombre (ej: Carpeta comercial Zumex 2026)"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        className={inputCls}
      />

      <div className="grid grid-cols-2 gap-2">
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          className={inputCls}
        >
          {TIPOS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={productoId}
          onChange={(e) => setProductoId(e.target.value)}
          className={inputCls}
        >
          <option value="">Todos los productos</option>
          {productos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-2xl bg-tinta py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending
            ? modo === "archivo"
              ? "Subiendo…"
              : "Guardando…"
            : "Guardar material"}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="rounded-2xl border border-borde px-4 py-2.5 text-sm"
        >
          Cancelar
        </button>
      </div>
      <p className="text-[11px] text-piedra">
        Los archivos subidos quedan con un link compartible que no vence: se
        mandan por WhatsApp desde acá o desde cualquier oportunidad.
      </p>
    </form>
  );
}
