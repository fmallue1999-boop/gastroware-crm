"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Search } from "lucide-react";
import { buscarClientes, crearSolicitudRepuesto, equiposYSucursalesDe } from "@/lib/actions";
import { ACCIONES, type Accion } from "@/lib/actividad";
import { DISPONIBILIDADES } from "@/lib/repuestos";
import { fechaCorta, hoyISO, sumarDias, telefonoProlijo } from "@/lib/format";
import type { Cliente } from "@/lib/types";

type Equipo = { id: string; nombre: string; serie: string | null };
type Persona = { id: string; nombre: string; rol: string };

const cls = "min-h-11 w-full rounded-xl border border-borde bg-white px-3 text-[15px] outline-none focus:border-marino";
const seccion = "text-xs font-bold uppercase tracking-wide text-piedra";
const chip = (activo: boolean) => `min-h-10 rounded-full px-3.5 text-[15px] font-semibold ${activo ? "bg-marino text-white" : "border border-borde bg-white text-tinta/80"}`;

/** Achica la foto a 1400 px y la devuelve en JPEG (base64 sin prefijo). */
async function comprimir(archivo: File): Promise<string> {
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
}

/**
 * Nueva solicitud de repuesto: cliente, equipo (o modelo y serie), qué pieza
 * (del catálogo o descripta, con código o foto), cantidad y si hace falta que
 * servicio técnico la valide. Precio y disponibilidad se pueden cargar ya o al
 * cotizar.
 */
export default function SolicitudRepuestoForm({
  yo,
  catalogo,
  personas,
  clienteInicial,
  equiposIniciales = [],
  equipoInicial,
  casoId,
  otId,
  descripcionInicial = "",
}: {
  yo: string;
  catalogo: { id: string; descripcion: string; codigo_interno: string | null; stock: number | null }[];
  personas: Persona[];
  clienteInicial?: { id: string; nombre: string } | null;
  equiposIniciales?: Equipo[];
  equipoInicial?: string | null;
  casoId?: string | null;
  otId?: string | null;
  descripcionInicial?: string;
}) {
  const router = useRouter();
  const hoy = hoyISO();
  const [pending, startTransition] = useTransition();
  const [cliente, setCliente] = useState<{ id: string; nombre: string } | null>(clienteInicial ?? null);
  const [nuevo, setNuevo] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [telNuevo, setTelNuevo] = useState("");
  const [empresaNueva, setEmpresaNueva] = useState("");
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<Cliente[]>([]);
  const [equipos, setEquipos] = useState<Equipo[]>(equiposIniciales);
  const [equipoId, setEquipoId] = useState<string>(equipoInicial ?? "");
  const [modelo, setModelo] = useState("");
  const [serie, setSerie] = useState("");
  const [repuestoId, setRepuestoId] = useState("");
  const [descripcion, setDescripcion] = useState(descripcionInicial);
  const [codigo, setCodigo] = useState("");
  const [foto, setFoto] = useState<string | null>(null);
  const [cantidad, setCantidad] = useState("1");
  const validadores = personas.filter((p) => p.rol === "servicio" || p.rol === "tecnico");
  const [requiere, setRequiere] = useState(true);
  const [validador, setValidador] = useState(validadores.find((p) => p.rol === "servicio")?.id ?? validadores[0]?.id ?? "");
  const [precio, setPrecio] = useState("");
  const [moneda, setMoneda] = useState<"ARS" | "USD">("ARS");
  const [disp, setDisp] = useState("");
  const [plazo, setPlazo] = useState("");
  const vendedores = personas.filter((p) => ["comercial", "direccion", "admin", "administrativa"].includes(p.rol));
  const [comercial, setComercial] = useState(vendedores.some((v) => v.id === yo) ? yo : "");
  const [accion, setAccion] = useState<Accion>("cotizar");
  const [volverEl, setVolverEl] = useState(sumarDias(2));
  const [duplicados, setDuplicados] = useState<{ id: string; nombre: string; telefono: string | null; por: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function buscar(texto: string) {
    setQ(texto);
    if (timer.current) clearTimeout(timer.current);
    if (texto.trim().length < 2) return setResultados([]);
    timer.current = setTimeout(async () => setResultados(await buscarClientes(texto)), 250);
  }

  async function elegirCliente(c: { id: string; nombre: string }) {
    setCliente(c);
    setResultados([]);
    setNuevo(false);
    setDuplicados([]);
    const r = await equiposYSucursalesDe(c.id);
    setEquipos(r.equipos);
    setEquipoId("");
  }

  function elegirRepuesto(id: string) {
    setRepuestoId(id);
    const r = catalogo.find((x) => x.id === id);
    if (r) {
      if (!descripcion.trim()) setDescripcion(r.descripcion);
      if (r.codigo_interno) setCodigo(r.codigo_interno);
      if (r.stock != null && r.stock > 0) setDisp("en_stock");
      setRequiere(false);
    }
  }

  const listo = (Boolean(cliente) || (nuevo && nombreNuevo.trim().length > 0)) && descripcion.trim().length > 0 && Number(cantidad) > 0;

  function guardar(crearIgual = false) {
    setError(null);
    const equipo = equipos.find((e) => e.id === equipoId);
    startTransition(async () => {
      const r = await crearSolicitudRepuesto({
        clienteId: cliente?.id ?? null,
        clienteNuevo: !cliente && nuevo ? { nombre: nombreNuevo, telefono: telNuevo, empresa: empresaNueva } : null,
        crearIgual,
        equipoId: equipoId || null,
        modeloTexto: equipoId ? equipo?.nombre ?? null : modelo || null,
        numeroSerie: equipoId ? equipo?.serie ?? null : serie || null,
        repuestoId: repuestoId || null,
        descripcion,
        codigo,
        fotoBase64: foto,
        cantidad: Number(cantidad.replace(",", ".")),
        requiereValidacion: requiere,
        validadorId: requiere ? validador || null : null,
        precioUnitario: precio.trim() ? Number(precio.replace(/\./g, "").replace(",", ".")) : null,
        moneda,
        disponibilidad: disp || null,
        plazoDias: plazo ? Number(plazo) : null,
        comercialId: comercial || null,
        casoId: casoId ?? null,
        otId: otId ?? null,
        proximo: volverEl ? { fecha: volverEl, accion } : null,
      });
      if (r && "duplicados" in r && r.duplicados?.length) {
        setDuplicados(r.duplicados);
        return;
      }
      if (r && "error" in r && r.error) {
        setError(r.error);
        return;
      }
      router.push("/repuestos");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {/* Cliente */}
      <section className="space-y-2">
        <p className={seccion}>Cliente</p>
        {cliente ? (
          <div className="flex items-center justify-between gap-2 rounded-2xl bg-white p-3.5 shadow-sm">
            <p className="text-[16px] font-extrabold">{cliente.nombre}</p>
            {!clienteInicial && (
              <button type="button" onClick={() => setCliente(null)} className="text-sm text-azul underline">
                Cambiar
              </button>
            )}
          </div>
        ) : nuevo ? (
          <div className="space-y-2 rounded-2xl bg-white p-3.5 shadow-sm">
            <input autoFocus value={nombreNuevo} onChange={(e) => setNombreNuevo(e.target.value)} placeholder="Nombre de la persona" className={cls} />
            <input type="tel" value={telNuevo} onChange={(e) => setTelNuevo(e.target.value)} placeholder="Teléfono / WhatsApp" className={cls} />
            <input value={empresaNueva} onChange={(e) => setEmpresaNueva(e.target.value)} placeholder="Empresa o negocio" className={cls} />
            <button type="button" onClick={() => setNuevo(false)} className="text-sm text-azul underline">
              Buscar en la base
            </button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-piedra" />
              <input type="search" value={q} onChange={(e) => buscar(e.target.value)} placeholder="Nombre, empresa o teléfono" className={`${cls} pl-10`} autoFocus />
            </div>
            {resultados.map((c) => (
              <button key={c.id} type="button" onClick={() => elegirCliente({ id: c.id, nombre: c.nombre_comercial })} className="flex min-h-12 w-full items-center rounded-2xl bg-white px-4 text-left shadow-sm">
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-bold">{c.nombre_comercial}</span>
                  <span className="block text-xs text-piedra">{[c.ciudad, c.telefono ? telefonoProlijo(c.telefono) : null].filter(Boolean).join(" · ")}</span>
                </span>
              </button>
            ))}
            <button type="button" onClick={() => setNuevo(true)} className="flex min-h-12 w-full items-center rounded-2xl border border-dashed border-borde bg-white px-4 text-[15px] font-bold underline">
              Es alguien nuevo, cargarlo
            </button>
          </>
        )}
      </section>

      {/* Equipo */}
      <section className="space-y-2">
        <p className={seccion}>Equipo</p>
        {equipos.length > 0 && (
          <select value={equipoId} onChange={(e) => setEquipoId(e.target.value)} className={cls}>
            <option value="">No está cargado / otro equipo</option>
            {equipos.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
                {e.serie ? ` · serie ${e.serie}` : ""}
              </option>
            ))}
          </select>
        )}
        {!equipoId && (
          <div className="grid grid-cols-2 gap-2">
            <input value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="Equipo y modelo (ej: Jetinno JL36)" className={cls} />
            <input value={serie} onChange={(e) => setSerie(e.target.value)} placeholder="Número de serie" className={cls} />
          </div>
        )}
      </section>

      {/* Pieza */}
      <section className="space-y-2">
        <p className={seccion}>¿Qué repuesto?</p>
        {catalogo.length > 0 && (
          <select value={repuestoId} onChange={(e) => elegirRepuesto(e.target.value)} className={cls}>
            <option value="">No sé / no está en el catálogo</option>
            {catalogo.map((r) => (
              <option key={r.id} value={r.id}>
                {r.descripcion}
                {r.codigo_interno ? ` (${r.codigo_interno})` : ""}
                {r.stock != null ? ` · stock ${r.stock}` : ""}
              </option>
            ))}
          </select>
        )}
        <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} placeholder="Qué pieza necesita, con sus palabras (ej: la junta de la tapa del tanque de leche)" className={`${cls} py-2`} />
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Código (si lo tiene)" className={cls} />
          <input inputMode="decimal" value={cantidad} onChange={(e) => setCantidad(e.target.value)} className={`${cls} w-24`} aria-label="Cantidad" />
        </div>
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl border border-borde bg-white px-3 text-[15px] font-bold">
          <Camera className="h-4 w-4" /> {foto ? "✓ Foto lista" : "Foto de la pieza o de la etiqueta"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                setFoto(await comprimir(f));
              } catch {
                setError("No se pudo leer la foto");
              }
            }}
          />
        </label>
      </section>

      {/* Validación */}
      <section className="space-y-2">
        <p className={seccion}>¿Hace falta que servicio técnico confirme la pieza?</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setRequiere(true)} className={chip(requiere)}>
            Sí, validarla
          </button>
          <button type="button" onClick={() => setRequiere(false)} className={chip(!requiere)}>
            No, ya está identificada
          </button>
        </div>
        {requiere && validadores.length > 0 && (
          <select value={validador} onChange={(e) => setValidador(e.target.value)} className={cls}>
            {validadores.map((v) => (
              <option key={v.id} value={v.id}>
                Valida: {v.nombre}
              </option>
            ))}
          </select>
        )}
      </section>

      {/* Precio (opcional) */}
      <details className="rounded-2xl bg-white p-3.5 shadow-sm">
        <summary className="cursor-pointer text-[15px] font-bold">Precio y disponibilidad (opcional: se puede cargar al cotizar)</summary>
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="Precio por unidad" className={cls} />
            <select value={moneda} onChange={(e) => setMoneda(e.target.value as "ARS" | "USD")} className={cls}>
              <option value="ARS">Pesos</option>
              <option value="USD">Dólares</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DISPONIBILIDADES.map((d) => (
              <button key={d.value} type="button" onClick={() => setDisp(disp === d.value ? "" : d.value)} className={chip(disp === d.value)}>
                {d.label}
              </button>
            ))}
          </div>
          {disp && disp !== "en_stock" && <input type="number" min={0} value={plazo} onChange={(e) => setPlazo(e.target.value)} placeholder="Plazo en días" className={cls} />}
        </div>
      </details>

      {/* Responsable y próximo paso */}
      <section className="space-y-2">
        <p className={seccion}>Vendedor a cargo y próximo paso</p>
        <select value={comercial} onChange={(e) => setComercial(e.target.value)} className={cls}>
          <option value="">El vendedor del cliente</option>
          {vendedores.map((v) => (
            <option key={v.id} value={v.id}>
              {v.id === yo ? `${v.nombre} (vos)` : v.nombre}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-1.5">
          {ACCIONES.filter((a) => ["cotizar", "llamar", "escribir", "otra"].includes(a.value)).map((a) => (
            <button key={a.value} type="button" onClick={() => setAccion(a.value)} className={chip(accion === a.value)}>
              {a.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { l: "Hoy", d: 0 },
            { l: "Mañana", d: 1 },
            { l: "2 días", d: 2 },
            { l: "1 semana", d: 7 },
          ].map((o) => (
            <button key={o.l} type="button" onClick={() => setVolverEl(sumarDias(o.d))} className={chip(volverEl === sumarDias(o.d))}>
              {o.l}
            </button>
          ))}
          <input type="date" min={hoy} value={volverEl} onChange={(e) => setVolverEl(e.target.value)} className="min-h-10 rounded-full border border-borde bg-white px-3 text-sm" />
        </div>
        {volverEl && <p className="text-xs text-piedra">Aparece en Mi día del vendedor el {fechaCorta(volverEl)}.</p>}
      </section>

      {duplicados.length > 0 && (
        <div className="space-y-2 rounded-2xl border-2 border-ambar bg-ambar-soft p-3.5">
          <p className="text-[15px] font-extrabold text-ambar">Ojo: puede que ya esté cargado</p>
          {duplicados.map((d) => (
            <button key={d.id} type="button" onClick={() => elegirCliente({ id: d.id, nombre: d.nombre })} className="flex w-full items-center justify-between rounded-xl bg-white px-3 py-2 text-left">
              <span className="text-[15px] font-bold">{d.nombre}</span>
              <span className="text-[14px] font-bold text-marino">Es este: usar</span>
            </button>
          ))}
          <button type="button" onClick={() => guardar(true)} className="min-h-10 w-full rounded-xl border border-borde bg-white text-[14px] font-bold">
            Es otra persona: cargarla igual
          </button>
        </div>
      )}
      {error && <p className="text-[15px] font-bold text-red-600">{error}</p>}
      <button type="button" disabled={!listo || pending} onClick={() => guardar()} className="min-h-12 w-full rounded-2xl bg-marino text-[16px] font-extrabold text-white disabled:opacity-50">
        {pending ? "Guardando…" : "Crear solicitud"}
      </button>
    </div>
  );
}
