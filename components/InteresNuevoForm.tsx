"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, ChevronLeft, Search } from "lucide-react";
import { buscarClientes, registrarInteres } from "@/lib/actions";
import {
  fechaCorta,
  hoyISO,
  normalizarTelefono,
  sumarDias,
  telefonoProlijo,
} from "@/lib/format";
import {
  CATEGORIAS_PRODUCTO,
  NIVELES_INTERES,
  ORIGENES_INTERES,
  RUBROS,
  SEGUIMIENTO_RAPIDO,
} from "@/lib/constants";
import { textoStock, type InfoStock } from "@/lib/stock";
import type { Cliente, Producto } from "@/lib/types";

const inputCls =
  "min-h-12 w-full rounded-2xl border border-borde bg-white px-4 py-3 text-base shadow-sm outline-none focus:border-tinta";
const chipCls = (activo: boolean) =>
  `min-h-11 rounded-full px-3.5 py-2 text-[15px] font-medium ${
    activo ? "bg-tinta text-white" : "border border-borde bg-white text-piedra"
  }`;
const botonPrimario =
  "min-h-12 w-full rounded-2xl bg-tinta py-3.5 text-base font-semibold text-white disabled:opacity-50";
const pareceTelefono = (s: string) => /^[\d\s+\-().]{6,}$/.test(s.trim());

/**
 * + Interés en tres pantallas (Etapa 1, 1.4): primero qué le interesa y
 * cuánto, después quién (de la base o nuevo), y al final, opcional, una nota,
 * de dónde viene, cuándo volver a contactar y lista de espera si no hay stock.
 */
export default function InteresNuevoForm({
  productos,
  stockInfo = {},
  telefonoInicial = "",
  notaInicial = "",
}: {
  productos: Producto[];
  stockInfo?: Record<string, InfoStock>;
  telefonoInicial?: string;
  notaInicial?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  // 1 · Qué
  const [filtro, setFiltro] = useState("");
  const [productoIds, setProductoIds] = useState<string[]>([]);
  const [otro, setOtro] = useState(false);
  const [interesTexto, setInteresTexto] = useState("");
  const [nivel, setNivel] = useState("");
  // 2 · Quién
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
  // 3 · Algo más
  const [nota, setNota] = useState(notaInicial);
  const [origen, setOrigen] = useState("");
  const [volverEl, setVolverEl] = useState("");
  const [sinFecha, setSinFecha] = useState(false);
  const [enEspera, setEnEspera] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Compartido desde WhatsApp: el teléfono ya viene buscado en la pantalla 2
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
  const paso1Listo = hayInteres && !!nivel;
  const hayQuien =
    !!cliente ||
    (esNuevo &&
      nombre.trim().length > 0 &&
      (normalizarTelefono(telefono).length >= 6 || email.trim().length > 0));

  const f = filtro.trim().toLowerCase();
  const grupos = Object.entries(CATEGORIAS_PRODUCTO)
    .map(([cat, label]) => ({
      label,
      items: productos.filter(
        (p) => p.categoria === cat && (!f || p.nombre.toLowerCase().includes(f))
      ),
    }))
    .filter((g) => g.items.length > 0);

  const nombreInteres =
    [
      ...productoIds.map((id) => productos.find((p) => p.id === id)?.nombre).filter(Boolean),
      otro && interesTexto.trim() ? interesTexto.trim() : null,
    ]
      .filter(Boolean)
      .join(", ") || "—";
  const nombreQuien = cliente?.nombre_comercial ?? (esNuevo ? empresa.trim() || nombre.trim() : "");

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

  function elegirChipFecha(dias: number | null) {
    if (dias == null) {
      setSinFecha(!sinFecha);
      setVolverEl("");
      return;
    }
    const fecha = sumarDias(dias);
    setSinFecha(false);
    setVolverEl(volverEl === fecha ? "" : fecha);
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
      });
      if (res && "error" in res) setError(res.error ?? "No se pudo guardar");
    });
  }

  const cabecera = (n: number, texto: string) => (
    <div className="mb-3 flex items-center gap-2">
      {n > 1 && (
        <button
          type="button"
          onClick={() => setPaso((n - 1) as 1 | 2)}
          aria-label="Volver"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-borde bg-white"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      <p className="text-[15px] font-semibold">
        <span className="text-piedra">{n} de 3 · </span>
        {texto}
      </p>
    </div>
  );

  // ---------- 1 · ¿Qué le interesa? ----------
  if (paso === 1) {
    return (
      <div className="space-y-3">
        {cabecera(1, "¿Qué le interesa?")}
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-piedra" />
          <input
            type="search"
            autoFocus
            placeholder="Buscar producto…"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className={`${inputCls} pl-11`}
          />
        </div>
        <div className="space-y-3">
          {grupos.map((g) => (
            <section key={g.label}>
              <p className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-piedra">{g.label}</p>
              <div className="space-y-1.5">
                {g.items.map((p) => {
                  const elegido = productoIds.includes(p.id);
                  const info = stockInfo[p.id];
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => alternarProducto(p.id)}
                      className={`flex min-h-12 w-full items-center justify-between gap-2 rounded-2xl border px-4 py-2.5 text-left ${
                        elegido ? "border-tinta bg-tinta text-white" : "border-borde bg-white"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block text-[15px] font-medium">{p.nombre}</span>
                        {info && (
                          <span
                            className={`block text-xs ${
                              elegido ? "text-white/80" : info.stock > 0 ? "text-green-700" : "text-amber-700"
                            }`}
                          >
                            {textoStock(info, fechaCorta)}
                          </span>
                        )}
                      </span>
                      {elegido && <Check className="h-5 w-5 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
          {grupos.length === 0 && (
            <p className="text-[15px] text-piedra">Ningún producto con “{filtro}”. Podés escribirlo abajo.</p>
          )}
          <button
            type="button"
            onClick={() => setOtro(!otro)}
            className={`flex min-h-12 w-full items-center justify-between rounded-2xl border px-4 py-2.5 text-left text-[15px] font-medium ${
              otro ? "border-tinta bg-tinta text-white" : "border-dashed border-borde bg-white"
            }`}
          >
            Otro (escribir)
            {otro && <Check className="h-5 w-5 shrink-0" />}
          </button>
          {otro && (
            <input
              type="text"
              autoFocus
              placeholder="Qué le interesa, con tus palabras (ej: una licuadora para jugos)"
              value={interesTexto}
              onChange={(e) => setInteresTexto(e.target.value)}
              className={inputCls}
            />
          )}
        </div>

        <div className="rounded-2xl border border-borde bg-white p-3.5 shadow-sm">
          <p className="mb-1.5 text-[15px] font-semibold">¿Cuánto le interesa?</p>
          <div className="flex flex-wrap gap-1.5">
            {NIVELES_INTERES.map((n) => (
              <button key={n.value} type="button" onClick={() => setNivel(n.value)} className={chipCls(nivel === n.value)}>
                {n.label}
              </button>
            ))}
          </div>
        </div>

        <button type="button" disabled={!paso1Listo} onClick={() => setPaso(2)} className={botonPrimario}>
          Siguiente: ¿quién?
        </button>
        <p className="text-center text-xs text-piedra">
          {!hayInteres ? "Tocá un producto (o Otro)." : !nivel ? "Falta cuánto le interesa." : `${nombreInteres} · ${NIVELES_INTERES.find((n) => n.value === nivel)?.label}`}
        </p>
      </div>
    );
  }

  // ---------- 2 · ¿Quién? ----------
  if (paso === 2) {
    return (
      <div className="space-y-3">
        {cabecera(2, "¿Quién?")}
        <p className="text-sm text-piedra">
          Le interesa <span className="font-medium text-tinta">{nombreInteres}</span>
        </p>

        {esNuevo ? (
          <div className="space-y-2.5 rounded-2xl border border-borde bg-white p-3.5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-semibold">Es alguien nuevo</p>
              <button type="button" onClick={() => setEsNuevo(false)} className="text-sm text-sky-700 underline">
                Buscar en la base
              </button>
            </div>
            <input
              type="text"
              required
              autoFocus={!nombre}
              placeholder="Nombre de la persona"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className={inputCls}
            />
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
            <input
              type="email"
              placeholder="Email (si no tenés teléfono)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
            />
            <details>
              <summary className="cursor-pointer list-none text-[15px] text-sky-700 underline [&::-webkit-details-marker]:hidden">
                Más datos (opcional): empresa, rubro, ciudad
              </summary>
              <div className="mt-2 space-y-2.5">
                <input
                  type="text"
                  placeholder="Empresa o negocio"
                  value={empresa}
                  onChange={(e) => setEmpresa(e.target.value)}
                  className={inputCls}
                />
                <select value={rubro} onChange={(e) => setRubro(e.target.value)} className={inputCls}>
                  <option value="">Rubro…</option>
                  {RUBROS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Ciudad"
                  value={ciudad}
                  onChange={(e) => setCiudad(e.target.value)}
                  className={inputCls}
                />
              </div>
            </details>
            <p className="text-xs text-piedra">Con nombre y teléfono (o email) alcanza. Queda asignado a vos.</p>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-piedra" />
              <input
                type="search"
                autoFocus
                placeholder="Nombre, empresa o teléfono"
                value={q}
                onChange={(e) => buscar(e.target.value)}
                className={`${inputCls} pl-11`}
              />
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
                    setPaso(3);
                  }}
                  className="flex min-h-12 w-full items-center justify-between gap-2 rounded-2xl border border-borde bg-white px-4 py-2.5 text-left shadow-sm"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-medium">{c.nombre_comercial}</span>
                    <span className="block text-xs text-piedra">
                      {[c.ciudad, c.telefono ? telefonoProlijo(c.telefono) : null].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      c.estado === "cliente_activo" ? "bg-green-100 text-green-700" : "bg-celeste-soft text-sky-800"
                    }`}
                  >
                    {c.estado === "cliente_activo" ? "Cliente" : "Interesado"}
                  </span>
                </button>
              ))}
              {q.trim().length >= 2 && !buscando && (
                <button
                  type="button"
                  onClick={cargarloNuevo}
                  className="flex min-h-12 w-full items-center rounded-2xl border border-dashed border-borde bg-white px-4 py-2.5 text-left text-[15px]"
                >
                  {resultados.length === 0 ? "No está en la base. " : "No es ninguno. "}
                  <span className="ml-1 font-medium underline">Cargarlo nuevo</span>
                </button>
              )}
              {q.trim().length < 2 && (
                <button type="button" onClick={cargarloNuevo} className="px-1 text-[15px] text-sky-700 underline">
                  Es alguien nuevo, cargarlo
                </button>
              )}
            </div>
          </>
        )}

        {esNuevo && (
          <>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="button" disabled={!hayQuien} onClick={() => setPaso(3)} className={botonPrimario}>
              Siguiente: ¿algo más?
            </button>
            <button
              type="button"
              disabled={pending || !hayQuien}
              onClick={guardar}
              className="min-h-12 w-full rounded-2xl border border-borde bg-white py-3 text-base font-medium disabled:opacity-50"
            >
              {pending ? "Guardando…" : "Guardar sin más datos"}
            </button>
          </>
        )}
      </div>
    );
  }

  // ---------- 3 · ¿Algo más? ----------
  return (
    <div className="space-y-3">
      {cabecera(3, "¿Algo más?")}
      <p className="text-sm text-piedra">
        <span className="font-medium text-tinta">{nombreQuien || "—"}</span> · le interesa{" "}
        <span className="font-medium text-tinta">{nombreInteres}</span>
        {" · "}
        <button type="button" onClick={() => setPaso(2)} className="underline">
          cambiar
        </button>
      </p>

      <textarea
        autoFocus
        placeholder="Nota (opcional): consultó por WhatsApp, quiere para diciembre…"
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        rows={2}
        className={inputCls}
      />

      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-piedra">¿De dónde viene?</p>
        <div className="flex flex-wrap gap-1.5">
          {ORIGENES_INTERES.map((o) => (
            <button key={o} type="button" onClick={() => setOrigen(origen === o ? "" : o)} className={chipCls(origen === o)}>
              {o}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-piedra">¿Cuándo volver a contactar?</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {SEGUIMIENTO_RAPIDO.map((o) => {
            const activo = o.dias == null ? sinFecha : !!volverEl && volverEl === sumarDias(o.dias);
            return (
              <button key={o.label} type="button" onClick={() => elegirChipFecha(o.dias)} className={chipCls(activo)}>
                {o.label}
              </button>
            );
          })}
          <input
            type="date"
            value={volverEl}
            min={hoyISO()}
            onChange={(e) => {
              setVolverEl(e.target.value);
              setSinFecha(false);
            }}
            aria-label="Otra fecha"
            className="min-h-11 rounded-full border border-borde bg-white px-3 py-1.5 text-sm outline-none focus:border-tinta"
          />
        </div>
      </div>

      {sinStock && (
        <button
          type="button"
          onClick={() => setEnEspera(!enEspera)}
          className={`flex min-h-12 w-full items-center justify-between rounded-2xl border px-4 py-2.5 text-left text-[15px] font-medium ${
            enEspera ? "border-orange-400 bg-orange-100 text-orange-900" : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          <span>
            Poner en lista de espera
            <span className="block text-xs font-normal">Lo quiere y no hay stock: aparece cuando llegue.</span>
          </span>
          {enEspera && <Check className="h-5 w-5 shrink-0" />}
        </button>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="button" disabled={pending || !hayQuien} onClick={guardar} className={botonPrimario}>
        {pending ? "Guardando…" : "Guardar"}
      </button>
      <p className="text-center text-xs text-piedra">Se guarda en la ficha del contacto y queda en Movimientos.</p>
    </div>
  );
}
