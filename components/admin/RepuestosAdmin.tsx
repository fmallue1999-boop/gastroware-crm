"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil } from "lucide-react";
import { guardarRepuesto } from "@/lib/actions";
import { dinero } from "@/lib/format";
import type { Repuesto } from "@/lib/types";

const inputCls =
  "w-full rounded-2xl border border-borde bg-white shadow-sm px-3 py-2.5 text-sm outline-none focus:border-tinta";

function Formulario({
  inicial,
  onListo,
}: {
  inicial?: Repuesto | null;
  onListo: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [codigo, setCodigo] = useState(inicial?.codigo_interno ?? "");
  const [descripcion, setDescripcion] = useState(inicial?.descripcion ?? "");
  const [marca, setMarca] = useState(inicial?.marca ?? "");
  const [costo, setCosto] = useState(
    inicial?.costo != null ? String(inicial.costo) : ""
  );
  const [precio, setPrecio] = useState(
    inicial?.precio != null ? String(inicial.precio) : ""
  );
  const [moneda, setMoneda] = useState(inicial?.moneda ?? "ARS");
  const [error, setError] = useState<string | null>(null);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await guardarRepuesto({
        id: inicial?.id ?? null,
        codigo_interno: codigo,
        descripcion,
        marca,
        costo: costo === "" ? null : Number(costo),
        precio: precio === "" ? null : Number(precio),
        moneda,
      });
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      onListo();
    });
  }

  return (
    <form
      onSubmit={enviar}
      className="space-y-3 rounded-2xl border border-borde bg-white p-4 shadow-sm"
    >
      <p className="text-sm font-semibold">
        {inicial ? `Editar ${inicial.descripcion}` : "Nuevo repuesto"}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          placeholder="Código interno"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          className={inputCls}
        />
        <input
          type="text"
          placeholder="Marca"
          value={marca}
          onChange={(e) => setMarca(e.target.value)}
          className={inputCls}
        />
      </div>
      <input
        type="text"
        required
        placeholder="Descripción (ej: Cuchilla GX22, Burlete tapa Zumex…)"
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
        className={inputCls}
      />
      <div className="grid grid-cols-3 gap-2">
        <input
          type="number"
          min={0}
          placeholder="Costo"
          value={costo}
          onChange={(e) => setCosto(e.target.value)}
          className={inputCls}
        />
        <input
          type="number"
          min={0}
          placeholder="Precio venta"
          value={precio}
          onChange={(e) => setPrecio(e.target.value)}
          className={inputCls}
        />
        <select
          value={moneda}
          onChange={(e) => setMoneda(e.target.value)}
          className={inputCls}
        >
          <option value="ARS">ARS</option>
          <option value="USD">USD</option>
        </select>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-2xl bg-tinta px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Guardar"}
        </button>
        <button
          type="button"
          onClick={onListo}
          className="rounded-2xl border border-borde px-4 py-2.5 text-sm text-piedra"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

export default function RepuestosAdmin({
  repuestos,
  q,
}: {
  repuestos: Repuesto[];
  q: string;
}) {
  const [editando, setEditando] = useState<Repuesto | null>(null);
  const [creando, setCreando] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <form method="get" className="flex flex-1 gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Buscar por descripción, código o marca"
            className={`${inputCls} max-w-sm`}
          />
          <button className="rounded-2xl border border-borde px-4 py-2.5 text-sm">
            Buscar
          </button>
        </form>
        <button
          type="button"
          onClick={() => {
            setCreando(true);
            setEditando(null);
          }}
          className="inline-flex items-center gap-1.5 rounded-2xl bg-tinta px-4 py-2.5 text-sm font-medium text-white"
        >
          <Plus className="h-4 w-4" /> Nuevo repuesto
        </button>
      </div>

      {(creando || editando) && (
        <Formulario
          inicial={editando}
          onListo={() => {
            setCreando(false);
            setEditando(null);
          }}
        />
      )}

      <div className="overflow-hidden rounded-2xl border border-borde bg-white shadow-sm">
        {repuestos.map((r) => (
          <div
            key={r.id}
            className="flex flex-wrap items-center gap-2 border-b border-borde/60 px-4 py-2.5 last:border-0"
          >
            <div className="min-w-44 flex-1">
              <p className="text-sm font-medium">{r.descripcion}</p>
              <p className="text-xs text-piedra">
                {r.codigo_interno ? `${r.codigo_interno} · ` : ""}
                {r.marca ?? ""}
              </p>
            </div>
            <span className="text-sm text-piedra">
              {r.precio != null ? dinero(r.precio, r.moneda) : "Sin precio"}
            </span>
            <button
              type="button"
              onClick={() => {
                setEditando(r);
                setCreando(false);
              }}
              className="inline-flex items-center gap-1 rounded-xl border border-borde px-3 py-1.5 text-xs text-piedra hover:bg-crema"
            >
              <Pencil className="h-3 w-3" /> Editar
            </button>
          </div>
        ))}
        {repuestos.length === 0 && (
          <p className="p-4 text-sm text-piedra">
            {q ? "Sin resultados para esa búsqueda." : "Todavía no hay repuestos cargados."}
          </p>
        )}
      </div>
    </div>
  );
}
