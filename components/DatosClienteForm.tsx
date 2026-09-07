"use client";

import { useState, useTransition } from "react";
import { BellOff, Pencil } from "lucide-react";
import { actualizarCliente, setNoContactar } from "@/lib/actions";
import { telefonoProlijo } from "@/lib/format";
import { CONDICIONES_FISCALES, RUBROS } from "@/lib/constants";
import type { Cliente } from "@/lib/types";

const inputCls =
  "w-full rounded-2xl border border-borde bg-white shadow-sm px-3 py-2.5 text-sm outline-none focus:border-tinta";

export default function DatosClienteForm({ cliente }: { cliente: Cliente }) {
  const [editando, setEditando] = useState(false);
  const [pending, startTransition] = useTransition();
  const [nombre, setNombre] = useState(cliente.nombre_comercial ?? "");
  const [rubro, setRubro] = useState(cliente.rubro ?? "Otro");
  const [razonSocial, setRazonSocial] = useState(cliente.razon_social ?? "");
  const [cuit, setCuit] = useState(cliente.cuit ?? "");
  const [condicion, setCondicion] = useState(cliente.condicion_fiscal ?? "");
  const [email, setEmail] = useState(cliente.email ?? "");
  const [telefono, setTelefono] = useState(cliente.telefono ?? "");
  const [error, setError] = useState<string | null>(null);

  const etiquetaCondicion = CONDICIONES_FISCALES.find(
    (c) => c.value === cliente.condicion_fiscal
  )?.label;

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      if (!nombre.trim()) {
        setError("El nombre no puede quedar vacío");
        return;
      }
      const res = await actualizarCliente(cliente.id, {
        nombre_comercial: nombre.trim(),
        rubro: rubro || "Otro",
        razon_social: razonSocial,
        cuit,
        condicion_fiscal: condicion,
        email,
        telefono,
      });
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      setEditando(false);
    });
  }

  if (!editando) {
    const filas = [
      { k: "Nombre", v: cliente.nombre_comercial },
      { k: "Rubro", v: cliente.rubro },
      { k: "Razón social", v: cliente.razon_social },
      { k: "CUIT", v: cliente.cuit },
      { k: "Cond. fiscal", v: etiquetaCondicion },
      { k: "Email", v: cliente.email },
      { k: "Teléfono", v: cliente.telefono ? telefonoProlijo(cliente.telefono) : null },
    ];
    return (
      <section className="rounded-2xl border border-borde bg-white shadow-sm p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Datos de facturación</h2>
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="inline-flex items-center gap-1 rounded-xl border border-borde px-3 py-1.5 text-xs text-piedra hover:bg-crema"
          >
            <Pencil className="h-3 w-3" /> Editar
          </button>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
          {filas.map((f) => (
            <div key={f.k}>
              <p className="text-xs text-piedra">{f.k}</p>
              <p className={f.v ? "" : "text-piedra/60"}>{f.v ?? "Falta"}</p>
            </div>
          ))}
        </div>
        {(!cliente.cuit || !cliente.condicion_fiscal) && (
          <p className="mt-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs text-amber-800">
            Faltan datos fiscales: los necesitás para facturar en ZEUS.
          </p>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(
              async () =>
                void (await setNoContactar(cliente.id, !cliente.no_contactar))
            )
          }
          className={`mt-2 inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs ${
            cliente.no_contactar
              ? "bg-red-100 font-medium text-red-700"
              : "border border-borde text-piedra hover:bg-crema"
          }`}
        >
          <BellOff className="h-3 w-3" />
          {cliente.no_contactar
            ? "No contactar (excluido de campañas) — tocá para reactivar"
            : "Marcar como no contactar"}
        </button>
      </section>
    );
  }

  return (
    <form
      onSubmit={guardar}
      className="space-y-2.5 rounded-2xl border border-borde bg-white shadow-sm p-4"
    >
      <h2 className="text-sm font-semibold">Datos de facturación</h2>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          placeholder="Nombre del contacto o negocio"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className={inputCls}
        />
        <select value={rubro} onChange={(e) => setRubro(e.target.value)} className={inputCls}>
          {RUBROS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
      <input
        type="text"
        placeholder="Razón social"
        value={razonSocial}
        onChange={(e) => setRazonSocial(e.target.value)}
        className={inputCls}
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          placeholder="CUIT (solo números)"
          value={cuit}
          onChange={(e) => setCuit(e.target.value)}
          className={inputCls}
        />
        <select
          value={condicion}
          onChange={(e) => setCondicion(e.target.value)}
          className={inputCls}
        >
          <option value="">Condición fiscal…</option>
          {CONDICIONES_FISCALES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputCls}
        />
        <input
          type="tel"
          placeholder="Teléfono"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          className={inputCls}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-2xl bg-tinta px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Guardar"}
        </button>
        <button
          type="button"
          onClick={() => setEditando(false)}
          className="rounded-2xl border border-borde px-4 py-2 text-sm text-piedra"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
