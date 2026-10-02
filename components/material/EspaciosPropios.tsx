"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus, Pencil, Trash2 } from "lucide-react";
import { borrarEspacioMaterial, crearEspacioMaterial, editarEspacioMaterial } from "@/lib/actions";
import type { AmbitoEspacio } from "@/lib/material";
import type { ArchivoMaterial, EspacioPropio } from "@/lib/servidor/material";
import EspacioArchivos from "@/components/material/EspacioArchivos";

const campo = "min-h-11 w-full rounded-xl border border-borde bg-white px-3 text-[15px] outline-none focus:border-marino";

/**
 * Espacios propios de Material (v1.23): marketing crea dónde subir contenido
 * de cualquier tipo (presentaciones, redes, banners, manuales…), en general,
 * en una marca o en un producto.
 */

/** "+ Nuevo espacio": nombre y para qué es. */
export function NuevoEspacio({
  ambito,
  ambitoId = null,
  irAlCrear = false,
  texto = "Nuevo espacio",
}: {
  ambito: AmbitoEspacio;
  ambitoId?: string | null;
  /** Generales: al crearlo se abre su página. */
  irAlCrear?: boolean;
  texto?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!abierto)
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-dashed border-marino/50 bg-white px-3.5 text-[14px] font-bold text-marino"
      >
        <FolderPlus className="h-4 w-4" /> {texto}
      </button>
    );
  return (
    <div className="space-y-2 rounded-xl border border-borde bg-crema/60 p-3">
      <input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre (ej: Presentaciones, Redes, Banners)" className={campo} />
      <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Para qué es (opcional)" className={campo} />
      {error && <p className="text-sm font-bold text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending || !nombre.trim()}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const r = await crearEspacioMaterial({ ambito, ambitoId, nombre, descripcion });
              if ("error" in r && r.error) return setError(r.error);
              setAbierto(false);
              setNombre("");
              setDescripcion("");
              if (irAlCrear && "id" in r && r.id) router.push(`/material/espacio/${r.id}`);
              else router.refresh();
            })
          }
          className="min-h-10 rounded-xl bg-marino px-4 text-[14px] font-bold text-white disabled:opacity-50"
        >
          {pending ? "Creando…" : "Crear espacio"}
        </button>
        <button type="button" onClick={() => setAbierto(false)} className="min-h-10 rounded-xl border border-borde bg-white px-4 text-[14px]">
          Cancelar
        </button>
      </div>
    </div>
  );
}

/** Título del espacio con cambiar nombre y borrar (para quien gestiona Material). */
export function CabeceraEspacio({
  espacio,
  puedeGestionar,
  grande = false,
  alBorrarIr,
}: {
  espacio: Pick<EspacioPropio, "id" | "nombre" | "descripcion" | "cantidad">;
  puedeGestionar: boolean;
  grande?: boolean;
  /** A dónde ir después de borrarlo (si no, se refresca la página). */
  alBorrarIr?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(espacio.nombre);
  const [descripcion, setDescripcion] = useState(espacio.descripcion ?? "");
  const [error, setError] = useState<string | null>(null);

  if (editando)
    return (
      <div className="space-y-2">
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} aria-label="Nombre del espacio" className={campo} />
        <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Para qué es (opcional)" className={campo} />
        {error && <p className="text-sm font-bold text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending || !nombre.trim()}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const r = await editarEspacioMaterial(espacio.id, { nombre, descripcion });
                if ("error" in r && r.error) return setError(r.error);
                setEditando(false);
                router.refresh();
              })
            }
            className="min-h-10 rounded-xl bg-marino px-4 text-[14px] font-bold text-white disabled:opacity-50"
          >
            Guardar
          </button>
          <button type="button" onClick={() => setEditando(false)} className="min-h-10 rounded-xl border border-borde bg-white px-4 text-[14px]">
            Cancelar
          </button>
        </div>
      </div>
    );

  return (
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1">
        <p className={grande ? "text-3xl font-extrabold tracking-tight" : "text-[15px] font-extrabold"}>{espacio.nombre}</p>
        {espacio.descripcion && <p className={`${grande ? "text-[15px]" : "text-[13px]"} text-piedra`}>{espacio.descripcion}</p>}
        {error && <p className="text-sm font-bold text-red-600">{error}</p>}
      </div>
      {puedeGestionar && (
        <>
          <button
            type="button"
            onClick={() => setEditando(true)}
            aria-label={`Cambiar el nombre de ${espacio.nombre}`}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-borde bg-white text-piedra"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              const aviso = espacio.cantidad
                ? `¿Borrar el espacio “${espacio.nombre}” con sus ${espacio.cantidad} archivo${espacio.cantidad === 1 ? "" : "s"}?`
                : `¿Borrar el espacio “${espacio.nombre}”?`;
              if (!window.confirm(aviso)) return;
              startTransition(async () => {
                const r = await borrarEspacioMaterial(espacio.id);
                if ("error" in r && r.error) return setError(r.error);
                if (alBorrarIr) router.push(alBorrarIr);
                else router.refresh();
              });
            }}
            aria-label={`Borrar el espacio ${espacio.nombre}`}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-red-200 bg-white text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );
}

/** Los espacios propios de una marca o un producto, cada uno con sus archivos, y "+ Nuevo espacio". */
export default function EspaciosPropios({
  ambito,
  ambitoId,
  espacios,
  archivos,
  puedeGestionar,
  comoSecciones = false,
}: {
  ambito: AmbitoEspacio;
  ambitoId: string;
  espacios: EspacioPropio[];
  archivos: Record<string, ArchivoMaterial[]>;
  puedeGestionar: boolean;
  /** Producto: cada espacio como una sección más (como Videos, Imágenes, Ficha). */
  comoSecciones?: boolean;
}) {
  if (!espacios.length && !puedeGestionar) return null;
  const caja = comoSecciones ? "space-y-2 rounded-2xl border border-borde bg-white p-4 shadow-sm" : "space-y-1.5";
  return (
    <>
      {espacios.map((e) => (
        <section key={e.id} id={`espacio-${e.id}`} className={`scroll-mt-32 ${caja}`}>
          <CabeceraEspacio espacio={e} puedeGestionar={puedeGestionar} />
          <EspacioArchivos dueno="espacio" duenoId={e.id} espacio="propio" archivos={archivos[e.id] ?? []} puedeGestionar={puedeGestionar} vacio="Vacío por ahora." />
        </section>
      ))}
      {puedeGestionar && (
        <div className={comoSecciones ? "" : "pt-1"}>
          <NuevoEspacio ambito={ambito} ambitoId={ambitoId} texto={ambito === "producto" ? "Nuevo espacio del producto" : "Nuevo espacio de la marca"} />
        </div>
      )}
    </>
  );
}
