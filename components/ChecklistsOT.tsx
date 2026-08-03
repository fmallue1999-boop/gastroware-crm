"use client";

import { useState, useTransition } from "react";
import { ClipboardList } from "lucide-react";
import { responderChecklistOT } from "@/lib/actions";
import type { OTChecklist } from "@/lib/types";

function Checklist({
  checklist,
  editable,
}: {
  checklist: OTChecklist;
  editable: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [respuestas, setRespuestas] = useState<Record<string, boolean>>(
    checklist.respuestas ?? {}
  );
  const [error, setError] = useState<string | null>(null);

  const items = checklist.plantilla?.items ?? [];
  const hechas = items.filter((_, i) => respuestas[String(i)]).length;

  function marcar(i: number, valor: boolean) {
    const nuevas = { ...respuestas, [String(i)]: valor };
    setRespuestas(nuevas);
    setError(null);
    startTransition(async () => {
      const res = await responderChecklistOT(checklist.id, nuevas);
      if (res && "error" in res && res.error) setError(res.error);
    });
  }

  if (items.length === 0) return null;

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
          const hecho = !!respuestas[String(i)];
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
      {conItems.map((c) => (
        <Checklist key={c.id} checklist={c} editable={editable} />
      ))}
    </div>
  );
}
