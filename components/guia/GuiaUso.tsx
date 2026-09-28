"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, ChevronDown, Lightbulb, Search, ShieldCheck } from "lucide-react";
import { BASICOS, GUIA_PUESTOS, REGLAS_MANUAL, TAREAS, tareaPorId, type Tarea } from "@/lib/guia";
import { PUESTOS, type Puesto } from "@/lib/puestos";

const sinAcentos = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

function TareaDesplegable({ t, abierta }: { t: Tarea; abierta: boolean }) {
  return (
    <details id={`tarea-${t.id}`} open={abierta} className="group scroll-mt-24 rounded-2xl bg-white shadow-sm">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-[16px] font-extrabold [&::-webkit-details-marker]:hidden">
        {t.titulo}
        <ChevronDown className="h-5 w-5 shrink-0 text-piedra transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-3 px-4 pb-4">
        <ol className="space-y-2.5">
          {t.pasos.map((p, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-marino text-[13px] font-extrabold text-white">
                {i + 1}
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-[15px] leading-snug">{p.texto}</p>
                {p.href && (
                  <Link
                    href={p.href}
                    className="mt-1.5 inline-flex min-h-10 items-center gap-1 rounded-xl border border-marino px-3 text-[14px] font-bold text-marino hover:bg-celeste-soft"
                  >
                    {p.boton ?? "Ir"} <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ol>
        {t.ojo && (
          <p className="flex gap-2 rounded-xl bg-ambar-soft px-3 py-2 text-[14px] text-tinta">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-ambar" />
            {t.ojo}
          </p>
        )}
      </div>
    </details>
  );
}

/**
 * La guía de uso dentro del CRM: tu puesto primero (qué ves al abrir y qué
 * hacés cada día), cómo se hace cada cosa paso a paso con el botón para ir
 * a la pantalla, lo básico para todos y las reglas del manual.
 */
export default function GuiaUso({ rol, tareaInicial }: { rol: string; tareaInicial?: string | null }) {
  const propio = (PUESTOS.some((p) => p.value === rol) ? rol : "comercial") as Puesto;
  const [puesto, setPuesto] = useState<Puesto>(propio);
  const [q, setQ] = useState("");
  const guia = GUIA_PUESTOS[puesto];

  useEffect(() => {
    if (!tareaInicial) return;
    document.getElementById(`tarea-${tareaInicial}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [tareaInicial]);

  const resultados = useMemo(() => {
    const b = sinAcentos(q.trim());
    if (b.length < 2) return null;
    return [...BASICOS, ...TAREAS].filter((t) => sinAcentos([t.titulo, t.ojo ?? "", ...t.pasos.map((p) => p.texto)].join(" ")).includes(b));
  }, [q]);

  const tareas = guia.tareas.map(tareaPorId).filter((t): t is Tarea => Boolean(t));
  // Si la tarea pedida por link no es del puesto elegido, se muestra igual arriba
  const extra = tareaInicial && !guia.tareas.includes(tareaInicial) ? tareaPorId(tareaInicial) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <BookOpen className="h-6 w-6 text-marino" /> Guía de uso
        </h1>
        <p className="text-[15px] text-piedra">Cómo se trabaja en el CRM según tu puesto. Cada paso tiene el botón para ir a la pantalla.</p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-piedra" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="¿Qué querés hacer? (ej: facturar, remito, caso, informe)"
          className="min-h-12 w-full rounded-2xl border border-borde bg-white py-2 pl-10 pr-3 text-[16px] shadow-sm outline-none focus:border-marino"
        />
      </div>

      {resultados ? (
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wide text-piedra">
            {resultados.length ? `${resultados.length} resultado${resultados.length === 1 ? "" : "s"}` : "No encontré nada con esas palabras"}
          </h2>
          {resultados.map((t) => (
            <TareaDesplegable key={t.id} t={t} abierta={resultados.length <= 3} />
          ))}
        </section>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {PUESTOS.filter((p) => p.value !== "distribuidor").map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPuesto(p.value)}
                className={`min-h-10 rounded-full px-3.5 text-[14px] font-bold ${
                  puesto === p.value ? "bg-marino text-white" : "border border-borde bg-white text-piedra"
                }`}
              >
                {p.label}
                {p.value === propio ? " (vos)" : ""}
              </button>
            ))}
          </div>

          <section className="rounded-2xl bg-marino p-5 text-white shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-white/60">{puesto === propio ? "Tu puesto" : "Puesto"}</p>
            <h2 className="text-xl font-extrabold">{guia.titulo}</h2>
            <p className="mt-1 text-[15px] text-white/85">{guia.resumen}</p>
            <p className="mt-3 text-[14px] text-white/70">
              Al entrar ves:{" "}
              <Link href={guia.abreEn.href} className="font-bold text-white underline">
                {guia.abreEn.texto}
              </Link>
            </p>
            <h3 className="mt-4 text-xs font-bold uppercase tracking-wide text-white/60">Cada día</h3>
            <ul className="mt-1.5 space-y-1.5">
              {guia.cadaDia.map((c) => (
                <li key={c} className="flex gap-2 text-[15px]">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#6fc3e2]" />
                  {c}
                </li>
              ))}
            </ul>
          </section>

          {extra && (
            <section className="space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-wide text-piedra">Lo que buscabas</h2>
              <TareaDesplegable t={extra} abierta />
            </section>
          )}

          <section className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wide text-piedra">Paso a paso</h2>
            {tareas.map((t) => (
              <TareaDesplegable key={t.id} t={t} abierta={t.id === tareaInicial} />
            ))}
          </section>

          <section className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wide text-piedra">Lo básico, para todos</h2>
            {BASICOS.map((t) => (
              <TareaDesplegable key={t.id} t={t} abierta={t.id === tareaInicial} />
            ))}
          </section>

          <section className="space-y-2">
            <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-piedra">
              <ShieldCheck className="h-4 w-4" /> Las reglas del manual y cómo las cuida el CRM
            </h2>
            <div className="divide-y divide-borde/60 rounded-2xl bg-white shadow-sm">
              {REGLAS_MANUAL.map((r) => (
                <div key={r.regla} className="px-4 py-3">
                  <p className="text-[15px] font-bold">{r.regla}</p>
                  <p className="text-[14px] text-piedra">{r.como}</p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
