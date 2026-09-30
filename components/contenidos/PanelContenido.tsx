import Link from "next/link";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { cargarFicha, type Acceso } from "@/lib/servidor/contenidos";
import { conParams, cuentaDe, esFecha, esTipo, fechaDMY } from "@/lib/contenidos";
import { fechaCorta } from "@/lib/format";
import FichaContenidoForm from "@/components/contenidos/FichaContenidoForm";
import CerrarConEsc from "@/components/contenidos/CerrarConEsc";

/**
 * La ficha abierta al costado (en el celular, a pantalla completa), arriba
 * del calendario o del listado: al cerrarla se vuelve a la misma vista, con
 * el mismo mes/semana y filtros. ?ficha=<id> abre esa ficha; ?nueva=1 una
 * vacía (con ?fecha y ?tipo precompletados desde una celda).
 */
export default async function PanelContenido({
  base,
  params,
  acceso,
  hoy,
}: {
  base: string;
  params: Record<string, string | null>;
  acceso: Acceso;
  hoy: string;
}) {
  const fichaId = params.ficha;
  const nueva = params.nueva === "1";
  if (!fichaId && !nueva) return null;
  const cerrarHref = conParams(base, params, { ficha: null, nueva: null, fecha: null, tipo: null });

  const supabase = await createClient();
  const ficha = fichaId ? await cargarFicha(supabase, fichaId) : null;
  if (!nueva && !ficha)
    return (
      <Cajon cerrarHref={cerrarHref} titulo="Contenido">
        <p className="text-[15px] text-piedra">Ese contenido ya no está (puede que lo hayan eliminado).</p>
      </Cajon>
    );
  if (nueva && !acceso.carga) return null;

  const c = ficha?.contenido ?? null;
  const pie = c
    ? `Cargado ${ficha?.cargadoPor ? `por ${ficha.cargadoPor} ` : ""}el ${fechaCorta(c.created_at)}${
        c.updated_at !== c.created_at ? ` · último cambio ${ficha?.editadoPor ? `de ${ficha.editadoPor} ` : ""}el ${fechaCorta(c.updated_at)}` : ""
      }`
    : null;

  return (
    <Cajon
      cerrarHref={cerrarHref}
      titulo={c ? c.nombre : "Nuevo contenido"}
      detalle={c ? `${cuentaDe(c.cuenta).label} · ${fechaDMY(c.fecha)}` : null}
      borde={c ? cuentaDe(c.cuenta).borde : null}
    >
      <FichaContenidoForm
        key={c?.id ?? `nueva-${params.fecha ?? ""}-${params.tipo ?? ""}`}
        contenido={c}
        archivos={ficha?.archivos ?? []}
        inicial={{ fecha: esFecha(params.fecha) ? params.fecha : hoy, tipo: esTipo(params.tipo) ? params.tipo : "feed" }}
        puedeCargar={acceso.carga}
        aprueba={acceso.aprueba}
        base={base}
        params={params}
        pie={pie}
      />
    </Cajon>
  );
}

function Cajon({
  cerrarHref,
  titulo,
  detalle,
  borde,
  children,
}: {
  cerrarHref: string;
  titulo: string;
  detalle?: string | null;
  borde?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <Link href={cerrarHref} scroll={false} aria-label="Cerrar" className="absolute inset-0 bg-black/30" />
      <CerrarConEsc href={cerrarHref} />
      <section className="relative flex h-full w-full max-w-xl flex-col bg-crema shadow-2xl" role="dialog" aria-label={titulo}>
        <header className={`flex items-start gap-2 border-b border-borde bg-white px-4 py-3 ${borde ? `border-l-8 ${borde}` : ""}`}>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-extrabold leading-tight" title={titulo}>
              {titulo}
            </p>
            {detalle && <p className="text-sm text-piedra">{detalle}</p>}
          </div>
          <Link href={cerrarHref} scroll={false} aria-label="Cerrar" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-borde bg-white">
            <X className="h-5 w-5" />
          </Link>
        </header>
        <div className="flex-1 overflow-y-auto px-4 pt-4">{children}</div>
      </section>
    </div>
  );
}
