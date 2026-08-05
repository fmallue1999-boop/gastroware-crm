"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ClipboardPaste, UserSearch, X } from "lucide-react";
import { buscarClientePorTelefono, buscarClientes, crearLead } from "@/lib/actions";
import { telefonoProlijo, normalizarTelefono } from "@/lib/format";
import {
  RUBROS,
  ORIGENES,
  TEMPERATURAS,
  PEDIDOS,
  CATEGORIAS_PRODUCTO,
} from "@/lib/constants";
import type { Cliente, Producto } from "@/lib/types";

const inputCls =
  "w-full rounded-2xl border border-borde bg-white shadow-sm px-4 py-3 text-base outline-none focus:border-tinta";

/** Extrae un teléfono argentino plausible de un texto compartido. */
function extraerTelefono(texto: string): string | null {
  const m = texto.match(/(?:\+?54\s?9?[\s\-.]?)?(?:\(?\d{2,4}\)?[\s\-.]?)?\d{3,4}[\s\-.]?\d{4}/);
  if (!m) return null;
  const digitos = m[0].replace(/\D/g, "");
  return digitos.length >= 8 ? m[0].trim() : null;
}

export default function AltaForm({
  productos,
  telefonoInicial,
  mensajeInicial,
}: {
  productos: Producto[];
  telefonoInicial?: string;
  mensajeInicial?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [telefono, setTelefono] = useState(
    telefonoInicial ? telefonoProlijo(telefonoInicial) : ""
  );
  const [existente, setExistente] = useState<Cliente | null>(null);
  // Cliente elegido a mano con el buscador (no lo pisa la detección por teléfono)
  const [elegidoManual, setElegidoManual] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<Cliente[]>([]);
  const [nombre, setNombre] = useState("");
  const [rubro, setRubro] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [productoIds, setProductoIds] = useState<string[]>([]);
  const [origen, setOrigen] = useState("WhatsApp");
  const [temperatura, setTemperatura] = useState("tibio");
  const [pedido, setPedido] = useState<"precio" | "info" | "general">("general");
  const [mensaje, setMensaje] = useState(mensajeInicial ?? "");
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Verificación de duplicado automática (sin esperar a salir del campo)
  useEffect(() => {
    if (elegidoManual) return;
    const digitos = normalizarTelefono(telefono);
    if (digitos.length < 8) {
      setExistente(null);
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const cliente = await buscarClientePorTelefono(digitos);
      setExistente(cliente);
      if (cliente) {
        setNombre(cliente.nombre_comercial);
        setRubro(cliente.rubro);
      }
    }, 400);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [telefono, elegidoManual]);

  async function buscarPorNombre(valor: string) {
    setQ(valor);
    if (valor.trim().length < 2) {
      setResultados([]);
      return;
    }
    setResultados(await buscarClientes(valor));
  }

  function elegirCliente(c: Cliente) {
    setExistente(c);
    setElegidoManual(true);
    setNombre(c.nombre_comercial);
    setRubro(c.rubro);
    if (c.telefono) setTelefono(telefonoProlijo(c.telefono));
    setBuscando(false);
    setQ("");
    setResultados([]);
  }

  function quitarCliente() {
    setExistente(null);
    setElegidoManual(false);
    setNombre("");
    setRubro("");
  }

  function tomarTelefono(crudo: string) {
    // Deja el número entero y prolijo, venga como venga
    setTelefono(telefonoProlijo(crudo));
  }

  async function pegarDelPortapapeles() {
    try {
      const texto = await navigator.clipboard.readText();
      if (!texto) return;
      const tel = extraerTelefono(texto);
      if (tel) {
        tomarTelefono(tel);
        // Lo que no es número puede servir como nota inicial
        const resto = texto.replace(tel, "").replace(/\s+/g, " ").trim();
        if (resto.length >= 4 && !mensaje) setMensaje(resto.slice(0, 500));
      } else {
        tomarTelefono(texto);
      }
    } catch {
      // sin permiso de portapapeles
    }
  }

  function agregarProducto(id: string) {
    if (id && !productoIds.includes(id)) setProductoIds([...productoIds, id]);
  }

  function quitarProducto(id: string) {
    setProductoIds(productoIds.filter((p) => p !== id));
  }

  // Productos agrupados por categoría para el desplegable
  const grupos = Object.entries(CATEGORIAS_PRODUCTO)
    .map(([cat, label]) => ({
      label,
      items: productos.filter((p) => p.categoria === cat),
    }))
    .filter((g) => g.items.length > 0);
  const sinCategoria = productos.filter(
    (p) => !(p.categoria in CATEGORIAS_PRODUCTO)
  );

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (productoIds.length === 0) {
      setError("Agregá al menos un producto consultado");
      return;
    }
    startTransition(async () => {
      const res = await crearLead({
        clienteId: existente?.id,
        telefono: normalizarTelefono(telefono),
        nombre_comercial: nombre,
        rubro,
        ciudad,
        productoIds,
        origen,
        temperatura,
        mensaje_inicial: mensaje,
        pedido,
      });
      if (res && "error" in res) setError(res.error ?? "Error al crear");
    });
  }

  return (
    <form onSubmit={enviar} className="space-y-3">
      <div className="flex gap-2">
        <input
          type="tel"
          required={!existente}
          placeholder="Teléfono / WhatsApp (pegalo como venga)"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          onBlur={() => tomarTelefono(telefono)}
          onPaste={(e) => {
            e.preventDefault();
            tomarTelefono(e.clipboardData.getData("text"));
          }}
          className={inputCls}
        />
        <button
          type="button"
          onClick={pegarDelPortapapeles}
          className="inline-flex shrink-0 items-center gap-1 rounded-2xl border border-borde bg-white shadow-sm px-3 text-sm text-piedra"
          title="Pegar del portapapeles"
        >
          <ClipboardPaste className="h-4 w-4" /> Pegar
        </button>
      </div>

      {!existente && (
        <div>
          <button
            type="button"
            onClick={() => setBuscando(!buscando)}
            className="inline-flex items-center gap-1.5 text-sm text-sky-800 underline"
          >
            <UserSearch className="h-4 w-4" />
            ¿Cliente ya cargado? Buscalo por nombre
          </button>
          {buscando && (
            <div className="mt-2">
              <input
                type="search"
                autoFocus
                placeholder="Nombre, teléfono, CUIT o n° de serie…"
                value={q}
                onChange={(e) => buscarPorNombre(e.target.value)}
                className={inputCls}
              />
              <div className="mt-2 space-y-1.5">
                {resultados.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => elegirCliente(c)}
                    className="block w-full rounded-2xl border border-borde bg-white p-3 text-left text-sm shadow-sm"
                  >
                    <span className="font-medium">{c.nombre_comercial}</span>
                    <span className="text-piedra">
                      {" "}
                      · {c.rubro}
                      {c.ciudad ? ` · ${c.ciudad}` : ""}
                    </span>
                  </button>
                ))}
                {q.trim().length >= 2 && resultados.length === 0 && (
                  <p className="rounded-2xl border border-dashed border-borde p-3 text-sm text-piedra">
                    No aparece: seguí completando abajo y se crea como cliente
                    nuevo.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {existente && (
        <div className="rounded-2xl border border-celeste bg-celeste-soft p-3 text-sm text-tinta">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium">
              {elegidoManual
                ? `Cliente: ${existente.nombre_comercial}`
                : `Este teléfono ya existe: ${existente.nombre_comercial}`}
            </p>
            {elegidoManual && (
              <button
                type="button"
                onClick={quitarCliente}
                className="shrink-0 text-xs text-sky-800 underline"
              >
                Cambiar
              </button>
            )}
          </div>
          <p className="mt-0.5">
            Se creará una consulta nueva en su ficha.{" "}
            <Link href={`/clientes/${existente.id}`} className="underline">
              Ver ficha
            </Link>
          </p>
        </div>
      )}

      <input
        type="text"
        required
        placeholder="Nombre del negocio"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        className={inputCls}
        disabled={!!existente}
      />

      <select
        required
        value={rubro}
        onChange={(e) => setRubro(e.target.value)}
        className={inputCls}
        disabled={!!existente}
      >
        <option value="">Rubro…</option>
        {RUBROS.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>

      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-piedra">
          ¿Qué consultó? (podés agregar varios)
        </p>
        {productoIds.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            {productoIds.map((id, i) => {
              const p = productos.find((x) => x.id === id);
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-tinta px-3 py-1.5 text-sm text-white"
                >
                  {p?.nombre ?? "Producto"}
                  {i === 0 && productoIds.length > 1 && (
                    <span className="text-[10px] uppercase tracking-wide opacity-70">
                      principal
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => quitarProducto(id)}
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
          value=""
          onChange={(e) => agregarProducto(e.target.value)}
          className={inputCls}
        >
          <option value="">
            {productoIds.length === 0
              ? "Agregar producto consultado…"
              : "Agregar otro producto…"}
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
          {sinCategoria.length > 0 && (
            <optgroup label="Otros">
              {sinCategoria.map((p) => (
                <option key={p.id} value={p.id} disabled={productoIds.includes(p.id)}>
                  {p.nombre}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-piedra">
          ¿Por dónde entró?
        </p>
        <div className="flex flex-wrap gap-1.5">
          {ORIGENES.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => setOrigen(o)}
              className={`rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
                origen === o
                  ? "bg-tinta text-white"
                  : "border border-borde bg-white text-piedra"
              }`}
            >
              {o}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-piedra">
          ¿Qué pidió?
        </p>
        <div className="flex gap-1.5">
          {PEDIDOS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPedido(p.value)}
              className={`flex-1 rounded-2xl px-3 py-2.5 text-sm font-medium ${
                pedido === p.value
                  ? p.value === "precio"
                    ? "bg-amber-500 text-white"
                    : "bg-tinta text-white"
                  : "border border-borde bg-white text-piedra"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {pedido === "precio" && (
          <p className="mt-1.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs text-amber-800">
            Al crear el lead te aparece el guión exacto para responder sin
            quemar el precio, listo para mandar por WhatsApp.
          </p>
        )}
        {pedido === "info" && (
          <p className="mt-1.5 rounded-lg bg-celeste-soft border border-celeste px-3 py-1.5 text-xs text-sky-800">
            Típico de web y pauta: la primera tarea va a ser mandarle la ficha
            del producto y hacerle 2 preguntas para calificarlo.
          </p>
        )}
      </div>

      <select
        value={temperatura}
        onChange={(e) => setTemperatura(e.target.value)}
        className={inputCls}
      >
        {TEMPERATURAS.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>

      <input
        type="text"
        placeholder="Ciudad (opcional)"
        value={ciudad}
        onChange={(e) => setCiudad(e.target.value)}
        className={inputCls}
        disabled={!!existente}
      />

      <textarea
        placeholder="Mensaje inicial o nota (opcional)"
        value={mensaje}
        onChange={(e) => setMensaje(e.target.value)}
        rows={2}
        className={inputCls}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-2xl bg-tinta py-3.5 font-medium text-white disabled:opacity-60"
      >
        {pending ? "Creando…" : "Crear lead"}
      </button>
    </form>
  );
}
