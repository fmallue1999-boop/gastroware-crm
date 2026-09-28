"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { agendarProximo, guardarCalificacion, noRespondio } from "@/lib/actions";
import { sugerenciaPropuesta } from "@/lib/cadencia";
import { fechaCorta } from "@/lib/format";

const PLAZOS = ["Este mes", "1 a 3 meses", "Más de 3 meses", "Sin fecha"];

/**
 * Cadencia del manual para trabajar la consulta: después de la propuesta,
 * seguimiento a 1, 3 y 7 días, último intento a los 14 y recontacto a 30 y
 * 60. "No respondió" deja el intento y propone el siguiente. Nada se agenda
 * solo: un toque para confirmar.
 */
export function CadenciaInteres({
  interes,
  fechaPropuesta,
  hoy,
}: {
  interes: { id: string; etapa: string; proximo_contacto?: string | null };
  fechaPropuesta: string | null;
  hoy: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ texto: string; error?: boolean } | null>(null);
  const cotizada = ["cotizada", "seguimiento"].includes(interes.etapa);
  const sug = cotizada && fechaPropuesta ? sugerenciaPropuesta(fechaPropuesta, hoy) : null;
  const yaAgendada = sug && interes.proximo_contacto === sug.fecha;

  function correr(fn: () => Promise<{ error?: string; fecha?: string; nota?: string } | { ok: true }>, ok: (r: { fecha?: string; nota?: string }) => string) {
    setMsg(null);
    startTransition(async () => {
      const r = (await fn()) as { error?: string; fecha?: string; nota?: string };
      if (r?.error) setMsg({ texto: r.error, error: true });
      else {
        setMsg({ texto: ok(r) });
        router.refresh();
      }
    });
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {sug && !yaAgendada && (
        <button
          type="button"
          disabled={pending}
          onClick={() => correr(() => agendarProximo(interes.id, sug.fecha, sug.nota), () => "Agendado")}
          className="min-h-10 rounded-xl border border-marino bg-white px-3 text-[14px] font-bold text-marino disabled:opacity-50"
        >
          {sug.nota} · {fechaCorta(sug.fecha)}
        </button>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => correr(() => noRespondio(interes.id), (r) => `Intento anotado. Próximo: ${r.fecha ? fechaCorta(r.fecha) : ""}`)}
        className="min-h-10 rounded-xl border border-borde bg-white px-3 text-[14px] font-bold text-tinta disabled:opacity-50"
      >
        No respondió
      </button>
      {msg && <span className={`text-[14px] font-bold ${msg.error ? "text-red-600" : "text-verde"}`}>{msg.texto}</span>}
    </div>
  );
}

/** Calificación (manual 1.1 paso 3): cantidad, plazo de compra y quién decide. */
export function CalificacionInteres({
  interes,
}: {
  interes: { id: string; cantidad?: number | null; plazo_compra?: string | null; decisor?: string | null };
}) {
  const [pending, startTransition] = useTransition();
  const [cantidad, setCantidad] = useState(interes.cantidad != null ? String(interes.cantidad) : "");
  const [plazo, setPlazo] = useState(interes.plazo_compra ?? "");
  const [decisor, setDecisor] = useState(interes.decisor ?? "");
  const [msg, setMsg] = useState<{ texto: string; error?: boolean } | null>(null);
  const cls = "min-h-11 w-full rounded-xl border border-borde bg-white px-3 text-[15px] outline-none focus:border-marino";
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        startTransition(async () => {
          const r = await guardarCalificacion(interes.id, {
            cantidad: cantidad ? Number(cantidad) : null,
            plazo,
            decisor,
          });
          setMsg(r && "error" in r && r.error ? { texto: r.error, error: true } : { texto: "Guardado" });
        });
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <input type="number" min={1} value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="Cantidad" className={cls} />
        <select value={plazo} onChange={(e) => setPlazo(e.target.value)} aria-label="Plazo de compra" className={cls}>
          <option value="">¿Cuándo compra?</option>
          {PLAZOS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <input value={decisor} onChange={(e) => setDecisor(e.target.value)} placeholder="¿Quién decide la compra?" className={cls} />
      <div className="flex items-center gap-2">
        <button disabled={pending} className="min-h-11 rounded-xl border border-marino px-4 text-[15px] font-bold disabled:opacity-50">
          Guardar calificación
        </button>
        {msg && <span className={`text-[14px] font-bold ${msg.error ? "text-red-600" : "text-verde"}`}>{msg.texto}</span>}
      </div>
    </form>
  );
}
