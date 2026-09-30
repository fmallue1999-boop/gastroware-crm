import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hoyISO } from "@/lib/format";
import { esEstado, esFecha, fechaDMY, moverPeriodo, nombreMes, rangoMes, rangoSemana } from "@/lib/contenidos";
import { accesoContenidos, contenidosDelRango, miniaturas } from "@/lib/servidor/contenidos";
import CalendarioContenidos from "@/components/contenidos/CalendarioContenidos";
import PanelContenido from "@/components/contenidos/PanelContenido";
import { FiltrosContenidos, NavegacionCalendario, PestanasContenidos } from "@/components/contenidos/BarraContenidos";
import { LeyendaColores } from "@/components/contenidos/Indicadores";

type Busqueda = { vista?: string; dia?: string; cuenta?: string; estado?: string; ficha?: string; nueva?: string; fecha?: string; tipo?: string };

/**
 * Calendario de contenidos (v1.10): vista MES o SEMANA de las fichas, con
 * filtros de cuenta y estado en el link. La ficha se abre al costado.
 */
export default async function ContenidosPage({ searchParams }: { searchParams: Promise<Busqueda> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const acceso = await accesoContenidos(supabase);
  if (!acceso.ve) redirect("/");

  const hoy = hoyISO();
  const vista = sp.vista === "semana" ? "semana" : "mes";
  const dia = esFecha(sp.dia) ? sp.dia : hoy;
  const rango = vista === "mes" ? rangoMes(dia) : rangoSemana(dia);
  const params: Record<string, string | null> = {
    vista: vista === "semana" ? "semana" : null,
    dia: esFecha(sp.dia) ? sp.dia : null,
    cuenta: sp.cuenta === "gastroware" || sp.cuenta === "zumex" ? sp.cuenta : null,
    estado: esEstado(sp.estado) ? sp.estado : null,
    ficha: sp.ficha ?? null,
    nueva: sp.nueva === "1" ? "1" : null,
    fecha: sp.fecha ?? null,
    tipo: sp.tipo ?? null,
  };

  const contenidos = await contenidosDelRango(supabase, { desde: rango.desde, hasta: rango.hasta, cuenta: params.cuenta, estado: params.estado });
  const minis = vista === "semana" ? await miniaturas(supabase, contenidos.map((c) => c.id)) : new Map();
  const pendientes = contenidos.filter((c) => c.estado === "pendiente").length;
  const titulo = vista === "mes" ? nombreMes(dia) : `Semana del ${fechaDMY(rango.desde).slice(0, 5)} al ${fechaDMY(rango.hasta)}`;

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Calendario de contenidos</h1>
        <p className="text-[15px] text-piedra">
          {contenidos.length
            ? `${contenidos.length} ${contenidos.length === 1 ? "contenido" : "contenidos"} ${vista === "mes" ? "este mes" : "esta semana"}${pendientes ? ` · ${pendientes} pendiente${pendientes === 1 ? "" : "s"} de aprobación` : ""}`
            : "Nada cargado en estas fechas con estos filtros."}
        </p>
      </div>
      <PestanasContenidos actual="calendario" params={params} puedeCargar={acceso.carga} />
      <NavegacionCalendario
        vista={vista}
        titulo={titulo}
        anterior={moverPeriodo(vista, dia, -1)}
        siguiente={moverPeriodo(vista, dia, 1)}
        hoy={hoy}
        params={params}
      />
      <FiltrosContenidos base="/contenidos" params={params} />
      <LeyendaColores />
      <CalendarioContenidos vista={vista} dias={rango.dias} contenidos={contenidos} hoy={hoy} params={params} miniaturas={minis} puedeCargar={acceso.carga} />
      <PanelContenido base="/contenidos" params={params} acceso={acceso} hoy={hoy} />
    </div>
  );
}
