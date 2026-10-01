"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from "lucide-react";
import {
  borrarCategoriaMaterial,
  borrarProductoMaterial,
  guardarCategoriaMaterial,
  guardarProductoMaterial,
  moverCategoriaMaterial,
  moverProductoMaterial,
} from "@/lib/actions";

const input = "min-h-10 min-w-0 flex-1 rounded-xl border border-borde bg-white px-3 text-[14px] outline-none focus:border-marino";
const iconBtn = "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-borde bg-white text-tinta hover:bg-crema disabled:opacity-40";

function useAccion() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const correr = (fn: () => Promise<unknown>, despues?: () => void) => {
    setError(null);
    startTransition(async () => {
      const r = (await fn()) as { error?: string } | undefined;
      if (r && r.error) setError(r.error);
      else {
        despues?.();
        router.refresh();
      }
    });
  };
  return { pending, error, correr };
}

/** Renombrar, subir/bajar y borrar una categoría. */
export function EditorCategoria({ id, marcaId, nombre, seccion, primera, ultima }: { id: string; marcaId: string; nombre: string; seccion: "productos" | "accesorios"; primera: boolean; ultima: boolean }) {
  const { pending, error, correr } = useAccion();
  const [texto, setTexto] = useState(nombre);
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <input value={texto} onChange={(e) => setTexto(e.target.value)} className={input} aria-label="Nombre de la categoría" />
        {texto.trim() !== nombre && (
          <button type="button" disabled={pending} onClick={() => correr(() => guardarCategoriaMaterial({ id, marcaId, nombre: texto, seccion }))} className={`${iconBtn} border-marino bg-marino text-white`} aria-label="Guardar nombre">
            <Check className="h-4 w-4" />
          </button>
        )}
        <button type="button" disabled={pending || primera} onClick={() => correr(() => moverCategoriaMaterial(id, -1))} className={iconBtn} aria-label="Subir">
          <ArrowUp className="h-4 w-4" />
        </button>
        <button type="button" disabled={pending || ultima} onClick={() => correr(() => moverCategoriaMaterial(id, 1))} className={iconBtn} aria-label="Bajar">
          <ArrowDown className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => window.confirm(`¿Borrar la categoría “${nombre}”?`) && correr(() => borrarCategoriaMaterial(id))}
          className={`${iconBtn} text-red-600`}
          aria-label="Borrar categoría"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {error && <p className="text-xs font-bold text-red-600">{error}</p>}
    </div>
  );
}

/** "+ Categoría" en la columna de productos o de accesorios. */
export function NuevaCategoria({ marcaId, seccion }: { marcaId: string; seccion: "productos" | "accesorios" }) {
  const { pending, error, correr } = useAccion();
  const [texto, setTexto] = useState("");
  return (
    <div className="space-y-1 rounded-xl border border-dashed border-borde p-2">
      <div className="flex gap-1.5">
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={seccion === "accesorios" ? "Nueva categoría de accesorios" : "Nueva categoría"} className={input} />
        <button
          type="button"
          disabled={pending || !texto.trim()}
          onClick={() => correr(() => guardarCategoriaMaterial({ marcaId, nombre: texto, seccion }), () => setTexto(""))}
          className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-marino px-3 text-[14px] font-bold text-white disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Agregar
        </button>
      </div>
      {error && <p className="text-xs font-bold text-red-600">{error}</p>}
    </div>
  );
}

type Opcion = { id: string; nombre: string };

/** Renombrar, mover de categoría, vincular con el Catálogo, subir/bajar y borrar un producto. */
export function EditorProducto({
  id,
  nombre,
  categoriaId,
  productoId,
  categorias,
  catalogo,
  primero,
  ultimo,
}: {
  id: string;
  nombre: string;
  categoriaId: string;
  productoId: string | null;
  categorias: Opcion[];
  catalogo: Opcion[];
  primero: boolean;
  ultimo: boolean;
}) {
  const { pending, error, correr } = useAccion();
  const [texto, setTexto] = useState(nombre);
  const [cat, setCat] = useState(categoriaId);
  const [vinculo, setVinculo] = useState(productoId ?? "");
  const cambiado = texto.trim() !== nombre || cat !== categoriaId || vinculo !== (productoId ?? "");
  return (
    <div className="space-y-1.5 rounded-xl border border-borde bg-white p-2">
      <div className="flex items-center gap-1.5">
        <input value={texto} onChange={(e) => setTexto(e.target.value)} className={input} aria-label="Nombre del producto" />
        <button type="button" disabled={pending || primero} onClick={() => correr(() => moverProductoMaterial(id, -1))} className={iconBtn} aria-label="Subir">
          <ArrowUp className="h-4 w-4" />
        </button>
        <button type="button" disabled={pending || ultimo} onClick={() => correr(() => moverProductoMaterial(id, 1))} className={iconBtn} aria-label="Bajar">
          <ArrowDown className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => window.confirm(`¿Borrar “${nombre}” con todos sus videos, imágenes y ficha?`) && correr(() => borrarProductoMaterial(id))}
          className={`${iconBtn} text-red-600`}
          aria-label="Borrar producto"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="grid gap-1.5 sm:grid-cols-2">
        <select value={cat} onChange={(e) => setCat(e.target.value)} className={input} aria-label="Categoría">
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <select value={vinculo} onChange={(e) => setVinculo(e.target.value)} className={input} aria-label="Producto del Catálogo">
          <option value="">Sin vincular al Catálogo</option>
          {catalogo.map((p) => (
            <option key={p.id} value={p.id}>
              Catálogo: {p.nombre}
            </option>
          ))}
        </select>
      </div>
      {cambiado && (
        <button
          type="button"
          disabled={pending || !texto.trim()}
          onClick={() => correr(() => guardarProductoMaterial({ id, categoriaId: cat, nombre: texto, productoId: vinculo || null }))}
          className="min-h-9 rounded-xl bg-marino px-3 text-[13px] font-bold text-white disabled:opacity-50"
        >
          Guardar cambios
        </button>
      )}
      {error && <p className="text-xs font-bold text-red-600">{error}</p>}
    </div>
  );
}

/** "+ Producto" dentro de una categoría. */
export function NuevoProducto({ categoriaId }: { categoriaId: string }) {
  const { pending, error, correr } = useAccion();
  const [texto, setTexto] = useState("");
  return (
    <div className="space-y-1">
      <div className="flex gap-1.5">
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Nuevo producto" className={input} />
        <button
          type="button"
          disabled={pending || !texto.trim()}
          onClick={() => correr(() => guardarProductoMaterial({ categoriaId, nombre: texto }), () => setTexto(""))}
          className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-marino bg-white px-3 text-[14px] font-bold text-marino disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Producto
        </button>
      </div>
      {error && <p className="text-xs font-bold text-red-600">{error}</p>}
    </div>
  );
}
