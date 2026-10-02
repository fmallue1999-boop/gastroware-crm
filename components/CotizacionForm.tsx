"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Minus, Pencil, Plus, Trash2 } from "lucide-react";
import { crearSucursal, guardarDatosParaCotizar, registrarCotizacion, type ItemCotizacion } from "@/lib/actions";
import { createClient } from "@/lib/supabase/client";
import { dinero } from "@/lib/format";
import type { Producto } from "@/lib/types";
import { precioEn } from "@/lib/precios";
import { CONDICIONES_FISCALES } from "@/lib/constants";
import { calcularTotales, porcentaje } from "@/lib/cotizacion-pdf";
import { cuitProlijo, cuitValido, emailValido, faltanParaCotizar } from "@/lib/datos-cotizar";
import BotonesPdfCotizacion from "@/components/BotonesPdfCotizacion";

const inputCls = "min-h-11 w-full rounded-xl border bg-white px-3 py-2 text-[16px] outline-none focus:border-marino";
const chip = (activo: boolean) =>
  `min-h-10 rounded-full px-3.5 text-[14px] font-bold ${activo ? "bg-marino text-white" : "border border-borde bg-white text-piedra"}`;

type Linea = ItemCotizacion & { clave: number; ivaPct: number };
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
  items: (ItemCotizacion & { ivaPct?: number | null })[];
  formaPago: string | null;
  ivaPct: number | null;
  plazoEntrega: string | null;
  condicionEntrega: string | null;
  /** v1.14: lugar de entrega (sucursal) de la versión anterior. */
  sucursalId?: string | null;
  vigenciaDias: number | null;
  condiciones: string | null;
  tipoCambio: number | null;
  descuentoPct: number | null;
  descuentoMotivo: string | null;
};

/** Lo que define dirección (Administración → Marca → Cotización). */
export type ConfigCotizar = {
  /** Moneda fija para cotizar (null: se elige). */
  monedaFija: "USD" | "ARS" | null;
  formasPago: string[];
  plazos: string[];
  condiciones: string[];
};

const IVA_DEFECTO = 10.5;

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

/** Desplegable de una lista precargada (y el valor que ya tenía, si no está en la lista). */
function Lista({ valor, opciones, onChange, placeholder, etiqueta }: { valor: string; opciones: string[]; onChange: (v: string) => void; placeholder: string; etiqueta: string }) {
  const todas = valor && !opciones.includes(valor) ? [valor, ...opciones] : opciones;
  return (
    <label className="block text-sm font-bold">
      {etiqueta}
      <select value={valor} onChange={(e) => onChange(e.target.value)} className={`${inputCls} mt-1 border-borde font-normal`}>
        <option value="">{placeholder}</option>
        {todas.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Armar la cotización (v1.12, pantalla propia y simple para el vendedor):
 * 1) datos del cliente (obligatorios; si ya están, se ven resumidos),
 * 2) productos a precio de catálogo, en la moneda que fija dirección, con el
 * IVA de cada producto, 3) forma de pago y entrega de listas precargadas,
 * 4) un solo "pedido especial" (descuento, plazo o financiación) que aprueba
 * dirección. Abajo, el total. Al guardar: PDF listo y vuelta al embudo.
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
  config,
  editaPrecios,
  puntosEntrega = [],
  entregaInicial = null,
}: {
  oportunidadId: string;
  clienteId: string;
  cliente: DatosClienteCotizar;
  monedaDefault: string;
  productos: Producto[];
  productosIniciales?: { id: string; cantidad: number }[];
  previa?: CotizacionPrevia | null;
  volverHref: string;
  config: ConfigCotizar;
  /** Dirección y administración pueden cambiar precios, moneda y agregar líneas libres. */
  editaPrecios: boolean;
  /** v1.14: sucursales del cliente para elegir dónde se entrega. */
  puntosEntrega?: { id: string; texto: string }[];
  entregaInicial?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const arriba = useRef<HTMLDivElement>(null);
  const monedaInicial = config.monedaFija ?? previa?.moneda ?? (monedaDefault === "USD" ? "USD" : "ARS");
  const ivaDe = (id: string | null) => Number(productos.find((p) => p.id === id)?.iva_pct ?? IVA_DEFECTO);

  // 1. Cliente
  const [datos, setDatos] = useState<DatosClienteCotizar>(cliente);
  const campo = (k: keyof DatosClienteCotizar) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setDatos({ ...datos, [k]: e.target.value });
  const faltan = faltanParaCotizar({ razon_social: datos.razonSocial, cuit: datos.cuit, email: datos.email, direccion: datos.direccion, ciudad: datos.ciudad });
  const [editandoCliente, setEditandoCliente] = useState(faltanParaCotizar({ razon_social: cliente.razonSocial, cuit: cliente.cuit, email: cliente.email, direccion: cliente.direccion, ciudad: cliente.ciudad }).length > 0);
  const [mostrarFaltantes, setMostrarFaltantes] = useState(false);
  const marca = (vacio: boolean) => (vacio && mostrarFaltantes ? "border-ambar bg-ambar-soft/40" : "border-borde");

  // 2. Productos
  const [moneda, setMoneda] = useState(monedaInicial);
  const [clave, setClave] = useState(100);
  const [lineas, setLineas] = useState<Linea[]>(() => {
    if (previa?.items.length)
      return previa.items.map((i, k) => ({
        ...i,
        clave: k + 1,
        ivaPct: Number(i.ivaPct ?? (i.productoId ? ivaDe(i.productoId) : previa.ivaPct ?? IVA_DEFECTO)),
        // Si la moneda cambió (ej. dirección fijó dólares), al precio de lista de la nueva
        precioUnit: previa.moneda !== monedaInicial && i.productoId ? precioEn(productos.find((p) => p.id === i.productoId), monedaInicial) ?? i.precioUnit : i.precioUnit,
      }));
    return productosIniciales
      .map(({ id, cantidad }) => ({ p: productos.find((x) => x.id === id), cantidad }))
      .filter((x): x is { p: Producto; cantidad: number } => Boolean(x.p))
      .map(({ p, cantidad }, k) => ({ clave: k + 1, productoId: p.id, descripcion: p.nombre, cantidad: Math.max(1, cantidad), precioUnit: precioEn(p, monedaInicial) ?? 0, ivaPct: ivaDe(p.id) }));
  });

  // 3. Pago y entrega
  const [formaPago, setFormaPago] = useState(previa?.formaPago ?? "");
  const [plazoEntrega, setPlazoEntrega] = useState(previa?.plazoEntrega ?? "");
  const [condicionEntrega, setCondicionEntrega] = useState(previa?.condicionEntrega ?? "");
  const [entrega, setEntrega] = useState(previa?.sucursalId ?? entregaInicial ?? "");
  const [nuevoLugar, setNuevoLugar] = useState<{ nombre: string; direccion: string; ciudad: string } | null>(null);
  const [guardandoLugar, setGuardandoLugar] = useState(false);
  const [vigencia, setVigencia] = useState(String(previa?.vigenciaDias ?? 7));
  const [tipoCambio, setTipoCambio] = useState(previa?.tipoCambio ? String(previa.tipoCambio) : "");

  // 4. Pedido especial (uno solo: descuento, plazo o financiación)
  const [especial, setEspecial] = useState(Boolean(previa?.descuentoPct));
  const [descuento, setDescuento] = useState(previa?.descuentoPct ? String(previa.descuentoPct) : "");
  const [motivo, setMotivo] = useState(previa?.descuentoMotivo ?? "");

  // 5. Extras
  const [notas, setNotas] = useState(previa?.condiciones ?? "");
  const [archivo, setArchivo] = useState<File | null>(null);

  const [hecha, setHecha] = useState<Hecha | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pctDescuento = especial ? Math.min(99, Math.max(0, Number(descuento.replace(",", ".")) || 0)) : 0;
  const t = calcularTotales(
    lineas.map((l) => ({ cantidad: l.cantidad, precio_unit: l.precioUnit, iva_pct: l.ivaPct })),
    { total: null, descuento_pct: pctDescuento }
  );
  const cambio = Number(tipoCambio.replace(/\./g, "").replace(",", ".")) || null;
  const sinPrecio = lineas.filter((l) => l.productoId && precioEn(productos.find((x) => x.id === l.productoId), moneda) == null);
  const nombreMoneda = moneda === "USD" ? "dólares" : "pesos";

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
    const ya = lineas.find((l) => l.productoId === id);
    if (ya) {
      setLineas(lineas.map((l) => (l.clave === ya.clave ? { ...l, cantidad: l.cantidad + 1 } : l)));
      return;
    }
    setLineas([...lineas, { clave, productoId: p.id, descripcion: p.nombre, cantidad: 1, precioUnit: precioEn(p, moneda) ?? 0, ivaPct: ivaDe(p.id) }]);
    setClave(clave + 1);
  }

  function agregarLibre() {
    setLineas([...lineas, { clave, productoId: null, descripcion: "", cantidad: 1, precioUnit: 0, ivaPct: IVA_DEFECTO }]);
    setClave(clave + 1);
  }

  const cambiar = (k: number, patch: Partial<Linea>) => setLineas(lineas.map((l) => (l.clave === k ? { ...l, ...patch } : l)));

  function guardar() {
    setError(null);
    if (faltan.length) {
      setMostrarFaltantes(true);
      setEditandoCliente(true);
      setError(`Completá los datos del cliente: ${faltan.join(", ")}.`);
      arriba.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (lineas.length === 0 || lineas.some((l) => !l.descripcion.trim())) {
      setError("Agregá al menos un producto.");
      return;
    }
    if (!editaPrecios && sinPrecio.length) {
      setError(`Sin precio en ${nombreMoneda}: ${sinPrecio.map((l) => l.descripcion).join(", ")}. Pedile a dirección que lo cargue en el catálogo.`);
      return;
    }
    if (especial && !motivo.trim()) {
      setError("Contá qué pide el cliente y por qué (lo ve dirección para aprobarlo).");
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
          setEditandoCliente(true);
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
        monto: t.subtotal || null,
        moneda,
        forma_pago: formaPago,
        descuentoPct: pctDescuento || null,
        descuentoMotivo: pctDescuento ? motivo : null,
        condicionEspecial: especial,
        pedidoEspecial: especial ? motivo : null,
        archivoPath,
        notas,
        vigenciaDias: vigencia ? Number(vigencia) : null,
        ivaPct: IVA_DEFECTO,
        plazoEntrega,
        condicionEntrega,
        sucursalId: entrega || null,
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
            Queda <b>esperando la aprobación de dirección</b>. Cuando la aprueben te llega el aviso y la podés mandar.
          </p>
        ) : (
          <>
            <p className="text-[15px]">El PDF está listo (con las fichas de los productos al final). El seguimiento quedó agendado para mañana.</p>
            <BotonesPdfCotizacion cotizacionId={hecha.cotizacionId} version={hecha.version} />
          </>
        )}
        <div className="grid grid-cols-2 gap-2 border-t border-verde/20 pt-3 sm:flex sm:flex-wrap">
          <Link href="/" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-marino px-4 text-[15px] font-bold text-white">
            Volver al embudo
          </Link>
          <Link href="/hoy" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-borde bg-white px-4 text-[15px] font-bold">
            Ir a Mi día
          </Link>
          <Link href={volverHref} className="inline-flex min-h-11 items-center justify-center px-2 text-[15px] font-bold text-marino underline">
            Ver la ficha
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

      <Seccion n={1} titulo="Datos del cliente" detalle={editandoCliente ? "Obligatorios para cotizar. Se guardan en la ficha." : undefined}>
        {!editandoCliente ? (
          <div className="flex items-start justify-between gap-3 rounded-xl bg-crema px-3 py-2.5">
            <div className="min-w-0 text-[14px]">
              <p className="font-extrabold">{datos.razonSocial}</p>
              <p className="text-piedra">
                CUIT {cuitProlijo(datos.cuit)} · {datos.email}
              </p>
              <p className="text-piedra">
                {datos.direccion}, {datos.ciudad}
                {datos.provincia ? `, ${datos.provincia}` : ""}
              </p>
            </div>
            <button type="button" onClick={() => setEditandoCliente(true)} className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-marino underline">
              <Pencil className="h-3.5 w-3.5" /> Editar
            </button>
          </div>
        ) : (
          <>
            {faltan.length > 0 && <p className="rounded-xl bg-ambar-soft px-3 py-2 text-sm font-semibold text-ambar">Falta: {faltan.join(", ")}.</p>}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            {!faltan.length && (
              <button type="button" onClick={() => setEditandoCliente(false)} className="min-h-10 text-sm font-bold text-marino underline">
                Listo, ocultar
              </button>
            )}
          </>
        )}
      </Seccion>

      <Seccion n={2} titulo="Productos" detalle={`En ${nombreMoneda}, a precio de catálogo. El IVA es el de cada producto.`}>
        {!config.monedaFija && (
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
        )}

        {lineas.length > 0 && (
          <div className="divide-y divide-borde/70 rounded-xl border border-borde">
            {lineas.map((l) => {
              const lista = l.productoId ? precioEn(productos.find((x) => x.id === l.productoId), moneda) : null;
              const precioFijo = !editaPrecios && l.productoId != null;
              return (
                <div key={l.clave} className="space-y-2 px-3 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    {l.productoId && !editaPrecios ? (
                      <p className="min-w-0 text-[15px] font-bold">{l.descripcion}</p>
                    ) : (
                      <input
                        type="text"
                        placeholder="Descripción"
                        value={l.descripcion}
                        onChange={(e) => cambiar(l.clave, { descripcion: e.target.value })}
                        className="min-h-10 min-w-0 flex-1 rounded-lg border border-borde px-2.5 text-[15px] font-semibold"
                        aria-label="Descripción"
                      />
                    )}
                    <button type="button" onClick={() => setLineas(lineas.filter((x) => x.clave !== l.clave))} aria-label="Quitar" className="flex h-9 w-9 shrink-0 items-center justify-center text-piedra/70 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-1">
                      <button type="button" onClick={() => cambiar(l.clave, { cantidad: Math.max(1, l.cantidad - 1) })} disabled={l.cantidad <= 1} aria-label="Uno menos" className="flex h-9 w-9 items-center justify-center rounded-full border border-borde bg-white disabled:opacity-40">
                        <Minus className="h-4 w-4" />
                      </button>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        value={l.cantidad}
                        onChange={(e) => cambiar(l.clave, { cantidad: Math.max(1, Number(e.target.value) || 1) })}
                        className="h-9 w-14 rounded-lg border border-borde text-center text-[16px] font-bold"
                        aria-label="Cantidad"
                      />
                      <button type="button" onClick={() => cambiar(l.clave, { cantidad: l.cantidad + 1 })} aria-label="Uno más" className="flex h-9 w-9 items-center justify-center rounded-full border border-borde bg-white">
                        <Plus className="h-4 w-4" />
                      </button>
                      <span className="ml-1 text-sm text-piedra">
                        ×{" "}
                        {precioFijo ? (
                          <b className="text-tinta">{lista != null ? dinero(lista, moneda) : "sin precio"}</b>
                        ) : (
                          <input
                            type="number"
                            min={0}
                            step="any"
                            value={l.precioUnit}
                            onChange={(e) => cambiar(l.clave, { precioUnit: Number(e.target.value) || 0 })}
                            className="h-9 w-28 rounded-lg border border-borde px-2 text-right text-[16px]"
                            aria-label="Precio unitario"
                          />
                        )}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block text-[15px] font-extrabold">{dinero(l.cantidad * l.precioUnit, moneda)}</span>
                      <span className="block text-xs text-piedra">+ IVA {porcentaje(l.ivaPct)}%</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <select value="" onChange={(e) => agregarProducto(e.target.value)} className={`${inputCls} min-w-52 flex-1 border-borde`}>
            <option value="">+ Agregar producto…</option>
            {productos.map((p) => {
              const precio = precioEn(p, moneda);
              return (
                <option key={p.id} value={p.id} disabled={!editaPrecios && precio == null}>
                  {p.nombre} — {precio != null ? dinero(precio, moneda) : `sin precio en ${nombreMoneda}`}
                </option>
              );
            })}
          </select>
          {editaPrecios && (
            <button type="button" onClick={agregarLibre} className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-borde px-3 text-[14px] font-bold text-piedra">
              <Plus className="h-4 w-4" /> Línea libre
            </button>
          )}
        </div>
        {sinPrecio.length > 0 && (
          <p className="rounded-xl bg-ambar-soft px-3 py-2 text-sm text-ambar">
            Sin precio en {nombreMoneda}: {sinPrecio.map((l) => l.descripcion).join(", ")}.{" "}
            {editaPrecios ? "Ponelo a mano o cargalo en el catálogo." : "Pedile a dirección que lo cargue en el catálogo."}
          </p>
        )}
      </Seccion>

      <Seccion n={3} titulo="Pago y entrega" detalle="Sale abajo en el PDF.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Lista etiqueta="Forma de pago" valor={formaPago} opciones={config.formasPago} onChange={setFormaPago} placeholder="Elegir forma de pago…" />
          </div>
          <Lista etiqueta="Plazo de entrega" valor={plazoEntrega} opciones={config.plazos} onChange={setPlazoEntrega} placeholder="Elegir plazo…" />
          <Lista etiqueta="Condición de entrega" valor={condicionEntrega} opciones={config.condiciones} onChange={setCondicionEntrega} placeholder="Elegir condición…" />
          <div className="space-y-1.5 sm:col-span-2">
            <label className="block text-sm font-bold">
              Lugar de entrega
              <select
                value={entrega}
                onChange={(e) => setEntrega(e.target.value)}
                className="mt-1 min-h-11 w-full rounded-xl border border-borde bg-white px-3 text-[16px] font-normal outline-none focus:border-marino"
              >
                <option value="">Sin indicar</option>
                {puntosEntrega.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.texto}
                  </option>
                ))}
              </select>
            </label>
            {nuevoLugar ? (
              <div className="space-y-2 rounded-xl bg-crema/60 p-3">
                <input
                  value={nuevoLugar.nombre}
                  onChange={(e) => setNuevoLugar({ ...nuevoLugar, nombre: e.target.value })}
                  placeholder="Nombre del lugar (ej: Local Palermo, Depósito)"
                  className="min-h-11 w-full rounded-xl border border-borde bg-white px-3 text-[16px] outline-none focus:border-marino"
                />
                <input
                  value={nuevoLugar.direccion}
                  onChange={(e) => setNuevoLugar({ ...nuevoLugar, direccion: e.target.value })}
                  placeholder="Dirección"
                  className="min-h-11 w-full rounded-xl border border-borde bg-white px-3 text-[16px] outline-none focus:border-marino"
                />
                <input
                  value={nuevoLugar.ciudad}
                  onChange={(e) => setNuevoLugar({ ...nuevoLugar, ciudad: e.target.value })}
                  placeholder="Localidad"
                  className="min-h-11 w-full rounded-xl border border-borde bg-white px-3 text-[16px] outline-none focus:border-marino"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={guardandoLugar || !nuevoLugar.nombre.trim()}
                    onClick={async () => {
                      setGuardandoLugar(true);
                      const r = await crearSucursal({ clienteId, ...nuevoLugar });
                      setGuardandoLugar(false);
                      if ("error" in r && r.error) return setError(r.error);
                      if ("id" in r && r.id) setEntrega(r.id);
                      setNuevoLugar(null);
                      router.refresh();
                    }}
                    className="min-h-11 flex-1 rounded-xl bg-marino px-4 text-[15px] font-bold text-white disabled:opacity-50"
                  >
                    {guardandoLugar ? "Guardando…" : "Agregar y elegir"}
                  </button>
                  <button type="button" onClick={() => setNuevoLugar(null)} className="min-h-11 rounded-xl border border-borde bg-white px-4 text-[15px]">
                    Cancelar
                  </button>
                </div>
                <p className="text-xs text-piedra">Queda en la ficha del cliente (Datos), donde podés sumar quién recibe y el horario.</p>
              </div>
            ) : (
              <button type="button" onClick={() => setNuevoLugar({ nombre: "", direccion: "", ciudad: "" })} className="inline-flex min-h-10 items-center gap-1 text-sm font-bold text-marino underline">
                <Plus className="h-3.5 w-3.5" /> Otro lugar de entrega
              </button>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm font-bold">
            Válida por
            <select value={vigencia} onChange={(e) => setVigencia(e.target.value)} className="min-h-11 rounded-xl border border-borde bg-white px-2 text-[16px] font-normal">
              {["3", "7", "15", "30"].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
              {!["3", "7", "15", "30"].includes(vigencia) && <option value={vigencia}>{vigencia}</option>}
            </select>
            días
          </label>
          {moneda === "USD" && (
            <label className="flex flex-wrap items-center gap-2 text-sm font-bold">
              Dólar BNA del día (opcional): $
              <input
                type="text"
                inputMode="decimal"
                placeholder="1405"
                value={tipoCambio}
                onChange={(e) => setTipoCambio(e.target.value)}
                className="min-h-11 w-28 rounded-xl border border-borde px-2 text-right text-[16px] font-normal"
              />
            </label>
          )}
        </div>
      </Seccion>

      <Seccion n={4} titulo="¿Pide algo especial?" detalle="Descuento, plazo o financiación fuera de lo normal: lo aprueba dirección antes de mandarla.">
        <label className="flex min-h-11 items-center gap-2 text-[15px] font-bold">
          <input type="checkbox" checked={especial} onChange={(e) => setEspecial(e.target.checked)} className="h-5 w-5" />
          Sí, el cliente pide algo especial
        </label>
        {especial && (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-bold">
              Descuento (opcional)
              <input
                type="number"
                inputMode="decimal"
                min={0}
                max={99}
                step="any"
                value={descuento}
                onChange={(e) => setDescuento(e.target.value)}
                className="min-h-11 w-20 rounded-xl border border-borde bg-white px-2 text-center text-[16px] font-normal"
                aria-label="Porcentaje de descuento"
              />
              %
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
              placeholder="Qué pide y por qué (ej: 5% por llevar 3 equipos / pagar en 6 cuotas)"
              className={`${inputCls} border-borde`}
            />
          </div>
        )}
      </Seccion>

      <Seccion n={5} titulo="Observaciones">
        <textarea
          placeholder="Para el cliente (opcional: instalación, garantía…)"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={2}
          className={`${inputCls} border-borde`}
        />
        {editaPrecios && (
          <label className="block text-sm text-piedra">
            PDF propio (opcional, si ya la armaste afuera):
            <input
              type="file"
              accept=".pdf,image/*"
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-sm file:mr-2 file:rounded-xl file:border file:border-borde file:bg-white file:px-3 file:py-1.5 file:text-sm"
            />
          </label>
        )}
      </Seccion>

      {/* Total y guardar, siempre a la vista (se esconde mientras se escribe en el celular) */}
      <div className="ocultar-con-teclado sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 rounded-2xl border border-borde bg-white/95 p-3 shadow-lg backdrop-blur lg:bottom-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1 text-sm">
            <p className="text-piedra">
              {pctDescuento ? `Subtotal ${dinero(t.subtotal, moneda)} · −${porcentaje(pctDescuento)}% · ` : ""}
              Neto {dinero(t.neto, moneda)}
              {t.ivas.map((x) => ` + IVA ${porcentaje(x.pct)}%`).join("")}
            </p>
            <p className="text-lg font-extrabold">Total {dinero(t.total, moneda)}</p>
          </div>
          <button type="button" disabled={pending} onClick={guardar} className="min-h-12 rounded-xl bg-marino px-5 text-[15px] font-extrabold text-white disabled:opacity-60">
            {pending ? "Guardando…" : "Guardar y armar PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
