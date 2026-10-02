"use client";

import { useState, useTransition } from "react";
import { Pencil, Phone, Plus } from "lucide-react";
import { guardarAliado } from "@/lib/actions";
import { telefonoProlijo } from "@/lib/format";

export type Aliado = {
  id: string;
  nombre: string;
  zona: string | null;
  telefono: string | null;
  email: string | null;
  tarifa: string | null;
  notas: string | null;
  activo: boolean;
};

const inputCls =
  "min-h-11 w-full rounded-xl border border-borde bg-white px-3 py-2 text-[15px] outline-none focus:border-marino";

function Formulario({ inicial, onListo }: { inicial?: Aliado | null; onListo: () => void }) {
  const [pending, startTransition] = useTransition();
  const [f, setF] = useState({
    nombre: inicial?.nombre ?? "",
    zona: inicial?.zona ?? "",
    telefono: inicial?.telefono ?? "",
    email: inicial?.email ?? "",
    tarifa: inicial?.tarifa ?? "",
    notas: inicial?.notas ?? "",
    activo: inicial?.activo ?? true,
  });
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-2 rounded-2xl border border-borde bg-white p-4 shadow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const r = await guardarAliado({ id: inicial?.id ?? null, ...f });
          if (r && "error" in r && r.error) setError(r.error);
          else onListo();
        });
      }}
    >
      <p className="text-[15px] font-extrabold">{inicial ? `Editar ${inicial.nombre}` : "Nuevo técnico aliado"}</p>
      <input required value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} placeholder="Nombre o empresa" className={inputCls} />
      <input value={f.zona} onChange={(e) => setF({ ...f, zona: e.target.value })} placeholder="Zona que cubre (ej: CABA y zona norte)" className={inputCls} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} placeholder="Teléfono" className={inputCls} />
        <input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="Email" className={inputCls} />
      </div>
      <input value={f.tarifa} onChange={(e) => setF({ ...f, tarifa: e.target.value })} placeholder="Tarifa acordada (ej: $30.000 la visita + $20.000 la hora)" className={inputCls} />
      <textarea value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} placeholder="Notas (marcas que conoce, disponibilidad…)" className={`${inputCls} min-h-20`} />
      <label className="flex min-h-11 items-center gap-2 text-[15px] font-bold">
        <input type="checkbox" checked={f.activo} onChange={(e) => setF({ ...f, activo: e.target.checked })} className="h-5 w-5" />
        Activo (se le pueden asignar trabajos)
      </label>
      {error && <p className="text-[14px] font-bold text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button disabled={pending} className="min-h-11 rounded-xl bg-marino px-4 text-[15px] font-extrabold text-white disabled:opacity-50">
          {pending ? "Guardando…" : "Guardar"}
        </button>
        <button type="button" onClick={onListo} className="min-h-11 rounded-xl border border-borde px-4 text-[15px] text-piedra">
          Cancelar
        </button>
      </div>
    </form>
  );
}

/** Técnicos aliados (terceros sin usuario): se asignan a trabajos fuera de la zona del técnico propio. */
export default function AliadosAdmin({ aliados, puedeEditar }: { aliados: Aliado[]; puedeEditar: boolean }) {
  const [editando, setEditando] = useState<Aliado | "nuevo" | null>(null);
  return (
    <div className="space-y-3">
      {aliados.length === 0 && (
        <p className="rounded-2xl border border-dashed border-borde p-6 text-center text-[15px] text-piedra">
          Todavía no hay técnicos aliados cargados.
        </p>
      )}
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        {aliados.map((a) =>
          editando !== "nuevo" && editando?.id === a.id ? (
            <Formulario key={a.id} inicial={a} onListo={() => setEditando(null)} />
          ) : (
            <div key={a.id} className={`rounded-2xl bg-white p-4 shadow-sm ${a.activo ? "" : "opacity-60"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[16px] font-extrabold">
                    {a.nombre} {!a.activo && <span className="text-xs font-bold text-piedra">(inactivo)</span>}
                  </p>
                  {a.zona && <p className="text-[14px] text-tinta/80">Zona: {a.zona}</p>}
                  {a.tarifa && <p className="text-[14px] text-tinta/80">Tarifa: {a.tarifa}</p>}
                  {a.notas && <p className="text-xs text-piedra">{a.notas}</p>}
                </div>
                {puedeEditar && (
                  <button type="button" onClick={() => setEditando(a)} aria-label={`Editar ${a.nombre}`} className="rounded-lg p-2 text-piedra hover:bg-crema">
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
              </div>
              {a.telefono && (
                <a href={`tel:${a.telefono}`} className="mt-1 inline-flex items-center gap-1 text-[14px] font-bold text-marino">
                  <Phone className="h-4 w-4" /> {telefonoProlijo(a.telefono)}
                </a>
              )}
            </div>
          )
        )}
      </div>
      {puedeEditar &&
        (editando === "nuevo" ? (
          <Formulario onListo={() => setEditando(null)} />
        ) : (
          <button
            type="button"
            onClick={() => setEditando("nuevo")}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-marino px-4 text-[15px] font-extrabold text-white"
          >
            <Plus className="h-4 w-4" /> Nuevo aliado
          </button>
        ))}
    </div>
  );
}
