"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { actualizarEquipo } from "@/lib/actions";
import type { Equipo, Sucursal } from "@/lib/types";

const inputCls =
  "w-full rounded-2xl border border-borde bg-white shadow-sm px-3 py-2.5 text-sm outline-none focus:border-tinta";

export default function EquipoEditForm({
  equipo,
  sucursales,
}: {
  equipo: Equipo;
  sucursales: Sucursal[];
}) {
  const [editando, setEditando] = useState(false);
  const [pending, startTransition] = useTransition();
  const [serie, setSerie] = useState(equipo.numero_serie ?? "");
  const [estado, setEstado] = useState(equipo.estado);
  const [sucursalId, setSucursalId] = useState(equipo.sucursal_id ?? "");
  const [instalacion, setInstalacion] = useState(equipo.fecha_instalacion ?? "");
  const [proximoService, setProximoService] = useState(
    equipo.proximo_service ?? ""
  );
  const [observaciones, setObservaciones] = useState(equipo.observaciones ?? "");
  const [error, setError] = useState<string | null>(null);

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await actualizarEquipo(equipo.id, {
        numero_serie: serie,
        estado,
        sucursal_id: sucursalId || null,
        fecha_instalacion: instalacion || null,
        proximo_service: proximoService || null,
        observaciones,
      });
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      setEditando(false);
    });
  }

  if (!editando) {
    return (
      <button
        type="button"
        onClick={() => setEditando(true)}
        className="inline-flex items-center gap-1 rounded-xl border border-borde px-3 py-1.5 text-xs text-piedra hover:bg-crema"
      >
        <Pencil className="h-3 w-3" /> Editar datos
      </button>
    );
  }

  return (
    <form
      onSubmit={guardar}
      className="mt-2 space-y-2.5 rounded-2xl border border-borde bg-crema/50 p-4"
    >
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-piedra">
          Número de serie
          <input
            type="text"
            value={serie}
            onChange={(e) => setSerie(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="text-xs text-piedra">
          Estado
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value as Equipo["estado"])}
            className={inputCls}
          >
            <option value="activo">Activo</option>
            <option value="en_reparacion">En reparación</option>
            <option value="baja">De baja</option>
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-piedra">
          Fecha de instalación
          <input
            type="date"
            value={instalacion}
            onChange={(e) => setInstalacion(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="text-xs text-piedra">
          Próximo service
          <input
            type="date"
            value={proximoService}
            onChange={(e) => setProximoService(e.target.value)}
            className={inputCls}
          />
        </label>
      </div>
      {sucursales.length > 0 && (
        <label className="block text-xs text-piedra">
          Sucursal donde está
          <select
            value={sucursalId}
            onChange={(e) => setSucursalId(e.target.value)}
            className={inputCls}
          >
            <option value="">Sin especificar</option>
            {sucursales.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
                {s.ciudad ? ` (${s.ciudad})` : ""}
              </option>
            ))}
          </select>
        </label>
      )}
      <textarea
        placeholder="Observaciones (ubicación exacta, accesorios, estado general…)"
        value={observaciones}
        onChange={(e) => setObservaciones(e.target.value)}
        rows={2}
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
          onClick={() => setEditando(false)}
          className="rounded-2xl border border-borde px-4 py-2 text-sm text-piedra"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
