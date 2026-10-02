"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileArchive, FileText, FolderInput, ImageIcon, Play, RefreshCw, Trash2, Upload } from "lucide-react";
import { borrarArchivoMaterial, cambiarTipoVideo, destinosMaterial, moverArchivoMaterial, registrarArchivosMaterial, type DestinoMaterial } from "@/lib/actions";
import { VIDEO_TIPOS, aceptaArchivo, acceptDe, videoTipoDe, type DuenoArchivo, type Espacio, type VideoTipo } from "@/lib/material";
import { esImagen, esVideo } from "@/lib/contenidos";
import { nombreSeguro, pesoTexto, subirArchivo } from "@/lib/subir";
import Visor from "@/components/VisorMedios";
import AccionesArchivo, { linkDescarga } from "@/components/material/AccionesArchivo";
import type { ArchivoMaterial } from "@/lib/servidor/material";

type Pendiente = { clave: string; nombre: string; tamano: number; avance: number; error?: string };

// Los destinos para "Mover" se piden una sola vez por página
const destinosCache: { pedido: Promise<DestinoMaterial[]> | null } = { pedido: null };
function cargarDestinos() {
  if (!destinosCache.pedido) destinosCache.pedido = destinosMaterial();
  return destinosCache.pedido;
}

/**
 * Un espacio de archivos de Material (v1.11): catálogo, logo y tipografías
 * de la marca, o videos, imágenes y ficha del producto. Todos ven, descargan
 * y comparten; marketing y dirección suben, cambian y borran.
 * v1.23: espacios propios ("propio") y lo entregado de un pedido ("entrega")
 * aceptan cualquier archivo; fotos y videos en grilla, el resto en lista.
 * "Mover" pasa un archivo a otro espacio sin volver a subirlo.
 */
export default function EspacioArchivos({
  dueno,
  duenoId,
  espacio,
  archivos,
  puedeGestionar,
  zipHref,
  tipoInicial,
  vacio,
}: {
  dueno: DuenoArchivo;
  duenoId: string;
  espacio: Espacio;
  archivos: ArchivoMaterial[];
  puedeGestionar: boolean;
  /** Imágenes: link para bajar todas juntas. */
  zipHref?: string;
  /** Videos: el tipo con el que se sube (Cómo usar, configurar, lavar…). */
  tipoInicial?: VideoTipo;
  vacio?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tipo, setTipo] = useState<VideoTipo>(tipoInicial ?? "usar");
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [visor, setVisor] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moviendo, setMoviendo] = useState<ArchivoMaterial | null>(null);
  const [destinos, setDestinos] = useState<DestinoMaterial[] | null>(null);
  const [destino, setDestino] = useState("");
  const medios = archivos.filter((a) => esImagen(a.mime) || esVideo(a.mime));
  const puedeMover = puedeGestionar && dueno !== "pedido";

  function empezarMover(a: ArchivoMaterial) {
    setMoviendo(a);
    setDestino("");
    setError(null);
    cargarDestinos()
      .then((d) => setDestinos(d))
      .catch(() => setError("No se pudieron cargar los espacios"));
  }

  function mover() {
    const d = destinos?.find((x) => x.clave === destino);
    if (!moviendo || !d) return;
    startTransition(async () => {
      const r = await moverArchivoMaterial(moviendo.id, { dueno: d.dueno, duenoId: d.duenoId, espacio: d.espacio });
      if (r && "error" in r && r.error) setError(r.error);
      else setMoviendo(null);
      router.refresh();
    });
  }

  function subir(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const lista = espacio === "ficha" ? [files[0]] : [...files];
    const invalido = lista.map((f) => aceptaArchivo(espacio, f)).find(Boolean);
    if (invalido) {
      setError(invalido);
      return;
    }
    const nuevos = lista.map((f) => ({ clave: `${f.name}-${f.size}-${Math.random()}`, nombre: f.name, tamano: f.size, avance: 0 }));
    setPendientes((ps) => [...ps, ...nuevos]);
    startTransition(async () => {
      const hechos: { path: string; nombre: string; mime: string | null; tamano: number }[] = [];
      for (let i = 0; i < lista.length; i++) {
        const f = lista[i];
        const clave = nuevos[i].clave;
        const path = `${dueno}/${duenoId}/${espacio}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${nombreSeguro(f.name)}`;
        const r = await subirArchivo("material", path, f, (avance) => setPendientes((ps) => ps.map((p) => (p.clave === clave ? { ...p, avance } : p))));
        if (r.error) setPendientes((ps) => ps.map((p) => (p.clave === clave ? { ...p, error: r.error } : p)));
        else hechos.push({ path, nombre: f.name, mime: f.type || null, tamano: f.size });
      }
      if (hechos.length) {
        const r = await registrarArchivosMaterial({ dueno, duenoId, espacio, videoTipo: espacio === "videos" ? tipo : null, archivos: hechos });
        if (r && "error" in r && r.error) setError(r.error);
        const ok = new Set(hechos.map((h) => h.nombre));
        setPendientes((ps) => ps.filter((p) => p.error || !ok.has(p.nombre)));
        router.refresh();
      }
    });
  }

  function borrar(a: ArchivoMaterial) {
    if (!window.confirm(`¿Eliminar “${a.nombre}”?`)) return;
    startTransition(async () => {
      const r = await borrarArchivoMaterial(a.id);
      if (r && "error" in r && r.error) setError(r.error);
      router.refresh();
    });
  }

  function cambiarTipo(a: ArchivoMaterial, t: string) {
    startTransition(async () => {
      const r = await cambiarTipoVideo(a.id, t);
      if (r && "error" in r && r.error) setError(r.error);
      router.refresh();
    });
  }

  const botonSubir = (texto: string, icono = <Upload className="h-4 w-4" />) =>
    puedeGestionar && (
      <label className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-marino px-3.5 text-[14px] font-bold text-white">
        {icono} {texto}
        <input
          type="file"
          multiple={espacio !== "ficha"}
          accept={acceptDe(espacio)}
          disabled={pending}
          onChange={(e) => {
            subir(e.target.files);
            e.target.value = "";
          }}
          className="sr-only"
        />
      </label>
    );

  const abrir = (a: ArchivoMaterial) => {
    const i = medios.findIndex((m) => m.id === a.id);
    if (i >= 0) setVisor(i);
  };

  const moverBtn = (a: ArchivoMaterial) =>
    puedeMover && (
      <button
        type="button"
        disabled={pending}
        onClick={() => empezarMover(a)}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-borde bg-white text-piedra"
        aria-label={`Mover ${a.nombre} a otro espacio`}
        title="Mover a otro espacio"
      >
        <FolderInput className="h-4 w-4" />
      </button>
    );

  const borrarBtn = (a: ArchivoMaterial) =>
    puedeGestionar && (
      <button
        type="button"
        disabled={pending}
        onClick={() => borrar(a)}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-red-200 bg-white text-red-600"
        aria-label={`Eliminar ${a.nombre}`}
        title="Eliminar"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    );

  let contenido: React.ReactNode;
  if (espacio === "ficha") {
    const f = archivos[0];
    contenido = f ? (
      <div className="space-y-2">
        {f.url && <iframe src={f.url} title={f.nombre} className="hidden h-[70vh] w-full rounded-xl border border-borde bg-white sm:block" />}
        <div className="flex flex-wrap items-center gap-2">
          {f.url && (
            <a href={f.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-verde px-3.5 text-[14px] font-bold text-white">
              <FileText className="h-4 w-4" /> Abrir ficha
            </a>
          )}
          <AccionesArchivo url={f.url} nombre={f.nombre} mime={f.mime} />
          {botonSubir("Reemplazar", <RefreshCw className="h-4 w-4" />)}
          {moverBtn(f)}
          {borrarBtn(f)}
        </div>
        <p className="truncate text-xs text-piedra">{f.nombre}</p>
      </div>
    ) : (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-[15px] text-piedra">{vacio ?? "Todavía no hay ficha."}</p>
        {botonSubir("Subir ficha (PDF)")}
      </div>
    );
  } else if (espacio === "imagenes") {
    contenido = (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {botonSubir("Subir imágenes")}
          {zipHref && archivos.length > 1 && (
            <a href={zipHref} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-borde bg-white px-3.5 text-[14px] font-bold">
              <FileArchive className="h-4 w-4" /> Descargar todas ({archivos.length})
            </a>
          )}
        </div>
        {archivos.length ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {archivos.map((a) => (
              <div key={a.id} className="overflow-hidden rounded-xl border border-borde bg-white">
                <button type="button" onClick={() => abrir(a)} className="block aspect-square w-full bg-crema" aria-label={`Ver ${a.nombre}`}>
                  {a.url && esImagen(a.mime) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.url} alt={a.nombre} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="mx-auto h-6 w-6 text-piedra" />
                  )}
                </button>
                <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                  <p className="min-w-0 truncate text-[12px] text-piedra" title={a.nombre}>
                    {a.nombre}
                  </p>
                  <span className="flex shrink-0 gap-1">
                    <AccionesArchivo url={a.url} nombre={a.nombre} mime={a.mime} compacto />
                    {moverBtn(a)}
                    {borrarBtn(a)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[15px] text-piedra">{vacio ?? "Todavía no hay imágenes."}</p>
        )}
      </div>
    );
  } else if (espacio === "videos") {
    contenido = (
      <div className="space-y-3">
        {puedeGestionar && (
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-crema p-2">
            <span className="px-1 text-sm font-bold">El video es de:</span>
            {VIDEO_TIPOS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTipo(t.value)}
                className={`min-h-9 rounded-full px-3 text-[13px] font-bold ${tipo === t.value ? "bg-marino text-white" : "border border-borde bg-white text-piedra"}`}
              >
                {t.label}
              </button>
            ))}
            {botonSubir(`Subir video (${videoTipoDe(tipo).label})`)}
          </div>
        )}
        {archivos.length ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {archivos.map((a) => (
              <div key={a.id} className="overflow-hidden rounded-xl border border-borde bg-white">
                <button type="button" onClick={() => abrir(a)} className="relative block aspect-video w-full bg-black" aria-label={`Ver ${a.nombre}`}>
                  {a.url && <video src={`${a.url}#t=0.5`} preload="metadata" muted playsInline className="h-full w-full object-contain" />}
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white">
                      <Play className="h-5 w-5" />
                    </span>
                  </span>
                </button>
                <div className="space-y-1.5 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    {puedeGestionar ? (
                      <select
                        value={a.video_tipo ?? "otro"}
                        onChange={(e) => cambiarTipo(a, e.target.value)}
                        disabled={pending}
                        aria-label="De qué es el video"
                        className="min-h-9 rounded-lg border border-borde bg-white px-2 text-[13px] font-bold"
                      >
                        {VIDEO_TIPOS.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="rounded-full bg-celeste-soft px-2.5 py-0.5 text-xs font-bold text-azul">{videoTipoDe(a.video_tipo).label}</span>
                    )}
                    <span className="flex gap-1">
                      <AccionesArchivo url={a.url} nombre={a.nombre} mime={a.mime} compacto />
                      {moverBtn(a)}
                      {borrarBtn(a)}
                    </span>
                  </div>
                  <p className="truncate text-[12px] text-piedra" title={a.nombre}>
                    {a.nombre}
                    {a.tamano ? ` · ${pesoTexto(a.tamano)}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[15px] text-piedra">{vacio ?? "Todavía no hay videos."}</p>
        )}
      </div>
    );
  } else if (espacio === "propio" || espacio === "entrega") {
    // Cualquier archivo: fotos y videos en grilla (se abren en el visor), el resto en lista
    const otros = archivos.filter((a) => !esImagen(a.mime) && !esVideo(a.mime));
    contenido = (
      <div className="space-y-2">
        {botonSubir("Subir archivos")}
        {medios.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {medios.map((a) => (
              <div key={a.id} className="overflow-hidden rounded-xl border border-borde bg-white">
                <button type="button" onClick={() => abrir(a)} className="relative block aspect-square w-full bg-crema" aria-label={`Ver ${a.nombre}`}>
                  {a.url && esImagen(a.mime) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.url} alt={a.nombre} loading="lazy" className="h-full w-full object-cover" />
                  ) : a.url ? (
                    <>
                      <video src={`${a.url}#t=0.5`} preload="metadata" muted playsInline className="h-full w-full bg-black object-contain" />
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white">
                          <Play className="h-5 w-5" />
                        </span>
                      </span>
                    </>
                  ) : (
                    <ImageIcon className="mx-auto h-6 w-6 text-piedra" />
                  )}
                </button>
                <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                  <p className="min-w-0 truncate text-[12px] text-piedra" title={a.nombre}>
                    {a.nombre}
                  </p>
                  <span className="flex shrink-0 gap-1">
                    <AccionesArchivo url={a.url} nombre={a.nombre} mime={a.mime} compacto />
                    {moverBtn(a)}
                    {borrarBtn(a)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        {otros.map((a) => (
          <div key={a.id} className="flex items-center gap-2 rounded-xl bg-crema px-2.5 py-2">
            <a href={a.url ?? "#"} target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-piedra">
              <FileText className="h-4 w-4" />
            </a>
            <a href={a.url ? linkDescarga(a.url, a.nombre) : "#"} className="min-w-0 flex-1 truncate text-[14px] font-semibold hover:underline" title={a.nombre}>
              {a.nombre}
              {a.tamano ? <span className="font-normal text-piedra"> · {pesoTexto(a.tamano)}</span> : null}
            </a>
            <AccionesArchivo url={a.url} nombre={a.nombre} mime={a.mime} compacto />
            {moverBtn(a)}
            {borrarBtn(a)}
          </div>
        ))}
        {!archivos.length && <p className="text-sm text-piedra">{vacio ?? "Vacío por ahora."}</p>}
      </div>
    );
  } else {
    // Catálogo, logo, tipografías: lista de archivos
    contenido = (
      <div className="space-y-1.5">
        {archivos.map((a) => (
          <div key={a.id} className="flex items-center gap-2 rounded-xl bg-crema px-2.5 py-2">
            {a.url && esImagen(a.mime) ? (
              <button type="button" onClick={() => abrir(a)} className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-white" aria-label={`Ver ${a.nombre}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url} alt="" className="h-full w-full object-contain" />
              </button>
            ) : (
              <a href={a.url ?? "#"} target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-piedra">
                <FileText className="h-4 w-4" />
              </a>
            )}
            <a href={a.url ? linkDescarga(a.url, a.nombre) : "#"} className="min-w-0 flex-1 truncate text-[14px] font-semibold hover:underline" title={a.nombre}>
              {a.nombre}
            </a>
            <AccionesArchivo url={a.url} nombre={a.nombre} mime={a.mime} compacto />
            {moverBtn(a)}
            {borrarBtn(a)}
          </div>
        ))}
        {!archivos.length && <p className="text-sm text-piedra">{vacio ?? "Vacío por ahora."}</p>}
        {botonSubir("Subir")}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {moviendo && (
        <div className="space-y-2 rounded-xl border border-marino/30 bg-celeste-soft p-3">
          <p className="text-[14px] font-bold">
            Mover “<span className="break-all">{moviendo.nombre}</span>” a:
          </p>
          {destinos === null ? (
            <p className="text-sm text-piedra">Cargando los espacios…</p>
          ) : (
            <select value={destino} onChange={(e) => setDestino(e.target.value)} className="min-h-11 w-full rounded-xl border border-borde bg-white px-3 text-[15px]" aria-label="Espacio de destino">
              <option value="">Elegí el espacio…</option>
              {[...new Set(destinos.map((d) => d.grupo))].map((g) => (
                <optgroup key={g} label={g}>
                  {destinos
                    .filter((d) => d.grupo === g && !(d.dueno === dueno && d.duenoId === duenoId && d.espacio === espacio))
                    .map((d) => (
                      <option key={d.clave} value={d.clave}>
                        {d.etiqueta}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          )}
          <div className="flex gap-2">
            <button type="button" disabled={pending || !destino} onClick={mover} className="min-h-10 rounded-xl bg-marino px-4 text-[14px] font-bold text-white disabled:opacity-50">
              {pending ? "Moviendo…" : "Mover"}
            </button>
            <button type="button" onClick={() => setMoviendo(null)} className="min-h-10 rounded-xl border border-borde bg-white px-4 text-[14px]">
              Cancelar
            </button>
          </div>
        </div>
      )}
      {contenido}
      {pendientes.map((p) => (
        <div key={p.clave} className="rounded-xl border border-borde bg-white px-3 py-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate">{p.nombre}</span>
            <span className="shrink-0 text-xs text-piedra">
              {pesoTexto(p.tamano)}
              {!p.error && p.avance < 100 ? ` · ${p.avance}%` : ""}
            </span>
          </div>
          {!p.error && p.avance < 100 && (
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-crema-deep">
              <div className="h-full bg-marino transition-all" style={{ width: `${p.avance}%` }} />
            </div>
          )}
          {p.error && <p className="mt-1 text-xs font-bold text-red-600">{p.error}</p>}
        </div>
      ))}
      {error && <p className="text-sm font-bold text-red-600">{error}</p>}
      {visor != null && <Visor archivos={medios} indice={visor} onCerrar={() => setVisor(null)} onMover={setVisor} />}
    </div>
  );
}
