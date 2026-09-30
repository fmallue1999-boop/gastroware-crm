import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { hoyISO } from "@/lib/format";
import { conParams, cuentaDe, esEstado, esTipo, fechaDMY, tipoDe } from "@/lib/contenidos";
import { accesoContenidos, contenidosListado } from "@/lib/servidor/contenidos";
import PanelContenido from "@/components/contenidos/PanelContenido";
import { FiltrosContenidos, PestanasContenidos } from "@/components/contenidos/BarraContenidos";
import { EstadoPastilla } from "@/components/contenidos/Indicadores";

type Busqueda = { q?: string; orden?: string; cuenta?: string; estado?: string; tipo_filtro?: string; ficha?: string; nueva?: string; fecha?: string; tipo?: string };

/** Fichas de contenido (v1.10): el listado, con búsqueda, orden por fecha y filtros. */
export default async function FichasContenidoPage({ searchParams }: { searchParams: Promise<Busqueda> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const acceso = await accesoContenidos(supabase);
  if (!acceso.ve) redirect("/");

  const params: Record<string, string | null> = {
    q: sp.q?.trim() || null,
    orden: sp.orden === "desc" ? "desc" : null,
    cuenta: sp.cuenta === "gastroware" || sp.cuenta === "zumex" ? sp.cuenta : null,
    estado: esEstado(sp.estado) ? sp.estado : null,
    tipo_filtro: esTipo(sp.tipo_filtro) ? sp.tipo_filtro : null,
    ficha: sp.ficha ?? null,
    nueva: sp.nueva === "1" ? "1" : null,
    fecha: sp.fecha ?? null,
    tipo: sp.tipo ?? null,
  };
  const base = "/contenidos/fichas";
  const fichas = await contenidosListado(supabase, { q: params.q, orden: params.orden, cuenta: params.cuenta, tipo: params.tipo_filtro, estado: params.estado });
  const abrir = (id: string) => conParams(base, params, { ficha: id, nueva: null, fecha: null, tipo: null });
  const desc = params.orden === "desc";

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Fichas de contenido</h1>
        <p className="text-[15px] text-piedra">
          {fichas.length} {fichas.length === 1 ? "ficha" : "fichas"}
          {params.q ? ` con “${params.q}”` : ""}
        </p>
      </div>
      <PestanasContenidos actual="fichas" params={params} puedeCargar={acceso.carga} />

      <form action={base} className="flex gap-2">
        {Object.entries(params)
          .filter(([k, v]) => v && !["q", "ficha", "nueva", "fecha", "tipo"].includes(k))
          .map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v ?? ""} />
          ))}
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-piedra" />
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Buscar por nombre"
            className="min-h-11 w-full rounded-xl border border-borde bg-white pl-10 pr-3 text-[15px] outline-none focus:border-marino"
          />
        </label>
        <button className="min-h-11 rounded-xl bg-marino px-4 text-[15px] font-bold text-white">Buscar</button>
      </form>
      <FiltrosContenidos base={base} params={params} conTipo />

      <div className="overflow-hidden rounded-2xl border border-borde bg-white shadow-sm">
        <div className="hidden grid-cols-[7.5rem_minmax(0,1fr)_9rem_6rem_12rem] gap-3 border-b border-borde px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-piedra md:grid">
          <Link href={conParams(base, params, { orden: desc ? null : "desc", ficha: null, nueva: null })} scroll={false} className="inline-flex items-center gap-1 hover:text-tinta">
            Fecha {desc ? <ArrowDownWideNarrow className="h-3.5 w-3.5" /> : <ArrowUpNarrowWide className="h-3.5 w-3.5" />}
          </Link>
          <span>Nombre</span>
          <span>Cuenta</span>
          <span>Tipo</span>
          <span>Estado</span>
        </div>
        {fichas.map((c) => (
          <Link
            key={c.id}
            href={abrir(c.id)}
            scroll={false}
            className={`grid gap-1 border-b border-l-4 border-borde px-4 py-3 last:border-b-0 hover:bg-crema md:grid-cols-[7.5rem_minmax(0,1fr)_9rem_6rem_12rem] md:items-center md:gap-3 ${cuentaDe(c.cuenta).borde} ${
              params.ficha === c.id ? "bg-celeste-soft" : ""
            }`}
          >
            <span className={`text-sm font-bold ${c.fecha === hoyISO() ? "text-azul" : "text-piedra"}`}>{fechaDMY(c.fecha)}</span>
            <span className="truncate text-[15px] font-extrabold" title={c.nombre}>
              {c.nombre}
            </span>
            <span className="text-sm">{cuentaDe(c.cuenta).label}</span>
            <span className="text-sm">{tipoDe(c.tipo).label}</span>
            <span>
              <EstadoPastilla estado={c.estado} />
            </span>
          </Link>
        ))}
        {fichas.length === 0 && <p className="px-4 py-8 text-center text-[15px] text-piedra">No hay fichas con esos filtros.</p>}
      </div>
      <div className="md:hidden">
        <Link href={conParams(base, params, { orden: desc ? null : "desc", ficha: null, nueva: null })} scroll={false} className="text-sm font-bold text-marino underline">
          Ordenar por fecha: {desc ? "de la más nueva a la más vieja" : "de la más vieja a la más nueva"}
        </Link>
      </div>

      <PanelContenido base={base} params={params} acceso={acceso} hoy={hoyISO()} />
    </div>
  );
}
