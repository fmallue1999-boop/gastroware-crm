import { ETAPAS_ABIERTAS } from "@/lib/constants";
import { sumarPorMoneda } from "@/lib/dinero";
import { esEvento, masDias } from "@/lib/agenda";
import { deLinea, resumirActividad, resumirControl, type FilaActividad, type FilaControl, type ReporteActividad, type ReporteControl } from "@/lib/reportes";
import { cargarSolicitudes } from "@/lib/servidor/repuestos";
import type { EstadoRepuesto } from "@/lib/repuestos";
import type { Montos, Periodo } from "@/lib/tablero";
import type { SupabaseServidor } from "@/lib/actions/comun";

/**
 * Datos de los paneles comerciales del tablero (v1.7): actividad, control,
 * agenda, consumibles y repuestos. Con la sesión del usuario (dirección ve todo).
 */

export type ReportesComerciales = {
  actividad: ReporteActividad;
  control: ReporteControl;
  agenda: { delPeriodo: number; completadas: number; vencidas: number };
  consumibles: { ventas: number; vendido: Montos; paraContactar: number; proximos30: number; suspendidos: number };
  repuestos: { porEstado: Record<EstadoRepuesto, number>; cotizadoAbierto: Montos; ganadas: number; perdidas: number };
};

/** Pagina de a 1000 (PostgREST corta ahí). */
async function todas<T>(arma: (desde: number, hasta: number) => PromiseLike<{ data: unknown[] | null }>, tope = 20000): Promise<T[]> {
  const out: T[] = [];
  for (let desde = 0; desde < tope; desde += 1000) {
    const { data } = await arma(desde, desde + 999);
    const pagina = (data ?? []) as T[];
    out.push(...pagina);
    if (pagina.length < 1000) break;
  }
  return out;
}

export async function cargarReportesComerciales(
  supabase: SupabaseServidor,
  per: Periodo,
  filtro: { vendedor?: string | null; linea?: string | null },
  hoy: string,
  nombres: Map<string, string>
): Promise<ReportesComerciales> {
  const desdeTs = `${per.desde}T00:00:00-03:00`;
  const hastaTs = `${per.hasta}T00:00:00-03:00`;
  const nombre = (id: string) => nombres.get(id) ?? "Alguien del equipo";
  const vendedor = filtro.vendedor && filtro.vendedor !== "sin" ? filtro.vendedor : null;

  const [acts, abiertas, agenda, ventasCons, planes, solicitudes, cerradasRep] = await Promise.all([
    todas<{ medio: string | null; resultado: string | null; created_by: string | null; oportunidad: { linea: string | null } | null }>((a, b) => {
      let q = supabase
        .from("actividades")
        .select("medio, resultado, created_by, oportunidad:oportunidades(linea)")
        .not("medio", "is", null)
        .gte("created_at", desdeTs)
        .lt("created_at", hastaTs)
        .order("id")
        .range(a, b);
      if (vendedor) q = q.eq("created_by", vendedor);
      return q;
    }),
    todas<FilaControl>((a, b) => {
      let q = supabase
        .from("oportunidades")
        .select("comercial_id, linea, etapa, asignado_at, primer_contacto_at, proximo_contacto")
        .in("etapa", [...ETAPAS_ABIERTAS])
        .is("deleted_at", null)
        .order("id")
        .range(a, b);
      if (filtro.vendedor === "sin") q = q.is("comercial_id", null);
      else if (vendedor) q = q.eq("comercial_id", vendedor);
      return q;
    }),
    todas<{ hecha_at: string | null; usuario_id: string; agenda: { fecha: string; tipo: string } }>((a, b) => {
      let q = supabase
        .from("agenda_personas")
        .select("hecha_at, usuario_id, agenda:agenda!inner(fecha, tipo)")
        .gte("agenda.fecha", per.desde)
        .lt("agenda.fecha", per.hasta)
        .order("agenda_id")
        .range(a, b);
      if (vendedor) q = q.eq("usuario_id", vendedor);
      return q;
    }),
    todas<{ monto_estimado: number | null; moneda: string | null }>((a, b) => {
      let q = supabase
        .from("oportunidades")
        .select("monto_estimado, moneda")
        .eq("linea", "consumibles")
        .eq("etapa", "ganada")
        .gte("closed_at", desdeTs)
        .lt("closed_at", hastaTs)
        .order("id")
        .range(a, b);
      if (vendedor) q = q.eq("comercial_id", vendedor);
      return q;
    }),
    todas<{ activa: boolean; proxima_alerta: string; responsable_id: string | null }>((a, b) => {
      let q = supabase.from("recurrencias").select("activa, proxima_alerta, responsable_id").order("id").range(a, b);
      if (vendedor) q = q.eq("responsable_id", vendedor);
      return q;
    }),
    cargarSolicitudes(supabase, { limite: 2000 }),
    todas<{ etapa: string }>((a, b) => {
      let q = supabase
        .from("oportunidades")
        .select("etapa")
        .eq("linea", "repuestos")
        .in("etapa", ["ganada", "perdida"])
        .gte("closed_at", desdeTs)
        .lt("closed_at", hastaTs)
        .order("id")
        .range(a, b);
      if (vendedor) q = q.eq("comercial_id", vendedor);
      return q;
    }),
  ]);

  const filasAct: FilaActividad[] = acts.map((f) => ({ medio: f.medio, resultado: f.resultado, created_by: f.created_by, linea: f.oportunidad?.linea ?? null }));
  // Con apartado elegido: solo la actividad sobre operaciones de ese apartado
  const actividad = resumirActividad(filtro.linea ? deLinea(filasAct.filter((f) => f.linea), filtro.linea) : filasAct, nombre);
  const control = resumirControl(deLinea(abiertas, filtro.linea), nombre);

  const agendaFilas = agenda.filter((f) => f.agenda);
  const sols = solicitudes.filter((s) => !vendedor || s.comercial_id === vendedor);
  const porEstado = { validacion: 0, para_cotizar: 0, cotizada: 0, esperando: 0, ganada: 0, perdida: 0 } as Record<EstadoRepuesto, number>;
  for (const s of sols) porEstado[s.estado]++;
  const activos = planes.filter((p) => p.activa);

  return {
    actividad,
    control,
    agenda: {
      delPeriodo: agendaFilas.length,
      completadas: agendaFilas.filter((f) => f.hecha_at).length,
      vencidas: agendaFilas.filter((f) => !f.hecha_at && f.agenda.fecha < hoy && !esEvento(f.agenda.tipo)).length,
    },
    consumibles: {
      ventas: ventasCons.length,
      vendido: sumarPorMoneda(ventasCons.map((v) => ({ monto: v.monto_estimado, moneda: v.moneda ?? "ARS" }))),
      paraContactar: activos.filter((p) => p.proxima_alerta <= hoy).length,
      proximos30: activos.filter((p) => p.proxima_alerta > hoy && p.proxima_alerta <= masDias(hoy, 30)).length,
      suspendidos: planes.filter((p) => !p.activa).length,
    },
    repuestos: {
      porEstado,
      cotizadoAbierto: sumarPorMoneda(
        sols
          .filter((s) => s.estado === "cotizada" || s.estado === "esperando")
          .map((s) => ({ monto: s.precio_unitario == null ? null : s.precio_unitario * s.cantidad, moneda: s.moneda }))
      ),
      ganadas: cerradasRep.filter((c) => c.etapa === "ganada").length,
      perdidas: cerradasRep.filter((c) => c.etapa === "perdida").length,
    },
  };
}
