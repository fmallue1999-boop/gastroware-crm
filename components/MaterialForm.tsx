"use client";

import { useState, useTransition } from "react";
import { crearMaterial } from "@/lib/actions";
import type { Producto } from "@/lib/types";

const inputCls =
  "w-full rounded-xl border border-borde bg-white px-3 py-2.5 text-sm outline-none focus:border-tinta";

const TIPOS = [
  "ficha",
  "video",
  "comparativa",
  "caso",
  "guia",
  "institucional",
] as const;

export default function MaterialForm({ productos }: { productos: Producto[] }) {
  const [pending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState("ficha");
  const [productoId, setProductoId] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="w-full rounded-xl border border-dashed border-borde py-2.5 text-sm text-piedra"
      >
        + Agregar material (link a video, PDF, foto…)
      </button>
    );
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await crearMaterial({
        nombre,
        tipo,
        producto_id: productoId || null,
        url,
      });
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      setNombre("");
      setUrl("");
      setAbierto(false);
    });
  }

  return (
    <form onSubmit={enviar} className="rounded-xl border border-borde bg-white p-4 space-y-2">
      <input
        type="text"
        required
        placeholder="Nombre (ej: Video GX22 con hielo)"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        className={inputCls}
      />
      <input
        type="url"
        required
        placeholder="Link (YouTube, Drive, web…)"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        className={inputCls}
      />
      <div className="grid grid-cols-2 gap-2">
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputCls}>
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
          className="flex-1 rounded-xl bg-tinta py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Guardar material"}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="rounded-xl border border-borde px-4 py-2.5 text-sm"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
