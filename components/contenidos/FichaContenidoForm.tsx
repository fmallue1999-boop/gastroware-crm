"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Play, Trash2, X } from "lucide-react";
import { borrarArchivoContenido, borrarContenido, guardarContenido, registrarArchivosContenido } from "@/lib/actions";
import { CUENTAS, ESTADOS, TIPOS, conParams, esImagen, esVideo, estadoDe, ordenNatural } from "@/lib/contenidos";
import { nombreSeguro, pesoTexto, subirArchivo } from "@/lib/subir";
import type { ArchivoContenido, Contenido } from "@/lib/servidor/contenidos";
import { EstadoPastilla } from "@/components/contenidos/Indicadores";
import Visor from "@/components/VisorMedios";

const inputCls = "min-h-11 w-full rounded-xl border border-borde bg-white px-3 py-2 text-[15px] outline-none focus:border-marino";
const etiqueta = "block text-sm font-bold";

type Pendiente = { clave: string; archivo: File; avance: number; error?: string };

/**
 * La ficha de un contenido (v1.10): nombre, cuenta, fecha, tipo, objetivo,
 * copy, archivos, estado y corrección. Marketing carga y deja pendiente;
 * dirección general aprueba, pide re-edición o cancela y escribe la
 * corrección. Quien solo mira, la ve sin poder cambiarla.
 */
export default function FichaContenidoForm({
  contenido,
  archivos,
  inicial,
  puedeCargar,
  aprueba,
  base,
  params,
  pie,
}: {
  contenido: Contenido | null;
  archivos: ArchivoContenido[];
  inicial: { fecha: string; tipo: string };
  puedeCargar: boolean;
  aprueba: boolean;
  /** Pantalla donde está abierta (calendario o listado) y sus parámetros, para no perder la vista. */
  base: string;
  params: Record<string, string | null>;
  pie?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [nombre, setNombre] = useState(contenido?.nombre ?? "");
  const [cuenta, setCuenta] = useState(contenido?.cuenta ?? "");
  const [fecha, setFecha] = useState(contenido?.fecha ?? inicial.fecha);
  const [tipo, setTipo] = useState(contenido?.tipo ?? inicial.tipo);
  const [objetivo, setObjetivo] = useState(contenido?.objetivo ?? "");
  const [copy, setCopy] = useState(contenido?.copy ?? "");
  const estadoActual = contenido?.estado ?? "pendiente";
  const [estado, setEstado] = useState(estadoActual);
  const [correccion, setCorreccion] = useState(contenido?.correccion ?? "");
  const [reenviar, setReenviar] = useState(estadoActual === "reedicion");
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [visor, setVisor] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ texto: string; error?: boolean } | null>(null);
  const soloMirar = !puedeCargar;
  const ordenados = ordenNatural(archivos);

  const cerrarHref = conParams(base, params, { ficha: null, nueva: null, fecha: null, tipo: null });

  /** Sube los archivos a la ficha y los registra. */
  async function subir(contenidoId: string, lista: Pendiente[]): Promise<boolean> {
    const hechos: { path: string; nombre: string; mime: string | null; tamano: number }[] = [];
    let ok = true;
    for (const p of lista) {
      const path = `${contenidoId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${nombreSeguro(p.archivo.name)}`;
      const r = await subirArchivo("contenidos", path, p.archivo, (avance) =>
        setPendientes((ps) => ps.map((x) => (x.clave === p.clave ? { ...x, avance } : x)))
      );
      if (r.error) {
        ok = false;
        setPendientes((ps) => ps.map((x) => (x.clave === p.clave ? { ...x, error: r.error } : x)));
      } else hechos.push({ path, nombre: p.archivo.name, mime: p.archivo.type || null, tamano: p.archivo.size });
    }
    if (hechos.length) {
      const r = await registrarArchivosContenido(contenidoId, hechos);
      if (r && "error" in r && r.error) {
        setMsg({ texto: r.error, error: true });
        return false;
      }
      const subidos = new Set(hechos.map((h) => h.nombre));
      setPendientes((ps) => ps.filter((x) => x.error || !subidos.has(x.archivo.name)));
    }
    return ok;
  }

  function elegirArchivos(files: FileList | null) {
    if (!files?.length) return;
    const nuevos = [...files]
      .filter((f) => esImagen(f.type) || esVideo(f.type))
      .map((archivo) => ({ clave: `${archivo.name}-${archivo.size}-${Math.random()}`, archivo, avance: 0 }));
    if (nuevos.length < files.length) setMsg({ texto: "Solo se pueden agregar imágenes y videos.", error: true });
    if (!nuevos.length) return;
    if (!contenido) {
      // Ficha nueva: se suben al guardar
      setPendientes((ps) => [...ps, ...nuevos]);
      return;
    }
    setPendientes((ps) => [...ps, ...nuevos]);
    startTransition(async () => {
      await subir(contenido.id, nuevos);
      router.refresh();
    });
  }

  function guardar() {
    setMsg(null);
    if (!nombre.trim() || !cuenta || !fecha || !tipo) {
      setMsg({ texto: "Completá nombre, cuenta, fecha y tipo.", error: true });
      return;
    }
    const estadoFinal = aprueba ? estado : reenviar || !contenido ? "pendiente" : estadoActual;
    startTransition(async () => {
      const r = await guardarContenido(contenido?.id ?? null, { nombre, cuenta, fecha, tipo, objetivo, copy, estado: estadoFinal, correccion });
      if ("error" in r) {
        setMsg({ texto: r.error, error: true });
        return;
      }
      if (!contenido) {
        const aSubir = pendientes.filter((p) => !p.error);
        if (aSubir.length && !(await subir(r.id, aSubir))) {
          setMsg({ texto: "El contenido se creó, pero algún archivo no se pudo subir. Probá de nuevo desde la ficha.", error: true });
        }
        router.replace(conParams(base, params, { ficha: r.id, nueva: null, fecha: null, tipo: null }), { scroll: false });
        router.refresh();
        return;
      }
      setMsg({ texto: "Guardado ✓" });
      router.refresh();
    });
  }

  function eliminar() {
    if (!contenido || !window.confirm("¿Querés eliminar este contenido?")) return;
    startTransition(async () => {
      const r = await borrarContenido(contenido.id);
      if (r && "error" in r && r.error) {
        setMsg({ texto: r.error, error: true });
        return;
      }
      router.replace(cerrarHref, { scroll: false });
      router.refresh();
    });
  }

  function quitarArchivo(a: ArchivoContenido) {
    if (!window.confirm(`¿Eliminar “${a.nombre}”?`)) return;
    startTransition(async () => {
      const r = await borrarArchivoContenido(a.id);
      if (r && "error" in r && r.error) setMsg({ texto: r.error, error: true });
      router.refresh();
    });
  }

  const chip = (on: boolean) => `min-h-10 rounded-full px-3.5 text-[14px] font-bold ${on ? "bg-marino text-white" : "border border-borde bg-white text-piedra"}`;

  return (
    <div className="space-y-4">
      {/* Nombre y lo principal */}
      <label className={etiqueta}>
        Nombre *
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} disabled={soloMirar} placeholder="Ej: 22 naranjas por minuto" className={`${inputCls} mt-1 font-normal`} />
      </label>

      <div>
        <p className={etiqueta}>Cuenta *</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {CUENTAS.map((c) => (
            <button key={c.value} type="button" disabled={soloMirar} onClick={() => setCuenta(c.value)} className={`${chip(cuenta === c.value)} inline-flex items-center gap-1.5`}>
              <span className={`h-3 w-1.5 rounded-full ${c.punto}`} /> {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={etiqueta}>
          Fecha *
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} disabled={soloMirar} className={`${inputCls} mt-1 font-normal`} />
        </label>
        <div>
          <p className={etiqueta}>Tipo *</p>
          <div className="mt-1 flex gap-1.5">
            {TIPOS.map((t) => (
              <button key={t.value} type="button" disabled={soloMirar} onClick={() => setTipo(t.value)} className={chip(tipo === t.value)}>
                {t.fila}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Estado y corrección */}
      <div className="space-y-2 rounded-2xl border border-borde bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={etiqueta}>Estado</p>
          {!aprueba && <EstadoPastilla estado={estadoActual} />}
        </div>
        {aprueba ? (
          <div className="flex flex-wrap gap-1.5">
            {ESTADOS.map((e) => (
              <button
                key={e.value}
                type="button"
                onClick={() => setEstado(e.value)}
                className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-[14px] font-bold ${estado === e.value ? "bg-marino text-white" : "border border-borde bg-white text-tinta"}`}
              >
                <span className={`h-2 w-2 rounded-full ${e.punto}`} /> {e.label}
              </button>
            ))}
          </div>
        ) : (
          puedeCargar &&
          contenido &&
          estadoActual !== "pendiente" && (
            <label className="flex min-h-10 items-center gap-2 text-[14px] font-semibold">
              <input type="checkbox" checked={reenviar} onChange={(e) => setReenviar(e.target.checked)} className="h-5 w-5" />
              Al guardar, mandarlo a aprobar de nuevo
            </label>
          )
        )}
        {(aprueba || correccion) && (
          <label className={etiqueta}>
            Corrección {aprueba ? "(qué hay que cambiar)" : "de dirección"}
            {aprueba ? (
              <textarea
                value={correccion}
                onChange={(e) => setCorreccion(e.target.value)}
                rows={3}
                placeholder="Modificaciones, observaciones o instrucciones para la nueva versión"
                className={`${inputCls} mt-1 font-normal`}
              />
            ) : (
              <p className="mt-1 whitespace-pre-wrap rounded-xl bg-estado-reedicion-soft px-3 py-2 text-[15px] font-normal">{correccion}</p>
            )}
          </label>
        )}
        {!aprueba && !contenido && <p className="text-xs text-piedra">Queda {estadoDe("pendiente").label.toLowerCase()}: le llega el aviso a dirección.</p>}
      </div>

      <label className={etiqueta}>
        Objetivo
        <input value={objetivo} onChange={(e) => setObjetivo(e.target.value)} disabled={soloMirar} placeholder="Qué buscamos con este contenido" className={`${inputCls} mt-1 font-normal`} />
      </label>

      <label className={etiqueta}>
        Copy
        {soloMirar ? (
          <p className="mt-1 min-h-11 whitespace-pre-wrap rounded-xl border border-borde bg-white px-3 py-2 text-[15px] font-normal">{copy || "—"}</p>
        ) : (
          <textarea value={copy} onChange={(e) => setCopy(e.target.value)} rows={6} placeholder="El texto de la publicación" className={`${inputCls} mt-1 font-normal`} />
        )}
      </label>

      {/* Multimedia */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className={etiqueta}>Multimedia {ordenados.length ? `(${ordenados.length})` : ""}</p>
          {puedeCargar && (
            <label className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-borde bg-white px-3 text-[14px] font-bold">
              <ImagePlus className="h-4 w-4" /> Agregar imágenes o videos
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={(e) => {
                  elegirArchivos(e.target.files);
                  e.target.value = "";
                }}
                className="sr-only"
              />
            </label>
          )}
        </div>
        {ordenados.length > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {ordenados.map((a, i) => (
              <div key={a.id} className="group relative overflow-hidden rounded-xl border border-borde bg-crema">
                <button type="button" onClick={() => setVisor(i)} className="block aspect-square w-full" aria-label={`Ver ${a.nombre}`}>
                  {a.url && esImagen(a.mime) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.url} alt={a.nombre} loading="lazy" className="h-full w-full object-cover" />
                  ) : a.url && esVideo(a.mime) ? (
                    <span className="relative block h-full w-full">
                      <video src={`${a.url}#t=0.5`} preload="metadata" muted playsInline className="h-full w-full object-cover" />
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white">
                          <Play className="h-4 w-4" />
                        </span>
                      </span>
                    </span>
                  ) : (
                    <span className="flex h-full items-center justify-center text-xs text-piedra">Sin vista</span>
                  )}
                </button>
                <p className="truncate px-1.5 py-1 text-[11px] text-piedra" title={a.nombre}>
                  {a.nombre}
                </p>
                {puedeCargar && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => quitarArchivo(a)}
                    className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-red-600 shadow"
                    aria-label={`Eliminar ${a.nombre}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {pendientes.length > 0 && (
          <div className="space-y-1.5">
            {pendientes.map((p) => (
              <div key={p.clave} className="rounded-xl border border-borde bg-white px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate">{p.archivo.name}</span>
                  <span className="shrink-0 text-xs text-piedra">
                    {pesoTexto(p.archivo.size)}
                    {!contenido && !p.avance ? " · se sube al guardar" : p.avance < 100 && !p.error ? ` · ${p.avance}%` : ""}
                  </span>
                  {!contenido && (
                    <button type="button" onClick={() => setPendientes((ps) => ps.filter((x) => x.clave !== p.clave))} aria-label="Quitar" className="text-piedra">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {p.avance > 0 && p.avance < 100 && !p.error && (
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-crema-deep">
                    <div className="h-full bg-marino transition-all" style={{ width: `${p.avance}%` }} />
                  </div>
                )}
                {p.error && <p className="mt-1 text-xs font-bold text-red-600">{p.error}</p>}
              </div>
            ))}
          </div>
        )}
        {!ordenados.length && !pendientes.length && <p className="text-sm text-piedra">Sin archivos todavía. Se ordenan por nombre (01_portada, 02_producto…).</p>}
      </div>

      {msg && <p className={`text-sm font-bold ${msg.error ? "text-red-600" : "text-verde"}`}>{msg.texto}</p>}

      {puedeCargar && (
        <div className="fijo-abajo sticky bottom-0 -mx-4 flex flex-wrap items-center gap-2 border-t border-borde bg-crema/95 px-4 py-3 backdrop-blur">
          <button type="button" disabled={pending} onClick={guardar} className="min-h-11 flex-1 rounded-xl bg-marino px-5 text-[15px] font-extrabold text-white disabled:opacity-60 sm:flex-none">
            {pending ? "Guardando…" : contenido ? "Guardar cambios" : "Crear contenido"}
          </button>
          {contenido && (
            <button type="button" disabled={pending} onClick={eliminar} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-red-200 bg-white px-4 text-[15px] font-bold text-red-600">
              <Trash2 className="h-4 w-4" /> Eliminar
            </button>
          )}
        </div>
      )}
      {pie && <p className="text-xs text-piedra">{pie}</p>}

      {visor != null && <Visor archivos={ordenados} indice={visor} onCerrar={() => setVisor(null)} onMover={setVisor} />}
    </div>
  );
}
