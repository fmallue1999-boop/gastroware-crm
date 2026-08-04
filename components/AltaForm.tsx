"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ClipboardPaste } from "lucide-react";
import { buscarClientePorTelefono, crearLead } from "@/lib/actions";
import { telefonoProlijo, normalizarTelefono } from "@/lib/format";
import { RUBROS, ORIGENES, TEMPERATURAS } from "@/lib/constants";
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
  const [nombre, setNombre] = useState("");
  const [rubro, setRubro] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [productoId, setProductoId] = useState("");
  const [origen, setOrigen] = useState("WhatsApp");
  const [temperatura, setTemperatura] = useState("tibio");
  const [soloPrecio, setSoloPrecio] = useState(false);
  const [mensaje, setMensaje] = useState(mensajeInicial ?? "");
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Verificación de duplicado automática (sin esperar a salir del campo)
  useEffect(() => {
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
  }, [telefono]);

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

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await crearLead({
        clienteId: existente?.id,
        telefono: normalizarTelefono(telefono),
        nombre_comercial: nombre,
        rubro,
        ciudad,
        producto_id: productoId,
        origen,
        temperatura,
        mensaje_inicial: mensaje,
        soloPrecio,
      });
      if (res && "error" in res) setError(res.error ?? "Error al crear");
    });
  }

  return (
    <form onSubmit={enviar} className="space-y-3">
      <div className="flex gap-2">
        <input
          type="tel"
          required
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

      {existente && (
        <div className="rounded-2xl border border-celeste bg-celeste-soft p-3 text-sm text-tinta">
          <p className="font-medium">
            Este teléfono ya existe: {existente.nombre_comercial}
          </p>
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

      <select
        required
        value={productoId}
        onChange={(e) => setProductoId(e.target.value)}
        className={inputCls}
      >
        <option value="">Producto consultado…</option>
        {productos.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nombre}
          </option>
        ))}
      </select>

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
          <button
            type="button"
            onClick={() => setSoloPrecio(false)}
            className={`flex-1 rounded-2xl px-3 py-2.5 text-sm font-medium ${
              !soloPrecio
                ? "bg-tinta text-white"
                : "border border-borde bg-white text-piedra"
            }`}
          >
            Consulta general
          </button>
          <button
            type="button"
            onClick={() => setSoloPrecio(true)}
            className={`flex-1 rounded-2xl px-3 py-2.5 text-sm font-medium ${
              soloPrecio
                ? "bg-amber-500 text-white"
                : "border border-borde bg-white text-piedra"
            }`}
          >
            Solo pide precio
          </button>
        </div>
        {soloPrecio && (
          <p className="mt-1.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs text-amber-800">
            Al crear el lead te aparece el guión exacto para responder sin
            quemar el precio, listo para mandar por WhatsApp.
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
