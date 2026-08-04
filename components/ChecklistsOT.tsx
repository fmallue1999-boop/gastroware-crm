"use client";

import { useState, useTransition } from "react";
import { ClipboardList, MessageSquarePlus } from "lucide-react";
import { responderChecklistOT } from "@/lib/actions";
import {
  esInspeccion,
  parseItemChecklist,
  respuestaObj,
  type RespuestaChecklist,
} from "@/lib/checklist";
import type { OTChecklist } from "@/lib/types";

type Respuestas = Record<string, RespuestaChecklist>;

/** Checklist simple: pasos que se tildan. */
function ChecklistSimple({
  checklist,
  editable,
}: {
  checklist: OTChecklist;
  editable: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [respuestas, setRespuestas] = useState<Respuestas>(
    checklist.respuestas ?? {}
  );
  const [error, setError] = useState<string | null>(null);

  const items = checklist.plantilla?.items ?? [];
  const hechas = items.filter((_, i) => respuestas[String(i)] === true).length;

  function marcar(i: number, valor: boolean) {
    const nuevas = { ...respuestas, [String(i)]: valor };
    setRespuestas(nuevas);
    setError(null);
    startTransition(async () => {
      const res = await responderChecklistOT(checklist.id, nuevas);
      if (res && "error" in res && res.error) setError(res.error);
    });
  }

  return (
    <div className="rounded-2xl border border-borde bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold">
          <ClipboardList className="mr-1.5 -mt-0.5 inline h-4 w-4 text-piedra" />
          {checklist.plantilla?.nombre ?? "Checklist"}
        </p>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            hechas === items.length
              ? "bg-green-100 text-green-700"
              : "bg-crema-deep text-piedra"
          }`}
        >
          {hechas}/{items.length}
        </span>
      </div>
      <div className="space-y-1.5">
        {items.map((item, i) => {
          const hecho = respuestas[String(i)] === true;
          return (
            <label
              key={i}
              className={`flex items-start gap-2.5 rounded-xl px-2 py-1.5 text-sm ${
                editable ? "cursor-pointer hover:bg-crema/60" : ""
              }`}
            >
              <input
                type="checkbox"
                checked={hecho}
                disabled={!editable || pending}
                onChange={(e) => marcar(i, e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-tinta"
              />
              <span className={hecho ? "text-piedra line-through" : ""}>
                {item}
              </span>
            </label>
          );
        })}
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

/** Lista de inspección: secciones, ítems SÍ/NO con comentario y mediciones. */
function ChecklistInspeccion({
  checklist,
  editable,
}: {
  checklist: OTChecklist;
  editable: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [respuestas, setRespuestas] = useState<Respuestas>(
    checklist.respuestas ?? {}
  );
  const [comentarioAbierto, setComentarioAbierto] = useState<number | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const items = (checklist.plantilla?.items ?? []).map(parseItemChecklist);
  const respondibles = items.filter((it) => it.tipo !== "seccion").length;
  const respondidas = items.filter((it, i) => {
    if (it.tipo === "seccion") return false;
    const r = respuestaObj(respuestas[String(i)]);
    return it.tipo === "medicion" ? !!r.v?.trim() : !!r.r;
  }).length;

  function guardar(nuevas: Respuestas) {
    setRespuestas(nuevas);
    setError(null);
    startTransition(async () => {
      const res = await responderChecklistOT(checklist.id, nuevas);
      if (res && "error" in res && res.error) setError(res.error);
    });
  }

  function responder(i: number, r: "si" | "no") {
    const actual = respuestaObj(respuestas[String(i)]);
    guardar({
      ...respuestas,
      // Tocar de nuevo la misma opción la des-marca
      [String(i)]: { ...actual, r: actual.r === r ? undefined : r },
    });
  }

  function comentar(i: number, c: string) {
    const actual = respuestaObj(respuestas[String(i)]);
    guardar({ ...respuestas, [String(i)]: { ...actual, c: c || undefined } });
  }

  function medir(i: number, v: string) {
    guardar({ ...respuestas, [String(i)]: { v: v || undefined } });
  }

  return (
    <div className="rounded-2xl border border-borde bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold">
          <ClipboardList className="mr-1.5 -mt-0.5 inline h-4 w-4 text-piedra" />
          {checklist.plantilla?.nombre ?? "Inspección"}
        </p>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            respondidas === respondibles
              ? "bg-green-100 text-green-700"
              : "bg-crema-deep text-piedra"
          }`}
        >
          {respondidas}/{respondibles}
        </span>
      </div>

      <div className="space-y-1">
        {items.map((item, i) => {
          if (item.tipo === "seccion")
            return (
              <p
                key={i}
                className="mt-3 border-b border-borde pb-1 text-xs font-bold uppercase tracking-wide text-piedra first:mt-0"
              >
                {item.texto}
              </p>
            );

          const r = respuestaObj(respuestas[String(i)]);

          if (item.tipo === "medicion")
            return (
              <div key={i} className="flex items-center gap-2 py-1 text-sm">
                <span className="min-w-0 flex-1">{item.texto}</span>
                <input
                  type="text"
                  defaultValue={r.v ?? ""}
                  disabled={!editable || pending}
                  onBlur={(e) => {
                    if (e.target.value !== (r.v ?? "")) medir(i, e.target.value);
                  }}
                  placeholder="valor…"
                  className="w-28 shrink-0 rounded-lg border border-borde px-2 py-1 text-sm outline-none focus:border-tinta"
                />
              </div>
            );

          return (
            <div key={i} className="py-1">
              <div className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1">{item.texto}</span>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    disabled={!editable || pending}
                    onClick={() => responder(i, "si")}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                      r.r === "si"
                        ? "bg-green-600 text-white"
                        : "border border-borde text-piedra"
                    }`}
                  >
                    SÍ
                  </button>
                  <button
                    type="button"
                    disabled={!editable || pending}
                    onClick={() => responder(i, "no")}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                      r.r === "no"
                        ? "bg-red-600 text-white"
                        : "border border-borde text-piedra"
                    }`}
                  >
                    NO
                  </button>
                  <button
                    type="button"
                    disabled={!editable || pending}
                    onClick={() =>
                      setComentarioAbierto(comentarioAbierto === i ? null : i)
                    }
                    title="Comentario"
                    className={`rounded-lg border px-2 py-1 ${
                      r.c
                        ? "border-amber-400 bg-amber-50 text-amber-700"
                        : "border-borde text-piedra"
                    }`}
                  >
                    <MessageSquarePlus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {(comentarioAbierto === i || (r.c && !editable)) && (
                <input
                  type="text"
                  defaultValue={r.c ?? ""}
                  disabled={!editable || pending}
                  onBlur={(e) => {
                    if (e.target.value !== (r.c ?? ""))
                      comentar(i, e.target.value);
                  }}
                  placeholder="Comentario…"
                  className="mt-1 w-full rounded-lg border border-borde px-2 py-1 text-sm outline-none focus:border-tinta"
                />
              )}
              {r.c && comentarioAbierto !== i && (
                <p className="mt-0.5 text-xs text-amber-700">💬 {r.c}</p>
              )}
            </div>
          );
        })}
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

export default function ChecklistsOT({
  checklists,
  editable,
}: {
  checklists: OTChecklist[];
  editable: boolean;
}) {
  const conItems = checklists.filter(
    (c) => (c.plantilla?.items ?? []).length > 0
  );
  if (conItems.length === 0) return null;
  return (
    <div className="space-y-3">
      {conItems.map((c) =>
        esInspeccion(c.plantilla?.items ?? []) ? (
          <ChecklistInspeccion key={c.id} checklist={c} editable={editable} />
        ) : (
          <ChecklistSimple key={c.id} checklist={c} editable={editable} />
        )
      )}
    </div>
  );
}
