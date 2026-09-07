"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { X } from "lucide-react";
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
  ORIGENES,
  RUBROS,
  SEGUIMIENTO_RAPIDO,
} from "@/lib/constants";
import { textoStock, type InfoStock } from "@/lib/stock";
import type { Cliente, Producto } from "@/lib/types";

const inputCls =
  "w-full rounded-2xl border border-borde bg-white shadow-sm px-4 py-3.5 text-base outline-none focus:border-tinta";
const chipCls = (activo: boolean) =>
  `rounded-full px-3.5 py-2 text-sm font-medium ${
    activo ? "bg-tinta text-white" : "border border-borde bg-white text-piedra"
  }`;
const pareceTelefono = (s: string) => /^[\d\s+\-().]{6,}$/.test(s.trim());

/**
 * Nuevo interés: primero qué quiere (el producto), después quién. El
 * "quién" se busca en la base mientras se escribe; si no está, se carga
 * con nombre y teléfono ahí mismo. Todo lo demás es opcional.
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
  // 1. Qué
  const [productoIds, setProductoIds] = useState<string[]>([]);
  const [interesTexto, setInteresTexto] = useState("");
  const [nivel, setNivel] = useState("tibio");
  const [enEspera, setEnEspera] = useState(false);
  // 2. Quién
  const [q, setQ] = useState(telefonoInicial);
  const [resultados, setResultados] = useState<Cliente[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [esNuevo, setEsNuevo] = useState(false);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [esCliente, setEsCliente] = useState(false);
  const [rubro, setRubro] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [origen, setOrigen] = useState("");
  // 3. Extras
  const [nota, setNota] = useState(notaInicial);
  const [volverEl, setVolverEl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sinStock = productoIds.some((id) => (stockInfo[id]?.stock ?? 1) <= 0);
  const hayInteres = productoIds.length > 0 || interesTexto.trim().length > 0;
  const hayQuien =
    !!cliente ||
    (esNuevo && nombre.trim().length > 0 && (normalizarTelefono(telefono).length >= 6 || email.trim().length > 0));

  const grupos = Object.entries(CATEGORIAS_PRODUCTO)
    .map(([cat, label]) => ({
      label,
      items: productos.filter((p) => p.categoria === cat),
    }))
    .filter((g) => g.items.length > 0);

  function agregarProducto(id: string) {
    if (!id || productoIds.includes(id)) return;
    setProductoIds([...productoIds, id]);
    if ((stockInfo[id]?.stock ?? 1) <= 0) setEnEspera(true);
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

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await registrarInteres({
        productoIds,
        interesTexto,
        nivel,
        enEspera: enEspera && sinStock,
        clienteId: cliente?.id,
        nombre: esNuevo ? nombre : undefined,
        telefono: esNuevo ? telefono : undefined,
        email: esNuevo ? email : undefined,
        empresa: esNuevo ? empresa : undefined,
        esCliente: esNuevo ? esCliente : undefined,
        origen: origen || undefined,
        rubro: rubro || undefined,
        ciudad,
        nota,
        volverEl: volverEl || undefined,
      });
      if (res && "error" in res) setError(res.error ?? "No se pudo guardar");
    });
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      {/* 1. Qué le interesa */}
      <section className="rounded-2xl border border-borde bg-white p-3.5 shadow-sm">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-piedra">
          1 · ¿Qué le interesa?
        </p>
        {productoIds.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            {productoIds.map((id) => {
              const p = productos.find((x) => x.id === id);
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-tinta px-3 py-1.5 text-sm text-white"
                >
                  {p?.nombre ?? "Producto"}
                  <button
                    type="button"
                    onClick={() => setProductoIds(productoIds.filter((x) => x !== id))}
                    aria-label="Quitar"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              );
            })}
          </div>
        )}
        <select
          autoFocus
          value=""
          onChange={(e) => agregarProducto(e.target.value)}
          className={inputCls}
        >
          <option value="">
            {productoIds.length === 0 ? "Elegir del catálogo…" : "Agregar otro…"}
          </option>
          {grupos.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.items.map((p) => (
                <option key={p.id} value={p.id} disabled={productoIds.includes(p.id)}>
                  {p.nombre}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <input
          type="text"
          placeholder="…o escribilo con tus palabras (ej: una licuadora para jugos)"
          value={interesTexto}
          onChange={(e) => setInteresTexto(e.target.value)}
          className={`${inputCls} mt-1.5`}
        />
        {productoIds.length > 0 && (
          <div className="mt-1.5 space-y-0.5">
            {productoIds.map((id) => {
              const info = stockInfo[id];
              if (!info) return null;
              return (
                <p
                  key={id}
                  className={`text-xs ${info.stock > 0 ? "text-green-700" : "text-amber-700"}`}
                >
                  {productos.find((p) => p.id === id)?.nombre}: {textoStock(info, fechaCorta)}
                </p>
              );
            })}
          </div>
        )}
        {hayInteres && (
          <div className="mt-3">
            <p className="mb-1.5 text-xs text-piedra">¿Cuánto le interesa?</p>
            <div className="flex flex-wrap gap-1.5">
              {NIVELES_INTERES.map((n) => (
                <button
                  key={n.value}
                  type="button"
                  onClick={() => setNivel(n.value)}
                  className={chipCls(nivel === n.value)}
                >
                  {n.label}
                </button>
              ))}
            </div>
            {sinStock && (
              <label className="mt-2 flex cursor-pointer items-center gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-900">
                <input
                  type="checkbox"
                  checked={enEspera}
                  onChange={(e) => setEnEspera(e.target.checked)}
                  className="h-4 w-4 accent-tinta"
                />
                Ponerlo en lista de espera: lo quiere y no hay stock
              </label>
            )}
          </div>
        )}
      </section>

      {/* 2. Quién */}
      <section className="rounded-2xl border border-borde bg-white p-3.5 shadow-sm">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-piedra">
          2 · ¿Quién consulta?
        </p>
        {cliente ? (
          <div className="flex items-center justify-between rounded-2xl bg-celeste-soft px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{cliente.nombre_comercial}</p>
              <p className="text-xs text-piedra">
                {cliente.estado === "cliente_activo" ? "Cliente" : "Interesado"}
                {cliente.telefono ? ` · ${telefonoProlijo(cliente.telefono)}` : ""}
                {cliente.ciudad ? ` · ${cliente.ciudad}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setCliente(null);
                setQ("");
              }}
              className="shrink-0 text-xs text-sky-800 underline"
            >
              Cambiar
            </button>
          </div>
        ) : esNuevo ? (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Es alguien nuevo</p>
              <button
                type="button"
                onClick={() => setEsNuevo(false)}
                className="text-xs text-sky-800 underline"
              >
                Buscar en la base
              </button>
            </div>
            <input
              type="text"
              required
              placeholder="Nombre de la persona o del negocio"
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
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setEsCliente(false)}
                className={`flex-1 rounded-2xl px-3 py-2.5 text-sm font-medium ${
                  !esCliente ? "bg-tinta text-white" : "border border-borde bg-white text-piedra"
                }`}
              >
                Interesado
              </button>
              <button
                type="button"
                onClick={() => setEsCliente(true)}
                className={`flex-1 rounded-2xl px-3 py-2.5 text-sm font-medium ${
                  esCliente ? "bg-tinta text-white" : "border border-borde bg-white text-piedra"
                }`}
              >
                Ya es cliente
              </button>
            </div>
            <details>
              <summary className="cursor-pointer text-sm text-sky-700 underline list-none [&::-webkit-details-marker]:hidden">
                Más datos (opcional): email, empresa, rubro, ciudad, de dónde viene
              </summary>
              <div className="mt-2 space-y-2.5">
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputCls}
                />
                <input
                  type="text"
                  placeholder="Empresa o negocio (si el nombre es de una persona)"
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
                <div className="flex flex-wrap gap-1.5">
                  {ORIGENES.map((o) => (
                    <button
                      key={o}
                      type="button"
                      onClick={() => setOrigen(origen === o ? "" : o)}
                      className={chipCls(origen === o)}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              </div>
            </details>
          </div>
        ) : (
          <>
            <input
              type="search"
              placeholder="Nombre o teléfono: buscamos en la base"
              value={q}
              onChange={(e) => buscar(e.target.value)}
              className={inputCls}
            />
            <div className="mt-1.5 space-y-1.5">
              {buscando && <p className="text-xs text-piedra">Buscando…</p>}
              {resultados.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setCliente(c);
                    setResultados([]);
                  }}
                  className="block w-full rounded-2xl border border-borde bg-white p-3 text-left text-sm shadow-sm"
                >
                  <span className="font-medium">{c.nombre_comercial}</span>
                  <span className="text-piedra">
                    {c.estado === "cliente_activo" ? " · Cliente" : ""}
                    {c.ciudad ? ` · ${c.ciudad}` : ""}
                    {c.telefono ? ` · ${telefonoProlijo(c.telefono)}` : ""}
                  </span>
                </button>
              ))}
              {q.trim().length >= 2 && !buscando && (
                <button
                  type="button"
                  onClick={cargarloNuevo}
                  className="block w-full rounded-2xl border border-dashed border-borde bg-white p-3 text-left text-sm text-tinta"
                >
                  {resultados.length === 0 ? "No está en la base. " : "No es ninguno. "}
                  <span className="font-medium underline">Cargarlo como nuevo</span>
                </button>
              )}
              {q.trim().length < 2 && (
                <button
                  type="button"
                  onClick={cargarloNuevo}
                  className="text-xs text-sky-700 underline"
                >
                  Es alguien nuevo, cargarlo
                </button>
              )}
            </div>
          </>
        )}
      </section>

      {/* 3. Opcional */}
      <section className="space-y-3">
        <textarea
          placeholder="Nota (opcional): qué hablaron, qué tiene, qué necesita…"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          rows={2}
          className={inputCls}
        />
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-piedra">
            ¿Volver a contactar? (opcional)
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {SEGUIMIENTO_RAPIDO.map((o) => {
              const fecha = sumarDias(o.dias);
              return (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => setVolverEl(volverEl === fecha ? "" : fecha)}
                  className={chipCls(volverEl === fecha)}
                >
                  {o.label}
                </button>
              );
            })}
            <input
              type="date"
              value={volverEl}
              min={hoyISO()}
              onChange={(e) => setVolverEl(e.target.value)}
              className="rounded-full border border-borde bg-white px-3 py-1.5 text-sm outline-none focus:border-tinta"
            />
          </div>
        </div>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending || !hayInteres || !hayQuien}
        className="w-full rounded-2xl bg-tinta py-4 text-base font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Guardar interés"}
      </button>
      <p className="text-center text-xs text-piedra">
        {!hayInteres
          ? "Primero elegí qué le interesa."
          : !hayQuien
            ? "Falta a quién asignarlo: buscalo en la base o cargalo nuevo."
            : "Se guarda en la ficha del contacto y queda en Movimientos."}
        {" "}
        <Link href="/clientes/nuevo" className="underline">
          ¿Solo un contacto, sin interés?
        </Link>
      </p>
    </form>
  );
}
