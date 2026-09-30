import { Fragment } from "react";
import Link from "next/link";
import { Plus, Video } from "lucide-react";
import { TIPOS, conParams, cuentaDe, diaSemanaCorto, ordenarEnCelda, tipoDe } from "@/lib/contenidos";
import type { Contenido } from "@/lib/servidor/contenidos";
import { EstadoPastilla } from "@/components/contenidos/Indicadores";

/**
 * El calendario como cuadro de doble entrada (v1.10): columnas = días,
 * filas = HISTORIAS y FEED (siempre las dos). Cada ficha muestra su cuenta
 * (borde de color) y su propio estado (pastilla). Mes: compacto, clic en el
 * día lleva a esa semana. Semana: tarjetas con miniatura.
 */
export default function CalendarioContenidos({
  vista,
  dias,
  contenidos,
  hoy,
  params,
  miniaturas,
  puedeCargar,
}: {
  vista: "mes" | "semana";
  dias: string[];
  contenidos: Contenido[];
  hoy: string;
  params: Record<string, string | null>;
  miniaturas: Map<string, { url: string | null; video: boolean }>;
  puedeCargar: boolean;
}) {
  const base = "/contenidos";
  const celda = new Map<string, Contenido[]>();
  for (const c of contenidos) celda.set(`${c.fecha}|${c.tipo}`, [...(celda.get(`${c.fecha}|${c.tipo}`) ?? []), c]);
  const ancho = vista === "mes" ? 124 : 172;
  const abrir = (id: string) => conParams(base, params, { ficha: id, nueva: null, fecha: null, tipo: null });

  return (
    <div className="max-h-[calc(100dvh-15rem)] overflow-auto rounded-2xl border border-borde bg-white shadow-sm lg:max-h-[calc(100dvh-13rem)]">
      <div className="grid" style={{ gridTemplateColumns: `5.5rem repeat(${dias.length}, minmax(${ancho}px, 1fr))` }}>
        {/* Encabezado: esquina + días (fijo arriba) */}
        <div className="sticky left-0 top-0 z-30 border-b border-r border-borde bg-white" />
        {dias.map((d) => {
          const esHoy = d === hoy;
          const contenido = (
            <>
              <span className={`block text-[17px] font-extrabold leading-none ${esHoy ? "text-white" : ""}`}>{vista === "mes" ? Number(d.slice(8)) : `${d.slice(8)}/${d.slice(5, 7)}`}</span>
              <span className={`mt-0.5 block text-[11px] font-bold tracking-wide ${esHoy ? "text-white/80" : "text-piedra"}`}>{diaSemanaCorto(d)}</span>
            </>
          );
          const cls = `sticky top-0 z-20 flex flex-col items-center justify-center border-b border-r border-borde px-1 py-2 text-center ${esHoy ? "bg-marino" : "bg-white"}`;
          return vista === "mes" ? (
            <Link key={d} href={conParams(base, params, { vista: "semana", dia: d, ficha: null, nueva: null })} scroll={false} title="Ver esta semana" className={`${cls} hover:bg-crema ${esHoy ? "hover:bg-marino-2" : ""}`}>
              {contenido}
            </Link>
          ) : (
            <div key={d} className={cls}>
              {contenido}
            </div>
          );
        })}

        {/* Filas: HISTORIAS y FEED */}
        {TIPOS.map((t) => (
          <Fragment key={t.value}>
            <div className="sticky left-0 z-10 flex items-start border-b border-r border-borde bg-white px-2 py-3 text-[12px] font-extrabold tracking-wide">{t.fila}</div>
            {dias.map((d) => {
              const items = ordenarEnCelda(celda.get(`${d}|${t.value}`) ?? []);
              return (
                <div key={`${d}-${t.value}`} className={`group relative min-h-28 space-y-1.5 border-b border-r border-borde p-1.5 ${d === hoy ? "bg-celeste-soft/60" : ""}`}>
                  {items.map((c) =>
                    vista === "mes" ? (
                      <Link
                        key={c.id}
                        href={abrir(c.id)}
                        scroll={false}
                        title={c.nombre}
                        className={`block rounded-md border-l-4 ${cuentaDe(c.cuenta).borde} ${cuentaDe(c.cuenta).fondo} px-1.5 py-1 hover:brightness-95`}
                      >
                        <span className="block truncate text-[12px] font-bold leading-tight">{c.nombre}</span>
                        <span className="mt-0.5 block">
                          <EstadoPastilla estado={c.estado} corto />
                        </span>
                      </Link>
                    ) : (
                      <Link
                        key={c.id}
                        href={abrir(c.id)}
                        scroll={false}
                        title={c.nombre}
                        className={`block overflow-hidden rounded-lg border border-borde border-l-4 ${cuentaDe(c.cuenta).borde} bg-white shadow-sm hover:shadow`}
                      >
                        {miniaturas.get(c.id)?.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={miniaturas.get(c.id)!.url!} alt="" loading="lazy" className="h-20 w-full object-cover" />
                        ) : miniaturas.get(c.id)?.video ? (
                          <span className="flex h-12 items-center justify-center gap-1 bg-crema text-xs font-bold text-piedra">
                            <Video className="h-4 w-4" /> Video
                          </span>
                        ) : null}
                        <span className="block space-y-1 px-2 py-1.5">
                          <span className="block text-[11px] font-bold uppercase tracking-wide text-piedra">
                            {cuentaDe(c.cuenta).label} · {tipoDe(c.tipo).label}
                          </span>
                          <span className="block text-[13px] font-extrabold leading-tight">{c.nombre}</span>
                          <EstadoPastilla estado={c.estado} />
                        </span>
                      </Link>
                    )
                  )}
                  {puedeCargar && (
                    <Link
                      href={conParams(base, params, { nueva: "1", fecha: d, tipo: t.value, ficha: null })}
                      scroll={false}
                      aria-label={`Nuevo contenido: ${t.label} del ${d.slice(8)}/${d.slice(5, 7)}`}
                      className="flex h-7 w-full items-center justify-center rounded-md border border-dashed border-borde text-piedra opacity-60 hover:border-marino hover:text-marino hover:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
