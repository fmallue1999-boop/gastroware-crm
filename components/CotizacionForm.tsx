"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { guardarDatosParaCotizar, registrarCotizacion, type ItemCotizacion } from "@/lib/actions";
import { createClient } from "@/lib/supabase/client";
import { dinero } from "@/lib/format";
import type { Producto } from "@/lib/types";
import { precioEn, textoPrecios } from "@/lib/precios";
import { CONDICIONES_FISCALES, FORMAS_PAGO_VENTA } from "@/lib/constants";
import { OPCIONES_IVA, porcentaje } from "@/lib/cotizacion-pdf";
import { cuitValido, emailValido, faltanParaCotizar } from "@/lib/datos-cotizar";
import BotonesPdfCotizacion from "@/components/BotonesPdfCotizacion";

const inputCls = "min-h-11 w-full rounded-xl border bg-white px-3 py-2 text-[15px] outline-none focus:border-marino";
const chip = (activo: boolean) =>
  `min-h-10 rounded-full px-3.5 text-[14px] font-bold ${activo ? "bg-marino text-white" : "border border-borde bg-white text-piedra"}`;

type Linea = ItemCotizacion & { clave: number };
type Hecha = { cotizacionId: string; numero: number | null; version: number; pendiente: boolean };

export type DatosClienteCotizar = {
  razonSocial: string;
  cuit: string;
  condicionFiscal: string;
  email: string;
  direccion: string;
  ciudad: string;
  provincia: string;
};

/** La última versión, para arrancar la nueva desde ahí. */
export type CotizacionPrevia = {
  moneda: string;
  items: ItemCotizacion[];
  formaPago: string | null;
  ivaPct: number | null;
  plazoEntrega: string | null;
  condicionEntrega: string | null;
  vigenciaDias: number | null;
  condiciones: string | null;
  tipoCambio: number | null;
  descuentoPct: number | null;
  descuentoMotivo: string | null;
};

const PLAZOS = ["Inmediata", "A revisar", "7 días", "15 días", "30 días", "A convenir"];
const CONDICIONES_ENTREGA = ["A cargo del cliente", "Retira en nuestro local", "Envío incluido", "A convenir"];

function Seccion({ n, titulo, detalle, children }: { n: number; titulo: string; detalle?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-borde bg-white p-4 shadow-sm">
      <div className="flex items-start gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-marino text-sm font-extrabold text-white">{n}</span>
        <div>
          <h2 className="text-[16px] font-extrabold leading-7">{titulo}</h2>
          {detalle && <p className="text-sm text-piedra">{detalle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

/**
 * Armar la cotización (v1.9, pantalla propia): 1) datos del cliente
 * (obligatorios, se guardan en la ficha), 2) productos, 3) precio y pago,
 * 4) entrega y validez, 5) extras. Abajo, fijo, el total y "Guardar".
 * Al guardar queda el PDF listo para ver y compartir.
 */
export default function CotizacionForm({
  oportunidadId,
  clienteId,
  cliente,
  monedaDefault,
  productos,
  productosIniciales = [],
  previa = null,
  volverHref,
}: {
  oportunidadId: string;
  clienteId: string;
  cliente: DatosClienteCotizar;
  monedaDefault: string;
  productos: Producto[];
  productosIniciales?: string[];
  previa?: CotizacionPrevia | null;
  volverHref: string;
}) {
  const [pending, startTransition] = useTransition();
  const arriba = useRef<HTMLDivElement>(null);
  const monedaInicial = previa?.moneda ?? (monedaDefault === "USD" ? "USD" : "ARS");

  // 1. Cliente
  const [datos, setDatos] = useState<DatosClienteCotizar>(cliente);
  const campo = (k: keyof DatosClienteCotizar) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setDatos({ ...datos, [k]: e.target.value });
  const faltan = faltanParaCotizar({ razon_social: datos.razonSocial, cuit: datos.cuit, email: datos.email, direccion: datos.direccion, ciudad: datos.ciudad });
  const [mostrarFaltantes, setMostrarFaltantes] = useState(false);
  const marca = (vacio: boolean) => (vacio && mostrarFaltantes ? "border-ambar bg-ambar-soft/40" : "border-borde");

  // 2. Productos
  const [moneda, setMoneda] = useState(monedaInicial);
  const [clave, setClave] = useState(100);
  const [lineas, setLineas] = useState<Linea[]>(() => {
    if (previa?.items.length) return previa.items.map((i, k) => ({ ...i, clave: k + 1 }));
    return productosIniciales
      .map((id) => productos.find((p) => p.id === id))
      .filter((p): p is Producto => Boolean(p))
      .map((p, k) => ({ clave: k + 1, productoId: p.id, descripcion: p.nombre, cantidad: 1, precioUnit: precioEn(p, monedaInicial) ?? 0 }));
  });

  // 3. Precio y pago
  const formaPrevia = previa?.formaPago ?? "";
  const formaBase = FORMAS_PAGO_VENTA.find((f) => formaPrevia === f || formaPrevia.startsWith(`${f} — `)) ?? "";
  const [formaPago, setFormaPago] = useState<string>(formaBase);
  const [formaDetalle, setFormaDetalle] = useState(formaBase ? formaPrevia.slice(formaBase.length).replace(/^ — /, "") : formaPrevia);
  const [iva, setIva] = useState<number>(previa?.ivaPct ?? OPCIONES_IVA[0].value);
  const [conDescuento, setConDescuento] = useState(Boolean(previa?.descuentoPct));
  const [descuento, setDescuento] = useState(previa?.descuentoPct ? String(previa.descuentoPct) : "");
  const [motivoDescuento, setMotivoDescuento] = useState(previa?.descuentoMotivo ?? "");

  // 4. Entrega y validez
  const [plazoEntrega, setPlazoEntrega] = useState(previa?.plazoEntrega ?? "");
  const [condicionEntrega, setCondicionEntrega] = useState(previa?.condicionEntrega ?? "");
  const [vigencia, setVigencia] = useState(String(previa?.vigenciaDias ?? 7));
  const [tipoCambio, setTipoCambio] = useState(previa?.tipoCambio ? String(previa.tipoCambio) : "");

  // 5. Extras
  const [notas, setNotas] = useState(previa?.condiciones ?? "");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [condicionEspecial, setCondicionEspecial] = useState(false);

  const [hecha, setHecha] = useState<Hecha | null>(null);
  const [error, setError] = useState<string | null>(null);

  const subtotal = lineas.reduce((s, l) => s + l.cantidad * l.precioUnit, 0);
  const pctDescuento = conDescuento ? Math.min(99, Math.max(0, Number(descuento.replace(",", ".")) || 0)) : 0;
  const neto = Math.round(subtotal * (1 - pctDescuento / 100) * 100) / 100;
  const montoIva = Math.round(neto * iva) / 100;
  const total = Math.round((neto + montoIva) * 100) / 100;
  const cambio = Number(tipoCambio.replace(/\./g, "").replace(",", ".")) || null;
  const bajoLista = lineas.some((l) => {
    const lista = precioEn(productos.find((x) => x.id === l.productoId), moneda);
    return lista != null && l.precioUnit < lista - 0.5;
  });
  const sinPrecio = lineas.filter((l) => l.productoId && precioEn(productos.find((x) => x.id === l.productoId), moneda) == null);

  /** Cambiar de moneda: las líneas con precio de lista pasan al precio en la otra moneda. */
  function cambiarMoneda(nueva: string) {
    setLineas(
      lineas.map((l) => {
        const p = productos.find((x) => x.id === l.productoId);
        if (!p) return l;
        const antes = precioEn(p, moneda);
        const despues = precioEn(p, nueva);
        return despues != null && (antes == null || l.precioUnit === antes) ? { ...l, precioUnit: despues } : l;
      })
    );
    setMoneda(nueva);
  }

  function agregarProducto(id: string) {
    const p = productos.find((x) => x.id === id);
    if (!p) return;
    setLineas([...lineas, { clave, productoId: p.id, descripcion: p.nombre, cantidad: 1, precioUnit: precioEn(p, moneda) ?? 0 }]);
    setClave(clave + 1);
  }

  function agregarLibre() {
    setLineas([...lineas, { clave, productoId: null, descripcion: "", cantidad: 1, precioUnit: 0 }]);
    setClave(clave + 1);
  }

  const cambiar = (k: number, patch: Partial<Linea>) => setLineas(lineas.map((l) => (l.clave === k ? { ...l, ...patch } : l)));

  function guardar() {
    setError(null);
    if (faltan.length) {
      setMostrarFaltantes(true);
      setError(`Completá los datos del cliente: ${faltan.join(", ")}.`);
      arriba.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (lineas.length === 0 || lineas.some((l) => !l.descripcion.trim())) {
      setError("Agregá al menos un producto (y que cada línea tenga descripción).");
      return;
    }
    if (conDescuento && pctDescuento > 0 && !motivoDescuento.trim()) {
      setError("Contá por qué pide el descuento especial.");
      return;
    }
    startTransition(async () => {
      const cambiaron = (Object.keys(cliente) as (keyof DatosClienteCotizar)[]).some((k) => cliente[k] !== datos[k]);
      if (cambiaron) {
        const r = await guardarDatosParaCotizar(clienteId, {
          razonSocial: datos.razonSocial,
          cuit: datos.cuit,
          condicionFiscal: datos.condicionFiscal || null,
          email: datos.email,
          direccion: datos.direccion,
          ciudad: datos.ciudad,
          provincia: datos.provincia || null,
        });
        if (r && "error" in r && r.error) {
          setError(r.error);
          arriba.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
      }

      let archivoPath: string | null = null;
      if (archivo) {
        const path = `cotizaciones/${oportunidadId}/${Date.now()}-${archivo.name.replace(/[^\w.\-]/g, "_")}`;
        const { error: errUpload } = await createClient().storage.from("documentos").upload(path, archivo);
        if (errUpload) {
          setError("No se pudo subir el archivo: " + errUpload.message);
          return;
        }
        archivoPath = path;
      }

      const res = await registrarCotizacion({
        oportunidadId,
        monto: subtotal || null,
        moneda,
        forma_pago: [formaPago, formaDetalle.trim()].filter(Boolean).join(" — "),
        descuentoPct: pctDescuento || null,
        descuentoMotivo: motivoDescuento,
        archivoPath,
        notas,
        vigenciaDias: vigencia ? Number(vigencia) : null,
        condicionEspecial,
        ivaPct: iva,
        plazoEntrega,
        condicionEntrega,
        tipoCambio: moneda === "USD" ? cambio : null,
        items: lineas.map((l) => ({ productoId: l.productoId, descripcion: l.descripcion, cantidad: l.cantidad, precioUnit: l.precioUnit })),
      });
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      if (res && "cotizacionId" in res) {
        setHecha({ cotizacionId: res.cotizacionId, numero: res.numero, version: res.version, pendiente: res.pendiente });
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  if (hecha)
    return (
      <div className="space-y-4 rounded-2xl border border-verde/40 bg-verde-soft p-5">
        <p className="flex items-center gap-2 text-xl font-extrabold text-verde">
          <CheckCircle2 className="h-6 w-6" /> Cotización N° {hecha.numero ?? "?"}
          {hecha.version > 1 ? ` v${hecha.version}` : ""} guardada
        </p>
        {hecha.pendiente ? (
          <p className="text-[15px]">
            Queda <b>esperando la aprobación de dirección</b> (va fuera de lista). Cuando la aprueben te llega el aviso y la podés mandar.
          </p>
        ) : (
          <>
            <p className="text-[15px]">El PDF está listo, con las fichas de los productos al final. Revisalo y mandáselo al cliente.</p>
            <BotonesPdfCotizacion cotizacionId={hecha.cotizacionId} version={hecha.version} />
          </>
        )}
        <div className="flex flex-wrap gap-3 border-t border-verde/20 pt-3">
          <Link href={volverHref} className="inline-flex min-h-11 items-center rounded-xl bg-marino px-4 text-[15px] font-bold text-white">
            Volver a la ficha
          </Link>
          <button type="button" onClick={() => setHecha(null)} className="min-h-11 px-2 text-[15px] font-bold text-marino underline">
            Armar otra versión
          </button>
        </div>
      </div>
    );

  return (
    <div className="space-y-4 pb-4" ref={arriba}>
      {error && (
        <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-[15px] font-semibold text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      <Seccion n={1} titulo="Datos del cliente" detalle="Obligatorios para cotizar. Se guardan en la ficha del cliente.">
        {faltan.length > 0 && <p className="rounded-xl bg-ambar-soft px-3 py-2 text-sm font-semibold text-ambar">Falta: {faltan.join(", ")}.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-bold sm:col-span-2">
            Razón social *
            <input value={datos.razonSocial} onChange={campo("razonSocial")} placeholder="Como figura en AFIP" className={`${inputCls} mt-1 font-normal ${marca(!datos.razonSocial.trim())}`} />
          </label>
          <label className="block text-sm font-bold">
            CUIT *
            <input value={datos.cuit} onChange={campo("cuit")} inputMode="numeric" placeholder="30-12345678-9" className={`${inputCls} mt-1 font-normal ${marca(!cuitValido(datos.cuit))}`} />
            {datos.cuit.replace(/\D/g, "").length === 11 && !cuitValido(datos.cuit) && (
              <span className="mt-1 block text-xs font-bold text-red-600">Ese CUIT no es válido: revisá los números.</span>
            )}
          </label>
          <label className="block text-sm font-bold">
            Condición frente al IVA
            <select value={datos.condicionFiscal} onChange={campo("condicionFiscal")} className={`${inputCls} mt-1 border-borde font-normal`}>
              <option value="">Elegir…</option>
              {CONDICIONES_FISCALES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-bold sm:col-span-2">
            Email *
            <input type="email" value={datos.email} onChange={campo("email")} placeholder="compras@empresa.com" className={`${inputCls} mt-1 font-normal ${marca(!emailValido(datos.email))}`} />
          </label>
          <label className="block text-sm font-bold sm:col-span-2">
            Dirección *
            <input value={datos.direccion} onChange={campo("direccion")} placeholder="Calle y número" className={`${inputCls} mt-1 font-normal ${marca(!datos.direccion.trim())}`} />
          </label>
          <label className="block text-sm font-bold">
            Localidad *
            <input value={datos.ciudad} onChange={campo("ciudad")} placeholder="Ej: Mar del Plata" className={`${inputCls} mt-1 font-normal ${marca(!datos.ciudad.trim())}`} />
          </label>
          <label className="block text-sm font-bold">
            Provincia
            <input value={datos.provincia} onChange={campo("provincia")} placeholder="Ej: Buenos Aires" className={`${inputCls} mt-1 border-borde font-normal`} />
          </label>
        </div>
      </Seccion>

      <Seccion n={2} titulo="Productos" detalle="Los precios del catálogo son sin IVA.">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold">Cotizar en</span>
          {[
            { v: "ARS", l: "Pesos" },
            { v: "USD", l: "Dólares" },
          ].map((m) => (
            <button key={m.v} type="button" onClick={() => cambiarMoneda(m.v)} className={chip(moneda === m.v)}>
              {m.l}
            </button>
          ))}
        </div>

        {lineas.length > 0 && (
          <div className="divide-y divide-borde/70 rounded-xl border border-borde">
            <div className="hidden grid-cols-[1fr_4.5rem_8rem_7.5rem_2rem] gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wide text-piedra sm:grid">
              <span>Descripción</span>
              <span className="text-center">Cant.</span>
              <span className="text-right">Precio unit.</span>
              <span className="text-right">Total</span>
              <span />
            </div>
            {lineas.map((l) => (
              <div key={l.clave} className="grid grid-cols-[4.5rem_1fr_2rem] items-center gap-2 px-3 py-2.5 sm:grid-cols-[1fr_4.5rem_8rem_7.5rem_2rem]">
                <input
                  type="text"
                  placeholder="Descripción"
                  value={l.descripcion}
                  onChange={(e) => cambiar(l.clave, { descripcion: e.target.value })}
                  className="col-span-3 min-h-10 rounded-lg border border-borde px-2.5 text-[15px] font-semibold sm:col-span-1"
                  aria-label="Descripción"
                />
                <input
                  type="number"
                  min={1}
                  value={l.cantidad}
                  onChange={(e) => cambiar(l.clave, { cantidad: Number(e.target.value) || 1 })}
                  className="min-h-10 rounded-lg border border-borde px-2 text-center text-[15px]"
                  aria-label="Cantidad"
                />
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={l.precioUnit}
                  onChange={(e) => cambiar(l.clave, { precioUnit: Number(e.target.value) || 0 })}
                  className="min-h-10 rounded-lg border border-borde px-2 text-right text-[15px]"
                  aria-label="Precio unitario"
                />
                <span className="hidden text-right text-[15px] font-bold sm:block">{dinero(l.cantidad * l.precioUnit, moneda)}</span>
                <button type="button" onClick={() => setLineas(lineas.filter((x) => x.clave !== l.clave))} aria-label="Quitar línea" className="flex justify-center text-piedra/70 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <select value="" onChange={(e) => agregarProducto(e.target.value)} className={`${inputCls} min-w-52 flex-1 border-borde`}>
            <option value="">+ Agregar producto del catálogo…</option>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
                {textoPrecios(p, dinero) ? ` — ${textoPrecios(p, dinero)}` : " — sin precio de lista"}
              </option>
            ))}
          </select>
          <button type="button" onClick={agregarLibre} className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-borde px-3 text-[14px] font-bold text-piedra">
            <Plus className="h-4 w-4" /> Línea libre
          </button>
        </div>
        {sinPrecio.length > 0 && (
          <p className="rounded-xl bg-ambar-soft px-3 py-2 text-sm text-ambar">
            Sin precio de lista en {moneda === "USD" ? "dólares" : "pesos"}: {sinPrecio.map((l) => l.descripcion).join(", ")}. Ponelo a mano o cargalo en el catálogo.
          </p>
        )}
      </Seccion>

      <Seccion n={3} titulo="Precio y forma de pago">
        <div className="space-y-1.5">
          <p className="text-sm font-bold">IVA (se suma al final)</p>
          <div className="flex flex-wrap gap-1.5">
            {OPCIONES_IVA.map((o) => (
              <button key={o.value} type="button" onClick={() => setIva(o.value)} className={chip(iva === o.value)}>
                {o.value ? `${porcentaje(o.value)}%` : "No discriminar"}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-bold">Forma de pago</p>
          <div className="flex flex-wrap gap-1.5">
            {FORMAS_PAGO_VENTA.map((f) => (
              <button key={f} type="button" onClick={() => setFormaPago(formaPago === f ? "" : f)} className={chip(formaPago === f)}>
                {f}
              </button>
            ))}
          </div>
          <input type="text" placeholder="Detalle (opcional: ej. 50% anticipo + 3 cuotas)" value={formaDetalle} onChange={(e) => setFormaDetalle(e.target.value)} className={`${inputCls} border-borde`} />
        </div>
        <div className="space-y-2 rounded-xl bg-crema p-3">
          <label className="flex min-h-10 items-center gap-2 text-[15px] font-bold">
            <input type="checkbox" checked={conDescuento} onChange={(e) => setConDescuento(e.target.checked)} className="h-5 w-5" />
            Pide un descuento especial
          </label>
          {conDescuento && (
            <div className="grid grid-cols-[6rem_1fr] gap-2">
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="number"
                  min={0}
                  max={99}
                  step="any"
                  value={descuento}
                  onChange={(e) => setDescuento(e.target.value)}
                  className="min-h-11 w-16 rounded-xl border border-borde bg-white px-2 text-center text-[15px]"
                  aria-label="Porcentaje de descuento"
                />
                %
              </label>
              <input type="text" placeholder="Motivo (ej: compra 3 equipos)" value={motivoDescuento} onChange={(e) => setMotivoDescuento(e.target.value)} className={`${inputCls} border-borde`} />
            </div>
          )}
        </div>
      </Seccion>

      <Seccion n={4} titulo="Entrega y validez" detalle="Sale abajo en el PDF.">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-bold">
            Plazo de entrega
            <input type="text" list="plazos-entrega" placeholder="Ej: Inmediata, 15 días" value={plazoEntrega} onChange={(e) => setPlazoEntrega(e.target.value)} className={`${inputCls} mt-1 border-borde font-normal`} />
          </label>
          <label className="block text-sm font-bold">
            Condición de entrega
            <input type="text" list="condiciones-entrega" placeholder="Ej: A cargo del cliente" value={condicionEntrega} onChange={(e) => setCondicionEntrega(e.target.value)} className={`${inputCls} mt-1 border-borde font-normal`} />
          </label>
          <label className="flex items-center gap-2 text-sm font-bold">
            Válida por
            <input type="number" min={1} value={vigencia} onChange={(e) => setVigencia(e.target.value)} className="min-h-11 w-20 rounded-xl border border-borde px-2 text-center text-[15px] font-normal" />
            días
          </label>
          {moneda === "USD" && (
            <label className="flex flex-wrap items-center gap-2 text-sm font-bold">
              Dólar del día: US$ 1 = $
              <input
                type="text"
                inputMode="decimal"
                placeholder="opcional"
                value={tipoCambio}
                onChange={(e) => setTipoCambio(e.target.value)}
                className="min-h-11 w-28 rounded-xl border border-borde px-2 text-right text-[15px] font-normal"
              />
            </label>
          )}
          <datalist id="plazos-entrega">
            {PLAZOS.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
          <datalist id="condiciones-entrega">
            {CONDICIONES_ENTREGA.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>
      </Seccion>

      <Seccion n={5} titulo="Observaciones y extras">
        <textarea
          placeholder="Observaciones para el cliente (opcional: instalación, garantía…)"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={2}
          className={`${inputCls} border-borde`}
        />
        <label className="flex min-h-11 items-center gap-2 text-[15px] font-bold">
          <input type="checkbox" checked={condicionEspecial} onChange={(e) => setCondicionEspecial(e.target.checked)} className="h-5 w-5" />
          Tiene una condición especial (plazo, financiación, bonificación)
        </label>
        {(bajoLista || condicionEspecial || pctDescuento > 0) && (
          <p className="rounded-xl bg-ambar-soft px-3 py-2 text-sm font-semibold text-ambar">
            {pctDescuento > 0 ? `Descuento especial ${pctDescuento}%` : condicionEspecial ? "Condición especial" : "Por debajo de lista"}: si pasa lo que podés dar solo, queda esperando la
            aprobación de dirección antes de mandarla.
          </p>
        )}
        <label className="block text-sm text-piedra">
          PDF propio (opcional, si ya la armaste afuera):
          <input
            type="file"
            accept=".pdf,image/*"
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-sm file:mr-2 file:rounded-xl file:border file:border-borde file:bg-white file:px-3 file:py-1.5 file:text-sm"
          />
        </label>
      </Seccion>

      {/* Total y guardar, siempre a la vista */}
      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 rounded-2xl border border-borde bg-white/95 p-3 shadow-lg backdrop-blur lg:bottom-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1 text-sm">
            <p className="text-piedra">
              {pctDescuento ? `Subtotal ${dinero(subtotal, moneda)} · −${porcentaje(pctDescuento)}% · ` : ""}
              Neto {dinero(neto, moneda)}
              {iva ? ` + IVA ${porcentaje(iva)}%` : ""}
            </p>
            <p className="text-lg font-extrabold">Total {dinero(total, moneda)}</p>
          </div>
          <button type="button" disabled={pending} onClick={guardar} className="min-h-12 rounded-xl bg-marino px-5 text-[15px] font-extrabold text-white disabled:opacity-60">
            {pending ? "Guardando…" : "Guardar y armar PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
