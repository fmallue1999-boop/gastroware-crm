"use client";

import { useState, useTransition } from "react";
import { MapPin, Plus } from "lucide-react";
import { crearSucursal } from "@/lib/actions";
import type { Sucursal } from "@/lib/types";

const inputCls =
  "w-full rounded-2xl border border-borde bg-white shadow-sm px-3 py-2.5 text-sm outline-none focus:border-tinta";

export default function SucursalesCliente({
  clienteId,
  sucursales,
}: {
  clienteId: string;
  sucursales: Sucursal[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [pending, startTransition] = useTransition();
  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [provincia, setProvincia] = useState("");
  const [telefono, setTelefono] = useState("");
  const [error, setError] = useState<string | null>(null);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await crearSucursal({
        clienteId,
        nombre,
        direccion,
        ciudad,
        provincia,
        telefono,
      });
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      setAbierto(false);
      setNombre("");
      setDireccion("");
      setCiudad("");
      setProvincia("");
      setTelefono("");
    });
  }

  return (
    <section className="rounded-2xl border border-borde bg-white shadow-sm p-4">
      <h2 className="mb-2 text-sm font-semibold">Sucursales</h2>
      <div className="space-y-1.5">
        {sucursales.map((s) => (
          <p key={s.id} className="text-sm">
            <MapPin className="mr-1 -mt-0.5 inline h-3.5 w-3.5 text-piedra" />
            <span className="font-medium">{s.nombre}</span>
            {s.es_principal && (
              <span className="ml-1.5 rounded-full bg-celeste-soft px-2 py-0.5 text-xs text-sky-800">
                principal
              </span>
            )}
            <span className="text-piedra">
              {s.direccion ? ` · ${s.direccion}` : ""}
              {s.ciudad ? ` · ${s.ciudad}` : ""}
              {s.provincia ? `, ${s.provincia}` : ""}
              {s.telefono ? ` · ${s.telefono}` : ""}
            </span>
          </p>
        ))}
        {sucursales.length === 0 && (
          <p className="text-sm text-piedra/80">Sin sucursales cargadas.</p>
        )}
      </div>

      {!abierto ? (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="mt-2 inline-flex items-center gap-1 text-sm text-sky-700"
        >
          <Plus className="h-3.5 w-3.5" /> Agregar sucursal
        </button>
      ) : (
        <form onSubmit={enviar} className="mt-3 space-y-2">
          <input
            type="text"
            required
            placeholder="Nombre (ej: Casa central, Local Palermo)"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className={inputCls}
          />
          <input
            type="text"
            placeholder="Dirección"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            className={inputCls}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Ciudad"
              value={ciudad}
              onChange={(e) => setCiudad(e.target.value)}
              className={inputCls}
            />
            <input
              type="text"
              placeholder="Provincia"
              value={provincia}
              onChange={(e) => setProvincia(e.target.value)}
              className={inputCls}
            />
          </div>
          <input
            type="tel"
            placeholder="Teléfono (opcional)"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            className={inputCls}
          />
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
              onClick={() => setAbierto(false)}
              className="rounded-2xl border border-borde px-4 py-2 text-sm text-piedra"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
