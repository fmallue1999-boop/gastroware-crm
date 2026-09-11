"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { buscarClientePorTelefono, crearContacto } from "@/lib/actions";
import { telefonoProlijo, normalizarTelefono, sumarDias, hoyISO, fechaCorta } from "@/lib/format";
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

/**
 * Alta de contacto sin trabas: nombre + teléfono y listo. Lo demás es
 * opcional y plegado. Al guardar abre la ficha del contacto.
 */
export default function ContactoNuevoForm({
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
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState(telefonoInicial);
  const [esCliente, setEsCliente] = useState(false);
  const [productoIds, setProductoIds] = useState<string[]>([]);
  const [interesTexto, setInteresTexto] = useState("");
  const [nivel, setNivel] = useState("tibio");
  const [enEspera, setEnEspera] = useState(false);
  const sinStock = productoIds.some((id) => (stockInfo[id]?.stock ?? 1) <= 0);
  const [nota, setNota] = useState(notaInicial);
  const [volverEl, setVolverEl] = useState("");
  const [email, setEmail] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [rubro, setRubro] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [origen, setOrigen] = useState("");
  const [duplicado, setDuplicado] = useState<Cliente | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Aviso de duplicado por teléfono mientras escribe (el reset a null se hace
  // en el onChange del campo; el efecto solo dispara la búsqueda diferida)
  useEffect(() => {
    const digitos = normalizarTelefono(telefono);
    if (digitos.length < 8) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setDuplicado(await buscarClientePorTelefono(digitos));
    }, 400);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [telefono]);

  const grupos = Object.entries(CATEGORIAS_PRODUCTO)
    .map(([cat, label]) => ({
      label,
      items: productos.filter((p) => p.categoria === cat),
    }))
    .filter((g) => g.items.length > 0);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (duplicado) return;
    setError(null);
    startTransition(async () => {
      const res = await crearContacto({
        nombre,
        telefono,
        email,
        empresa,
        esCliente,
        productoIds,
        interesTexto,
        origen: origen || undefined,
        rubro: rubro || undefined,
        ciudad,
        nota,
        volverEl: volverEl || undefined,
        nivel,
        enEspera: enEspera && sinStock,
      });
      if (res && "error" in res) setError(res.error ?? "No se pudo guardar");
    });
  }

  function agregarProducto(id: string) {
    if (!id || productoIds.includes(id)) return;
    setProductoIds([...productoIds, id]);
    // Sin stock: sugerimos la lista de espera de una
    if ((stockInfo[id]?.stock ?? 1) <= 0) setEnEspera(true);
  }

  return (
    <form onSubmit={enviar} className="space-y-3">
      <input
        type="text"
        required
        autoFocus
        placeholder="Nombre de la persona o del negocio"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        className={inputCls}
      />

      <input
        type="tel"
        placeholder="Teléfono / WhatsApp (pegalo como venga)"
        value={telefono}
        onChange={(e) => {
          setTelefono(e.target.value);
          setDuplicado(null);
        }}
        onBlur={() => setTelefono(telefono ? telefonoProlijo(telefono) : "")}
        onPaste={(e) => {
          e.preventDefault();
          setTelefono(telefonoProlijo(e.clipboardData.getData("text")));
          setDuplicado(null);
        }}
        className={inputCls}
      />

      {duplicado && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <p className="font-medium">
            Ese teléfono ya está cargado: {duplicado.nombre_comercial}
          </p>
          <Link
            href={`/clientes/${duplicado.id}`}
            className="mt-1 inline-block rounded-xl bg-tinta px-3 py-1.5 text-sm font-medium text-white"
          >
            Abrir su ficha
          </Link>
        </div>
      )}

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

      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-piedra">
          ¿Qué le interesa? (opcional)
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
        <select value="" onChange={(e) => agregarProducto(e.target.value)} className={inputCls}>
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
          placeholder="…o escribilo con tus palabras"
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
      </div>

      {(productoIds.length > 0 || interesTexto.trim()) && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-piedra">
            ¿Cuánto le interesa?
          </p>
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
        <div className="flex flex-wrap gap-1.5">
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

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending || !!duplicado || !nombre.trim()}
        className="w-full rounded-2xl bg-tinta py-4 text-base font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Guardar contacto"}
      </button>
    </form>
  );
}
