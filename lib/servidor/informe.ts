import { sumarDias } from "@/lib/format";
import { ETAPAS_ABIERTAS } from "@/lib/constants";
import type { NumerosInforme } from "@/lib/semana";
import type { SupabaseServidor } from "@/lib/actions/comun";

/** Números de la semana de un vendedor (los completa el CRM, no se tipean). */
export async function numerosInforme(
  supabase: SupabaseServidor,
  usuarioId: string,
  desde: string,
  hasta: string
): Promise<NumerosInforme> {
  // Días en hora argentina (UTC-3)
  const ini = `${desde}T03:00:00.000Z`;
  const fin = `${sumarDias(1, hasta)}T03:00:00.000Z`;
  const [nuevas, sinContacto, cotiz, ventas, perdidas, movs, abiertos, casosAb, casosCe] = await Promise.all([
    supabase.from("oportunidades").select("id", { count: "exact", head: true }).eq("comercial_id", usuarioId).gte("created_at", ini).lt("created_at", fin),
    supabase
      .from("oportunidades")
      .select("id", { count: "exact", head: true })
      .eq("comercial_id", usuarioId)
      .in("etapa", [...ETAPAS_ABIERTAS])
      .not("asignado_at", "is", null)
      .is("primer_contacto_at", null),
    supabase.from("cotizacion_versiones").select("id", { count: "exact", head: true }).eq("creado_por", usuarioId).gte("created_at", ini).lt("created_at", fin),
    supabase.from("oportunidades").select("monto_estimado, moneda").eq("comercial_id", usuarioId).eq("etapa", "ganada").gte("closed_at", ini).lt("closed_at", fin),
    supabase.from("oportunidades").select("id", { count: "exact", head: true }).eq("comercial_id", usuarioId).eq("etapa", "perdida").gte("closed_at", ini).lt("closed_at", fin),
    supabase.from("actividades").select("id", { count: "exact", head: true }).eq("created_by", usuarioId).gte("created_at", ini).lt("created_at", fin),
    supabase.from("oportunidades").select("etapa").eq("comercial_id", usuarioId).in("etapa", [...ETAPAS_ABIERTAS]).is("deleted_at", null).limit(5000),
    supabase.from("casos").select("id", { count: "exact", head: true }).eq("responsable_id", usuarioId).neq("estado", "cerrado"),
    supabase.from("casos").select("id", { count: "exact", head: true }).eq("responsable_id", usuarioId).gte("cerrado_at", ini).lt("cerrado_at", fin),
  ]);
  const montoVentas: Record<string, number> = {};
  for (const v of (ventas.data ?? []) as { monto_estimado: number | null; moneda: string }[])
    if (v.monto_estimado != null) montoVentas[v.moneda || "ARS"] = (montoVentas[v.moneda || "ARS"] ?? 0) + Number(v.monto_estimado);
  const abiertosPorEtapa: Record<string, number> = {};
  for (const o of (abiertos.data ?? []) as { etapa: string }[]) abiertosPorEtapa[o.etapa] = (abiertosPorEtapa[o.etapa] ?? 0) + 1;
  return {
    consultasNuevas: nuevas.count ?? 0,
    sinPrimerContacto: sinContacto.count ?? 0,
    cotizaciones: cotiz.count ?? 0,
    ventas: (ventas.data ?? []).length,
    montoVentas,
    movimientos: movs.count ?? 0,
    abiertosPorEtapa,
    casosAbiertos: casosAb.count ?? 0,
    casosCerrados: casosCe.count ?? 0,
    perdidas: perdidas.count ?? 0,
  };
}
