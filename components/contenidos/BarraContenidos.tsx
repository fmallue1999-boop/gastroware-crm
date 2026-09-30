import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, List, Plus } from "lucide-react";
import { ESTADOS, FILTROS_CUENTA, conParams, estadoDe } from "@/lib/contenidos";

const chip = (on: boolean) =>
  `inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13px] font-bold ${
    on ? "bg-marino text-white" : "border border-borde bg-white text-tinta hover:bg-crema"
  }`;

/** Arriba de las dos vistas: Calendario | Fichas de contenido y "+ Nuevo contenido". */
export function PestanasContenidos({ actual, params, puedeCargar }: { actual: "calendario" | "fichas"; params: Record<string, string | null>; puedeCargar: boolean }) {
  const base = actual === "calendario" ? "/contenidos" : "/contenidos/fichas";
  // Se conservan los filtros de cuenta y estado al pasar de una vista a la otra
  const filtros = { cuenta: params.cuenta, estado: params.estado };
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex gap-1 rounded-2xl border border-borde bg-white p-1 shadow-sm">
        <Link href={conParams("/contenidos", filtros, {})} className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3.5 text-[14px] font-bold ${actual === "calendario" ? "bg-marino text-white" : "text-piedra"}`}>
          <CalendarDays className="h-4 w-4" /> Calendario
        </Link>
        <Link href={conParams("/contenidos/fichas", filtros, {})} className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3.5 text-[14px] font-bold ${actual === "fichas" ? "bg-marino text-white" : "text-piedra"}`}>
          <List className="h-4 w-4" /> Fichas de contenido
        </Link>
      </div>
      {puedeCargar && (
        <Link href={conParams(base, params, { nueva: "1", ficha: null })} scroll={false} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-verde px-4 text-[15px] font-extrabold text-white">
          <Plus className="h-4 w-4" /> Nuevo contenido
        </Link>
      )}
    </div>
  );
}

/** Filtros combinables (cuenta Y estado); cambian solo lo que se ve. */
export function FiltrosContenidos({ base, params, conTipo = false }: { base: string; params: Record<string, string | null>; conTipo?: boolean }) {
  const cuenta = params.cuenta ?? "todas";
  const estado = params.estado ?? "todos";
  const tipo = params.tipo_filtro ?? "todos";
  const link = (cambios: Record<string, string | null>) => conParams(base, params, { ...cambios, ficha: null, nueva: null });
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
        <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-piedra">Cuenta</span>
        {FILTROS_CUENTA.map((f) => (
          <Link key={f.value} href={link({ cuenta: f.value === "todas" ? null : f.value })} scroll={false} className={chip(cuenta === f.value)}>
            {f.label}
          </Link>
        ))}
      </div>
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
        <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-piedra">Estado</span>
        <Link href={link({ estado: null })} scroll={false} className={chip(estado === "todos")}>
          Todos
        </Link>
        {ESTADOS.map((e) => (
          <Link key={e.value} href={link({ estado: e.value })} scroll={false} className={chip(estado === e.value)}>
            <span className={`h-2 w-2 rounded-full ${estadoDe(e.value).punto}`} /> {e.label}
          </Link>
        ))}
      </div>
      {conTipo && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
          <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-piedra">Tipo</span>
          {[
            { v: "todos", l: "Todos" },
            { v: "historia", l: "Historias" },
            { v: "feed", l: "Feed" },
          ].map((t) => (
            <Link key={t.v} href={link({ tipo_filtro: t.v === "todos" ? null : t.v })} scroll={false} className={chip(tipo === t.v)}>
              {t.l}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** Anterior / Hoy / Siguiente y MES | SEMANA. */
export function NavegacionCalendario({
  vista,
  titulo,
  anterior,
  siguiente,
  hoy,
  params,
}: {
  vista: "mes" | "semana";
  titulo: string;
  anterior: string;
  siguiente: string;
  hoy: string;
  params: Record<string, string | null>;
}) {
  const base = "/contenidos";
  const link = (cambios: Record<string, string | null>) => conParams(base, params, { ...cambios, ficha: null, nueva: null });
  const boton = "inline-flex min-h-10 items-center gap-1 rounded-xl border border-borde bg-white px-3 text-[14px] font-bold hover:bg-crema";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5">
        <Link href={link({ dia: anterior })} scroll={false} className={boton} aria-label={vista === "mes" ? "Mes anterior" : "Semana anterior"}>
          <ChevronLeft className="h-4 w-4" /> <span className="hidden sm:inline">{vista === "mes" ? "Mes anterior" : "Semana anterior"}</span>
        </Link>
        <Link href={link({ dia: hoy })} scroll={false} className={boton}>
          Hoy
        </Link>
        <Link href={link({ dia: siguiente })} scroll={false} className={boton} aria-label={vista === "mes" ? "Mes siguiente" : "Semana siguiente"}>
          <span className="hidden sm:inline">{vista === "mes" ? "Mes siguiente" : "Semana siguiente"}</span> <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
      <h2 className="min-w-0 flex-1 text-xl font-extrabold capitalize tracking-tight">{titulo}</h2>
      <div className="flex gap-1 rounded-xl border border-borde bg-white p-1">
        {(["mes", "semana"] as const).map((v) => (
          <Link
            key={v}
            href={link({ vista: v === "mes" ? null : "semana" })}
            scroll={false}
            className={`inline-flex min-h-8 items-center rounded-lg px-3 text-[13px] font-extrabold tracking-wide ${vista === v ? "bg-marino text-white" : "text-piedra"}`}
          >
            {v === "mes" ? "MES" : "SEMANA"}
          </Link>
        ))}
      </div>
    </div>
  );
}
