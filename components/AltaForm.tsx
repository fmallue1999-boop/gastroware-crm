"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { buscarClientePorTelefono, crearLead } from "@/lib/actions";
import { RUBROS, ORIGENES, TEMPERATURAS } from "@/lib/constants";
import type { Cliente, Producto } from "@/lib/types";

const inputCls =
  "w-full rounded-xl border border-borde bg-white px-4 py-3 text-base outline-none focus:border-tinta";

export default function AltaForm({ productos }: { productos: Producto[] }) {
  const [pending, startTransition] = useTransition();
  const [telefono, setTelefono] = useState("");
  const [existente, setExistente] = useState<Cliente | null>(null);
  const [nombre, setNombre] = useState("");
  const [rubro, setRubro] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [productoId, setProductoId] = useState("");
  const [origen, setOrigen] = useState("WhatsApp");
  const [temperatura, setTemperatura] = useState("tibio");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function verificarTelefono() {
    if (telefono.trim().length < 6) return;
    const cliente = await buscarClientePorTelefono(telefono);
    setExistente(cliente);
    if (cliente) {
      setNombre(cliente.nombre_comercial);
      setRubro(cliente.rubro);
    }
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await crearLead({
        clienteId: existente?.id,
        telefono,
        nombre_comercial: nombre,
        rubro,
        ciudad,
        producto_id: productoId,
        origen,
        temperatura,
        mensaje_inicial: mensaje,
      });
      if (res && "error" in res) setError(res.error ?? "Error al crear");
    });
  }

  return (
    <form onSubmit={enviar} className="space-y-3">
      <input
        type="tel"
        required
        placeholder="Teléfono / WhatsApp"
        value={telefono}
        onChange={(e) => setTelefono(e.target.value)}
        onBlur={verificarTelefono}
        className={inputCls}
      />

      {existente && (
        <div className="rounded-xl border border-celeste bg-celeste-soft p-3 text-sm text-tinta">
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

      <div className="grid grid-cols-2 gap-3">
        <select
          value={origen}
          onChange={(e) => setOrigen(e.target.value)}
          className={inputCls}
        >
          {ORIGENES.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
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
      </div>

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
        className="w-full rounded-xl bg-tinta py-3.5 font-medium text-white disabled:opacity-60"
      >
        {pending ? "Creando…" : "Crear lead"}
      </button>
    </form>
  );
}
