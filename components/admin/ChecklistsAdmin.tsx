"use client";

import { useState, useTransition } from "react";
import { ClipboardList, Pencil, Plus, Trash2 } from "lucide-react";
import {
  guardarChecklistPlantilla,
  borrarChecklistPlantilla,
} from "@/lib/actions";
import type { ChecklistPlantilla, Modelo } from "@/lib/types";

const inputCls =
  "w-full rounded-2xl border border-borde bg-white shadow-sm px-3 py-2.5 text-sm outline-none focus:border-tinta";

function Formulario({
  inicial,
  modelos,
  onListo,
}: {
  inicial?: ChecklistPlantilla | null;
  modelos: Modelo[];
  onListo: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [modeloId, setModeloId] = useState(inicial?.modelo_id ?? "");
  const [itemsTexto, setItemsTexto] = useState(
    (inicial?.items ?? []).join("\n")
  );
  const [error, setError] = useState<string | null>(null);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await guardarChecklistPlantilla({
        id: inicial?.id ?? null,
        nombre,
        modeloId: modeloId || null,
        items: itemsTexto.split("\n"),
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
        {inicial ? `Editar ${inicial.nombre}` : "Nueva checklist"}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          required
          placeholder="Nombre (ej: Mantenimiento GX22)"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className={inputCls}
        />
        <select
          value={modeloId}
          onChange={(e) => setModeloId(e.target.value)}
          className={inputCls}
        >
          <option value="">Elegir modelo…</option>
          {modelos.map((m) => (
            <option key={m.id} value={m.id}>
              {m.marca} {m.nombre}
            </option>
          ))}
        </select>
      </div>
      <div>
        <textarea
          required
          placeholder={"Un paso por línea, ej:\nRevisar cuchillas\nLimpiar filtro\nProbar en vacío"}
          value={itemsTexto}
          onChange={(e) => setItemsTexto(e.target.value)}
          rows={6}
          className={inputCls}
        />
        <p className="mt-1 text-xs text-piedra">
          Un paso por línea. Cuando se cree una orden para un equipo de ese
          modelo, el técnico va a ver estos pasos para tildar. Para listas de
          inspección tipo Rational: empezá una línea con <b>##&nbsp;</b> para un
          título de sección (los ítems pasan a responderse SÍ/NO con
          comentario) y con <b>=&nbsp;</b> para un campo de medición (ej:
          presión de agua). Esas listas se imprimen para el cliente desde la
          orden.
        </p>
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

export default function ChecklistsAdmin({
  plantillas,
  modelos,
}: {
  plantillas: ChecklistPlantilla[];
  modelos: Modelo[];
}) {
  const [pending, startTransition] = useTransition();
  const [editando, setEditando] = useState<ChecklistPlantilla | null>(null);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function borrar(id: string) {
    startTransition(async () => {
      const res = await borrarChecklistPlantilla(id);
      if (res && "error" in res && res.error) setError(res.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-piedra">
          Pasos de trabajo por modelo de equipo. Se copian a cada orden nueva
          para que el técnico no se saltee nada.
        </p>
        <button
          type="button"
          onClick={() => {
            setCreando(true);
            setEditando(null);
          }}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl bg-tinta px-4 py-2.5 text-sm font-medium text-white"
        >
          <Plus className="h-4 w-4" /> Nueva checklist
        </button>
      </div>

      {(creando || editando) && (
        <Formulario
          inicial={editando}
          modelos={modelos}
          onListo={() => {
            setCreando(false);
            setEditando(null);
          }}
        />
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="space-y-2">
        {plantillas.map((p) => (
          <div
            key={p.id}
            className="rounded-2xl border border-borde bg-white p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">
                <ClipboardList className="mr-1.5 -mt-0.5 inline h-4 w-4 text-piedra" />
                {p.nombre}
                {p.modelo && (
                  <span className="ml-2 rounded-full bg-celeste-soft px-2 py-0.5 text-xs font-normal text-sky-800">
                    {p.modelo.marca} {p.modelo.nombre}
                  </span>
                )}
              </p>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setEditando(p);
                    setCreando(false);
                  }}
                  className="inline-flex items-center gap-1 rounded-xl border border-borde px-3 py-1.5 text-xs text-piedra hover:bg-crema"
                >
                  <Pencil className="h-3 w-3" /> Editar
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => borrar(p.id)}
                  className="inline-flex items-center gap-1 rounded-xl border border-borde px-3 py-1.5 text-xs text-piedra hover:text-red-600"
                >
                  <Trash2 className="h-3 w-3" /> Borrar
                </button>
              </div>
            </div>
            <ol className="mt-2 list-inside list-decimal text-sm text-piedra">
              {p.items.map((it, i) => (
                <li key={i}>{it}</li>
              ))}
            </ol>
          </div>
        ))}
        {plantillas.length === 0 && !creando && (
          <p className="rounded-2xl border border-dashed border-borde p-8 text-center text-sm text-piedra">
            Sin checklists todavía. Creá la primera para un modelo.
          </p>
        )}
      </div>
    </div>
  );
}
