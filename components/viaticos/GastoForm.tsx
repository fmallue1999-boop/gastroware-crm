"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, FileText, Loader2, Sparkles, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { borrarGasto, crearGasto, descartarComprobante, editarGasto, leerComprobante, type DatosGasto } from "@/lib/actions/viaticos";
import { CATEGORIAS_GASTO, MEDIOS_PAGO_GASTO, TIPOS_COMPROBANTE } from "@/lib/viaticos";
import ClienteSelector, { type ClienteElegido } from "@/components/ClienteSelector";

const MAX_BYTES = 15 * 1024 * 1024;
const campo = "min-h-11 w-full min-w-0 rounded-xl border border-borde bg-white px-3 text-[15px] outline-none focus:border-marino";
const chip = (activo: boolean) =>
  `min-h-11 rounded-xl px-3 text-[15px] font-semibold ${activo ? "bg-marino text-white" : "border border-borde bg-white text-tinta/80"}`;

/** Achica la foto (2000 px, JPEG): el ticket se sigue leyendo y pesa poco. */
async function comprimir(archivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((ok, mal) => canvas.toBlob((b) => (b ? ok(b) : mal(new Error("No se pudo preparar la foto"))), "image/jpeg", 0.85));
}

const importeTexto = (n: number | null | undefined) => (n ? String(n).replace(".", ",") : "");

export type GastoInicial = DatosGasto & { cliente?: ClienteElegido | null };

/**
 * Cargar o corregir un gasto de viáticos (v1.25). Primero el comprobante:
 * foto o PDF; la IA lee fecha, importe, comercio, CUIT, comprobante y de qué
 * es, y completa el formulario para revisar. También se puede cargar a mano.
 */
export default function GastoForm({
  usuarioId,
  hoy,
  iaOn,
  id,
  inicial,
  urlComprobante,
}: {
  usuarioId: string;
  hoy: string;
  iaOn: boolean;
  /** Si viene, se corrige ese gasto. */
  id?: string;
  inicial?: GastoInicial;
  urlComprobante?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fecha, setFecha] = useState(inicial?.fecha ?? hoy);
  const [categoria, setCategoria] = useState(inicial?.categoria ?? "");
  const [importe, setImporte] = useState(inicial ? importeTexto(Number(inicial.importe)) : "");
  const [moneda, setMoneda] = useState(inicial?.moneda ?? "ARS");
  const [medio, setMedio] = useState(inicial?.medio_pago ?? "propio");
  const [comercio, setComercio] = useState(inicial?.comercio ?? "");
  const [cuit, setCuit] = useState(inicial?.cuit ?? "");
  const [tipo, setTipo] = useState(inicial?.tipo_comprobante ?? "");
  const [numero, setNumero] = useState(inicial?.numero_comprobante ?? "");
  const [iva, setIva] = useState(inicial?.iva ? importeTexto(Number(inicial.iva)) : "");
  const [detalle, setDetalle] = useState(inicial?.detalle ?? "");
  const [cliente, setCliente] = useState<ClienteElegido | null>(inicial?.cliente ?? null);
  const [archivo, setArchivo] = useState<{ path: string; vista: string | null; pdf: boolean } | null>(
    inicial?.archivoPath ? { path: inicial.archivoPath, vista: urlComprobante ?? null, pdf: inicial.archivoPath.toLowerCase().endsWith(".pdf") } : null
  );
  const [leidoPorIA, setLeidoPorIA] = useState(Boolean(inicial?.leidoPorIA));
  const [paso, setPaso] = useState<null | "subiendo" | "leyendo">(null);
  const [avisoIA, setAvisoIA] = useState<{ ok: boolean; texto: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState<string | null>(null);
  const [borrando, setBorrando] = useState(false);
  const original = inicial?.archivoPath ?? null;

  /** Un comprobante subido que no se guardó: se borra. */
  function descartar(path: string | null | undefined) {
    if (path && path !== original) void descartarComprobante(path);
  }

  function limpiar() {
    setFecha(hoy);
    setCategoria("");
    setImporte("");
    setMoneda("ARS");
    setMedio("propio");
    setComercio("");
    setCuit("");
    setTipo("");
    setNumero("");
    setIva("");
    setDetalle("");
    setCliente(null);
    setArchivo(null);
    setLeidoPorIA(false);
    setAvisoIA(null);
  }

  async function alElegir(f: File) {
    setError(null);
    setAvisoIA(null);
    setGuardado(null);
    const pdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    setPaso("subiendo");
    let cuerpo: Blob = f;
    let tipoArchivo = pdf ? "application/pdf" : f.type;
    if (!pdf) {
      try {
        cuerpo = await comprimir(f);
        tipoArchivo = "image/jpeg";
      } catch {
        if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
          setPaso(null);
          setError("No pude abrir esa imagen. Sacá la foto con la cámara o subí un PDF.");
          return;
        }
      }
    }
    if (cuerpo.size > MAX_BYTES) {
      setPaso(null);
      setError("El archivo es muy grande (hasta 15 MB).");
      return;
    }
    const ext = pdf ? "pdf" : tipoArchivo === "image/png" ? "png" : tipoArchivo === "image/webp" ? "webp" : "jpg";
    const path = `${usuarioId}/${crypto.randomUUID()}.${ext}`;
    const { error: errSubir } = await createClient().storage.from("viaticos").upload(path, cuerpo, { contentType: tipoArchivo });
    if (errSubir) {
      setPaso(null);
      setError(`No se pudo subir el comprobante: ${errSubir.message}`);
      return;
    }
    descartar(archivo?.path);
    setArchivo({ path, vista: pdf ? null : URL.createObjectURL(cuerpo), pdf });
    setLeidoPorIA(false);
    if (!iaOn) {
      setPaso(null);
      return;
    }
    setPaso("leyendo");
    const r = await leerComprobante(path);
    setPaso(null);
    if ("error" in r) {
      setAvisoIA({ ok: false, texto: `No pude leer el comprobante (${r.error}). Completá los datos a mano.` });
      return;
    }
    const d = r.datos;
    if (d.fecha) setFecha(d.fecha);
    if (d.importe) setImporte(importeTexto(d.importe));
    setMoneda(d.moneda);
    if (d.categoria) setCategoria(d.categoria);
    if (d.comercio) setComercio(d.comercio);
    if (d.cuit) setCuit(d.cuit);
    if (d.tipo_comprobante) setTipo(d.tipo_comprobante);
    if (d.numero_comprobante) setNumero(d.numero_comprobante);
    setIva(d.iva ? importeTexto(d.iva) : "");
    if (d.detalle) setDetalle(d.detalle);
    setLeidoPorIA(true);
    setAvisoIA(
      d.legible && d.importe
        ? { ok: true, texto: "La IA completó los datos del comprobante: revisalos antes de guardar." }
        : { ok: false, texto: "El comprobante no se lee bien: revisá los datos o sacá otra foto." }
    );
  }

  function quitarArchivo() {
    descartar(archivo?.path);
    setArchivo(null);
    setLeidoPorIA(false);
    setAvisoIA(null);
  }

  function guardar() {
    setError(null);
    setGuardado(null);
    const datos: DatosGasto = {
      fecha,
      categoria,
      importe,
      moneda,
      medio_pago: medio,
      comercio,
      cuit,
      tipo_comprobante: tipo,
      numero_comprobante: numero,
      iva,
      detalle,
      clienteId: cliente?.id ?? null,
      archivoPath: archivo?.path ?? null,
      leidoPorIA,
    };
    startTransition(async () => {
      const r = id ? await editarGasto(id, datos) : await crearGasto(datos);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      if (id) {
        router.push("/viaticos");
        return;
      }
      limpiar();
      setGuardado("Gasto guardado. Podés cargar otro o rendir los que tenés.");
      router.refresh();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function borrar() {
    if (!id) return;
    setError(null);
    startTransition(async () => {
      const r = await borrarGasto(id);
      if ("error" in r) setError(r.error);
      else router.push("/viaticos");
    });
  }

  const ocupado = pending || paso !== null;

  return (
    <div className="space-y-4">
      {guardado && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-verde-soft px-4 py-3">
          <p className="text-[15px] font-bold text-verde">✓ {guardado}</p>
          <Link href="/viaticos" className="text-[15px] font-bold text-marino underline">
            Ver mis gastos
          </Link>
        </div>
      )}

      {/* El comprobante */}
      <section className="space-y-2 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-xs font-bold uppercase tracking-wide text-piedra">Comprobante</h2>
        {archivo ? (
          <div className="flex items-center gap-3">
            {archivo.pdf || !archivo.vista ? (
              <span className="flex h-20 w-16 shrink-0 items-center justify-center rounded-xl bg-crema text-piedra">
                <FileText className="h-7 w-7" />
              </span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={archivo.vista} alt="Comprobante" className="h-20 w-16 shrink-0 rounded-xl object-cover" />
            )}
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-[15px] font-bold">{archivo.pdf ? "PDF del comprobante" : "Foto del comprobante"}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[14px]">
                <label className="cursor-pointer font-bold text-azul underline">
                  Cambiar
                  <input type="file" accept="image/*,application/pdf" className="sr-only" disabled={ocupado} onChange={(e) => e.target.files?.[0] && alElegir(e.target.files[0])} />
                </label>
                <button type="button" onClick={quitarArchivo} disabled={ocupado} className="text-piedra underline">
                  Quitar
                </button>
              </div>
            </div>
          </div>
        ) : (
          <label className={`flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-borde bg-crema px-4 py-4 text-center ${ocupado ? "opacity-60" : ""}`}>
            <Camera className="h-7 w-7 text-tinta/70" />
            <span className="text-[16px] font-extrabold">Sacale foto al ticket o subí el PDF</span>
            <span className="text-[14px] text-piedra">{iaOn ? "La IA lee la fecha, el importe y el comercio" : "Queda guardado con el gasto"}</span>
            <input type="file" accept="image/*,application/pdf" className="sr-only" disabled={ocupado} onChange={(e) => e.target.files?.[0] && alElegir(e.target.files[0])} />
          </label>
        )}
        {paso && (
          <p className="flex items-center gap-2 text-[15px] font-bold text-violeta">
            {paso === "leyendo" ? <Sparkles className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}
            {paso === "subiendo" ? "Subiendo el comprobante…" : "Leyendo el comprobante con IA…"}
          </p>
        )}
        {avisoIA && <p className={`text-[14px] font-bold ${avisoIA.ok ? "text-violeta" : "text-ambar"}`}>{avisoIA.ok ? "✓ " : ""}{avisoIA.texto}</p>}
      </section>

      {/* Lo principal */}
      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-[14px] font-bold text-tinta/80">Fecha</span>
            <input type="date" value={fecha} max={hoy} onChange={(e) => setFecha(e.target.value)} className={campo} />
          </label>
          <div className="space-y-1">
            <span className="text-[14px] font-bold text-tinta/80">Importe total</span>
            <div className="flex gap-2">
              <input
                value={importe}
                onChange={(e) => setImporte(e.target.value)}
                inputMode="decimal"
                placeholder="0"
                className={`${campo} flex-1`}
                aria-label="Importe total"
              />
              <select value={moneda} onChange={(e) => setMoneda(e.target.value)} className="min-h-11 rounded-xl border border-borde bg-white px-2 text-[15px]" aria-label="Moneda">
                <option value="ARS">$</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="text-[14px] font-bold text-tinta/80">¿De qué es?</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CATEGORIAS_GASTO.map((c) => (
              <button key={c.value} type="button" onClick={() => setCategoria(c.value)} className={chip(categoria === c.value)}>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="text-[14px] font-bold text-tinta/80">¿Cómo se pagó?</span>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {MEDIOS_PAGO_GASTO.map((m) => (
              <button key={m.value} type="button" onClick={() => setMedio(m.value)} className={`${chip(medio === m.value)} py-1.5 text-left leading-tight`}>
                <span className="block">{m.label}</span>
                <span className={`block text-xs font-normal ${medio === m.value ? "text-white/80" : "text-piedra"}`}>{m.detalle}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Datos del comprobante */}
      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-xs font-bold uppercase tracking-wide text-piedra">Datos del comprobante</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-[14px] font-bold text-tinta/80">Comercio</span>
            <input value={comercio} onChange={(e) => setComercio(e.target.value)} placeholder="Ej: YPF Ruta 2" className={campo} />
          </label>
          <label className="block space-y-1">
            <span className="text-[14px] font-bold text-tinta/80">CUIT del comercio</span>
            <input value={cuit} onChange={(e) => setCuit(e.target.value)} inputMode="numeric" placeholder="30-12345678-9" className={campo} />
          </label>
          <label className="block space-y-1">
            <span className="text-[14px] font-bold text-tinta/80">Tipo de comprobante</span>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={campo}>
              <option value="">—</option>
              {TIPOS_COMPROBANTE.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-[14px] font-bold text-tinta/80">Número</span>
            <input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="0003-00012345" className={campo} />
          </label>
          <label className="block space-y-1">
            <span className="text-[14px] font-bold text-tinta/80">IVA (si está discriminado)</span>
            <input value={iva} onChange={(e) => setIva(e.target.value)} inputMode="decimal" placeholder="0" className={campo} />
          </label>
        </div>
      </section>

      {/* Para qué fue */}
      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <div className="space-y-1">
          <span className="text-[14px] font-bold text-tinta/80">¿Fue por la visita a un cliente? (opcional)</span>
          <ClienteSelector valor={cliente} onChange={setCliente} placeholder="Buscar el cliente que visitaste" />
        </div>
        <label className="block space-y-1">
          <span className="text-[14px] font-bold text-tinta/80">Detalle (opcional)</span>
          <textarea
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
            rows={2}
            placeholder="Ej: viaje a Mar del Plata para la demo"
            className="w-full min-w-0 rounded-xl border border-borde bg-white px-3 py-2.5 text-[15px] outline-none focus:border-marino"
          />
        </label>
      </section>

      {error && <p className="text-[15px] font-bold text-red-600">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={guardar}
          disabled={ocupado}
          className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-verde px-5 text-[16px] font-extrabold text-white disabled:opacity-50 sm:flex-none"
        >
          {pending ? "Guardando…" : id ? "Guardar cambios" : "Guardar gasto"}
        </button>
        <Link
          href="/viaticos"
          onClick={() => descartar(archivo?.path)}
          className="inline-flex min-h-12 items-center rounded-xl border border-borde bg-white px-4 text-[15px] font-bold text-tinta/80"
        >
          {guardado ? "Listo" : "Cancelar"}
        </Link>
        {id &&
          (borrando ? (
            <span className="flex items-center gap-2 text-[15px]">
              ¿Borrar el gasto?
              <button type="button" onClick={borrar} disabled={pending} className="min-h-11 rounded-xl bg-red-600 px-3 font-bold text-white">
                Borrar
              </button>
              <button type="button" onClick={() => setBorrando(false)} className="inline-flex min-h-11 items-center px-1 text-piedra" aria-label="No borrar">
                <X className="h-4 w-4" />
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setBorrando(true)} className="inline-flex min-h-11 items-center gap-1 px-2 text-[15px] text-red-600">
              <Trash2 className="h-4 w-4" /> Borrar
            </button>
          ))}
      </div>
    </div>
  );
}
