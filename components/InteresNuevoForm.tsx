"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Search } from "lucide-react";
import { buscarClientes, registrarInteres } from "@/lib/actions";
import { fechaCorta, hoyISO, normalizarTelefono, sumarDias, telefonoProlijo } from "@/lib/format";
import { CATEGORIAS_PRODUCTO, NIVELES_INTERES, ORIGENES_INTERES, RUBROS, SEGUIMIENTO_RAPIDO } from "@/lib/constants";
import { textoStock, type InfoStock } from "@/lib/stock";
import { ZONAS_ENTREGA } from "@/lib/territorios";
import LeerConsultaIA from "@/components/ia/LeerConsultaIA";
import type { ConsultaLeida } from "@/lib/actions";
import type { Cliente, Producto } from "@/lib/types";

const inputCls =
  "min-h-12 w-full rounded-2xl border border-borde bg-white px-4 py-3 text-base shadow-sm outline-none focus:border-marino";
const chipCls = (activo: boolean) =>
  `min-h-11 rounded-full px-3.5 py-2 text-[15px] font-semibold ${
    activo ? "bg-marino text-white" : "border border-borde bg-white text-piedra"
  }`;
const seccion = "text-xs font-bold uppercase tracking-wide text-piedra";
const pareceTelefono = (s: string) => /^[\d\s+\-().]{6,}$/.test(s.trim());

/**
 * Nuevo interés en una sola pantalla (rediseño aprobado por Franco): qué le
 * interesa con el stock al lado, cuánto, quién (de la base o nuevo), cuándo
 * volver a contactar, lista de espera si no hay stock, y Guardar.
 */
export default function InteresNuevoForm({
  productos,
  stockInfo = {},
  telefonoInicial = "",
  notaInicial = "",
  iaOn = false,
  compartido = "",
}: {
  productos: Producto[];
  stockInfo?: Record<string, InfoStock>;
  telefonoInicial?: string;
  notaInicial?: string;
  /** IA activa: muestra "Cargar desde un mensaje". */
  iaOn?: boolean;
  /** Texto compartido desde WhatsApp, para leerlo con IA. */
  compartido?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [filtro, setFiltro] = useState("");
  const [productoIds, setProductoIds] = useState<string[]>([]);
  const [otro, setOtro] = useState(false);
  const [interesTexto, setInteresTexto] = useState("");
  const [nivel, setNivel] = useState("");
  const [q, setQ] = useState(telefonoInicial);
  const [resultados, setResultados] = useState<Cliente[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [esNuevo, setEsNuevo] = useState(false);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [rubro, setRubro] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [origen, setOrigen] = useState("");
  const [nota, setNota] = useState(notaInicial);
  const [volverEl, setVolverEl] = useState("");
  const [enEspera, setEnEspera] = useState(false);
  /** Lugar de entrega (decide el vendedor); "?" = todavía no se sabe. */
  const [zona, setZona] = useState("");
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Compartido desde WhatsApp: el teléfono ya viene buscado
  useEffect(() => {
    if (telefonoInicial.trim().length < 2) return;
    let vivo = true;
    buscarClientes(telefonoInicial).then((r) => {
      if (vivo) setResultados(r);
    });
    return () => {
      vivo = false;
    };
  }, [telefonoInicial]);

  const sinStock = productoIds.some((id) => (stockInfo[id]?.stock ?? 1) <= 0);
  const hayInteres = productoIds.length > 0 || (otro && interesTexto.trim().length > 0);
  const hayQuien =
    !!cliente || (esNuevo && nombre.trim().length > 0 && (normalizarTelefono(telefono).length >= 6 || email.trim().length > 0));
  const listo = hayInteres && !!nivel && hayQuien && !!zona;

  const f = filtro.trim().toLowerCase();
  const grupos = Object.entries(CATEGORIAS_PRODUCTO)
    .map(([cat, label]) => ({
      label,
      items: productos.filter((p) => p.categoria === cat && (!f || p.nombre.toLowerCase().includes(f))),
    }))
    .filter((g) => g.items.length > 0);

  /** Completa el formulario con lo que leyó la IA (la persona revisa y guarda). */
  async function aplicarIA(d: ConsultaLeida) {
    const ids = d.productoIds.filter((id) => productos.some((p) => p.id === id));
    if (ids.length) {
      setProductoIds(ids);
      if (ids.some((id) => (stockInfo[id]?.stock ?? 1) <= 0)) setEnEspera(true);
    }
    if (d.interesTexto) {
      setOtro(true);
      setInteresTexto(d.interesTexto);
    }
    if (d.nivel) setNivel(d.nivel);
    if (d.zona) setZona(d.zona);
    if (d.origen) setOrigen(d.origen);
    if (d.nota) setNota(d.nota);
    const tel = d.telefono ? normalizarTelefono(d.telefono) : "";
    if (tel.length >= 8) {
      const encontrados = await buscarClientes(tel);
      if (encontrados.length) {
        setCliente(encontrados[0]);
        setEsNuevo(false);
        setResultados([]);
        return;
      }
    }
    if (d.nombre || tel || d.email) {
      setCliente(null);
      setEsNuevo(true);
      setResultados([]);
      if (d.nombre) setNombre(d.nombre);
      if (tel) setTelefono(telefonoProlijo(tel));
      if (d.email) setEmail(d.email);
      if (d.empresa) setEmpresa(d.empresa);
    }
  }

  function alternarProducto(id: string) {
    const quitar = productoIds.includes(id);
    setProductoIds(quitar ? productoIds.filter((x) => x !== id) : [...productoIds, id]);
    if (!quitar && (stockInfo[id]?.stock ?? 1) <= 0) setEnEspera(true);
  }

  function buscar(valor: string) {
    setQ(valor);
    setEsNuevo(false);
    if (timer.current) clearTimeout(timer.current);
    if (valor.trim().length < 2) {
      setResultados([]);
      return;
    }
    setBuscando(true);
    timer.current = setTimeout(async () => {
      setResultados(await buscarClientes(valor));
      setBuscando(false);
    }, 250);
  }

  function cargarloNuevo() {
    setEsNuevo(true);
    setResultados([]);
    const t = q.trim();
    if (pareceTelefono(t)) setTelefono(telefonoProlijo(t));
    else setNombre(t);
  }

  function guardar() {
    setError(null);
    startTransition(async () => {
      const res = await registrarInteres({
        productoIds,
        interesTexto: otro ? interesTexto : "",
        nivel,
        enEspera: enEspera && sinStock,
        clienteId: cliente?.id,
        nombre: esNuevo ? nombre : undefined,
        telefono: esNuevo ? telefono : undefined,
        email: esNuevo ? email : undefined,
        empresa: esNuevo ? empresa : undefined,
        origen: origen || undefined,
        rubro: rubro || undefined,
        ciudad,
        nota,
        volverEl: volverEl || undefined,
        zonaEntrega: zona && zona !== "?" ? zona : null,
      });
      if (res && "error" in res) setError(res.error ?? "No se pudo guardar");
    });
  }

  const tile = (activo: boolean) =>
    `flex min-h-14 w-full items-center justify-between gap-2 rounded-2xl border px-4 py-2.5 text-left ${
      activo ? "border-marino bg-marino text-white" : "border-borde bg-white"
    }`;

  return (
    <div className="space-y-5">
      {iaOn && <LeerConsultaIA textoInicial={compartido} onDatos={aplicarIA} />}

      {/* Qué */}
      <section className="space-y-2">
        <p className={seccion}>¿Qué le interesa?</p>
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-piedra" />
          <input
            type="search"
            placeholder="Buscar producto…"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className={`${inputCls} pl-11`}
          />
        </div>
        {grupos.map((g) => (
          <div key={g.label}>
            <p className="mb-1 px-1 text-xs font-semibold text-piedra">{g.label}</p>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {g.items.map((p) => {
                const elegido = productoIds.includes(p.id);
                const info = stockInfo[p.id];
                return (
                  <button key={p.id} type="button" onClick={() => alternarProducto(p.id)} className={tile(elegido)}>
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-bold">{p.nombre}</span>
                      {info && (
                        <span className={`block text-xs ${elegido ? "text-white/80" : info.stock > 0 ? "text-verde" : "text-ambar"}`}>
                          {textoStock(info, fechaCorta)}
                        </span>
                      )}
                    </span>
                    {elegido && <Check className="h-5 w-5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {grupos.length === 0 && <p className="text-[15px] text-piedra">Ningún producto con “{filtro}”. Escribilo en Otro.</p>}
        <button type="button" onClick={() => setOtro(!otro)} className={`${tile(otro)} ${otro ? "" : "border-dashed"}`}>
          <span className="text-[15px] font-bold">Otro (escribir)</span>
          {otro && <Check className="h-5 w-5 shrink-0" />}
        </button>
        {otro && (
          <input
            type="text"
            autoFocus
            placeholder="Qué le interesa, con tus palabras"
            value={interesTexto}
            onChange={(e) => setInteresTexto(e.target.value)}
            className={inputCls}
          />
        )}
      </section>

      {/* Cuánto */}
      <section className="space-y-2">
        <p className={seccion}>¿Cuánto le interesa?</p>
        <div className="flex flex-wrap gap-1.5">
          {NIVELES_INTERES.map((n) => (
            <button key={n.value} type="button" onClick={() => setNivel(n.value)} className={chipCls(nivel === n.value)}>
              {n.label}
            </button>
          ))}
        </div>
      </section>

      {/* Quién */}
      <section className="space-y-2">
        <p className={seccion}>¿Quién?</p>
        {cliente ? (
          <div className="flex items-center gap-3 rounded-2xl bg-verde-soft px-4 py-3">
            <Check className="h-5 w-5 shrink-0 text-verde" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-bold">{cliente.nombre_comercial}</p>
              <p className="text-xs text-piedra">
                {cliente.estado === "cliente_activo" ? "Cliente" : "Interesado"}
                {cliente.ciudad ? ` · ${cliente.ciudad}` : ""}
                {cliente.telefono ? ` · ${telefonoProlijo(cliente.telefono)}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setCliente(null);
                setQ("");
              }}
              className="text-sm text-azul underline"
            >
              Cambiar
            </button>
          </div>
        ) : esNuevo ? (
          <div className="space-y-2 rounded-2xl bg-white p-3.5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-bold">Es alguien nuevo</p>
              <button type="button" onClick={() => setEsNuevo(false)} className="text-sm text-azul underline">
                Buscar en la base
              </button>
            </div>
            <input type="text" autoFocus={!nombre} placeholder="Nombre de la persona" value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputCls} />
            <input
              type="tel"
              placeholder="Teléfono / WhatsApp (pegalo como venga)"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              onBlur={() => setTelefono(telefono ? telefonoProlijo(telefono) : "")}
              onPaste={(e) => {
                e.preventDefault();
                setTelefono(telefonoProlijo(e.clipboardData.getData("text")));
              }}
              className={inputCls}
            />
            <input type="email" placeholder="Email (si no tenés teléfono)" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
            <details>
              <summary className="cursor-pointer list-none text-[15px] text-azul underline [&::-webkit-details-marker]:hidden">
                Más datos (opcional): empresa, rubro, ciudad
              </summary>
              <div className="mt-2 space-y-2">
                <input type="text" placeholder="Empresa o negocio" value={empresa} onChange={(e) => setEmpresa(e.target.value)} className={inputCls} />
                <select value={rubro} onChange={(e) => setRubro(e.target.value)} className={inputCls}>
                  <option value="">Rubro…</option>
                  {RUBROS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <input type="text" placeholder="Ciudad" value={ciudad} onChange={(e) => setCiudad(e.target.value)} className={inputCls} />
              </div>
            </details>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-piedra" />
              <input type="search" placeholder="Nombre, empresa o teléfono" value={q} onChange={(e) => buscar(e.target.value)} className={`${inputCls} pl-11`} />
            </div>
            <div className="space-y-1.5">
              {buscando && <p className="px-1 text-sm text-piedra">Buscando…</p>}
              {resultados.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setCliente(c);
                    setResultados([]);
                  }}
                  className="flex min-h-12 w-full items-center justify-between gap-2 rounded-2xl bg-white px-4 py-2.5 text-left shadow-sm"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-bold">{c.nombre_comercial}</span>
                    <span className="block text-xs text-piedra">
                      {[c.ciudad, c.telefono ? telefonoProlijo(c.telefono) : null].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      c.estado === "cliente_activo" ? "bg-verde-soft text-verde" : "bg-azul-soft text-azul"
                    }`}
                  >
                    {c.estado === "cliente_activo" ? "Cliente" : "Interesado"}
                  </span>
                </button>
              ))}
              <button type="button" onClick={cargarloNuevo} className="flex min-h-12 w-full items-center rounded-2xl border border-dashed border-borde bg-white px-4 text-left text-[15px]">
                {q.trim().length >= 2 && !buscando && resultados.length === 0 ? "No está en la base. " : ""}
                <span className="ml-1 font-bold underline">Es alguien nuevo, cargarlo</span>
              </button>
            </div>
          </>
        )}
      </section>

      {/* Dónde */}
      <section className="space-y-2">
        <p className={seccion}>¿Dónde se entrega?</p>
        <div className="flex flex-wrap gap-1.5">
          {ZONAS_ENTREGA.map((z) => (
            <button key={z} type="button" onClick={() => setZona(zona === z ? "" : z)} className={chipCls(zona === z)}>
              {z}
            </button>
          ))}
          <button type="button" onClick={() => setZona(zona === "?" ? "" : "?")} className={chipCls(zona === "?")}>
            Todavía no sé
          </button>
        </div>
        <p className="px-1 text-xs text-piedra">Decide qué vendedor la atiende: CABA y AMBA, o Mar del Plata, costa e interior.</p>
      </section>

      {/* Por dónde */}
      <section className="space-y-2">
        <p className={seccion}>¿Por dónde llegó?</p>
        <div className="flex flex-wrap gap-1.5">
          {ORIGENES_INTERES.map((o) => (
            <button key={o} type="button" onClick={() => setOrigen(origen === o ? "" : o)} className={chipCls(origen === o)}>
              {o}
            </button>
          ))}
        </div>
      </section>

      {/* Cuándo */}
      <section className="space-y-2">
        <p className={seccion}>¿Volver a contactar?</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {SEGUIMIENTO_RAPIDO.filter((o) => o.dias != null).map((o) => {
            const fecha = sumarDias(o.dias as number);
            return (
              <button key={o.label} type="button" onClick={() => setVolverEl(volverEl === fecha ? "" : fecha)} className={chipCls(volverEl === fecha)}>
                {o.label}
              </button>
            );
          })}
          <input
            type="date"
            value={volverEl}
            min={hoyISO()}
            onChange={(e) => setVolverEl(e.target.value)}
            aria-label="Otra fecha"
            className="min-h-11 rounded-full border border-borde bg-white px-3 text-sm outline-none focus:border-marino"
          />
        </div>
      </section>

      {sinStock && (
        <button
          type="button"
          onClick={() => setEnEspera(!enEspera)}
          className={`flex min-h-14 w-full items-center justify-between rounded-2xl border px-4 py-2.5 text-left text-[15px] font-bold ${
            enEspera ? "border-naranja bg-naranja-soft text-naranja" : "border-ambar-soft bg-ambar-soft text-ambar"
          }`}
        >
          <span>
            Poner en lista de espera
            <span className="block text-xs font-normal">Lo quiere y no hay stock: aparece en Hoy cuando llegue.</span>
          </span>
          {enEspera && <Check className="h-5 w-5 shrink-0" />}
        </button>
      )}

      <details>
        <summary className="cursor-pointer list-none text-[15px] text-azul underline [&::-webkit-details-marker]:hidden">
          Nota (opcional)
        </summary>
        <div className="mt-2 space-y-2">
          <textarea placeholder="Consultó por WhatsApp, quiere para diciembre…" value={nota} onChange={(e) => setNota(e.target.value)} rows={2} className={inputCls} />
        </div>
      </details>

      {error && <p className="text-sm text-red-700">{error}</p>}
      <button
        type="button"
        disabled={pending || !listo}
        onClick={guardar}
        className="min-h-13 w-full rounded-2xl bg-verde py-3.5 text-base font-extrabold text-white disabled:opacity-50"
      >
        {pending ? "Guardando…" : "Guardar"}
      </button>
      <p className="text-center text-xs text-piedra">
        {!hayInteres
          ? "Tocá un producto (o Otro)."
          : !nivel
            ? "Falta cuánto le interesa."
            : !hayQuien
              ? "Falta quién: buscalo o cargalo nuevo."
              : !zona
                ? "Falta dónde se entrega (o “Todavía no sé”)."
                : "Entra al embudo del vendedor del territorio."}
      </p>
    </div>
  );
}
