import type { SupabaseServidor } from "@/lib/actions/comun";

/** Conversaciones de las cotizaciones (v1.24): lecturas con la sesión del usuario. */

export type ResumenConversacion = { total: number; sinLeer: number };

/**
 * Cuántos mensajes tiene la conversación de cada cotización y cuántos no
 * leyó el usuario (los propios no cuentan). Si algo falla, vacío: la ficha
 * se ve igual.
 */
export async function resumenConversaciones(
  supabase: SupabaseServidor,
  cotizacionIds: string[],
  usuarioId: string
): Promise<Record<string, ResumenConversacion>> {
  const ids = [...new Set(cotizacionIds)];
  if (!ids.length) return {};
  const { data: convs, error } = await supabase.from("conversaciones").select("id, cotizacion_id").in("cotizacion_id", ids);
  if (error || !convs?.length) return {};
  const convIds = convs.map((c) => c.id as string);
  const [mensajes, lecturas] = await Promise.all([
    supabase.from("mensajes").select("conversacion_id, autor_id, created_at").in("conversacion_id", convIds).limit(5000),
    supabase.from("conversacion_lecturas").select("conversacion_id, leido_at").eq("usuario_id", usuarioId).in("conversacion_id", convIds),
  ]);
  const leido = new Map(((lecturas.data ?? []) as { conversacion_id: string; leido_at: string }[]).map((l) => [l.conversacion_id, l.leido_at]));
  const porConv = new Map<string, ResumenConversacion>();
  for (const m of (mensajes.data ?? []) as { conversacion_id: string; autor_id: string | null; created_at: string }[]) {
    const r = porConv.get(m.conversacion_id) ?? { total: 0, sinLeer: 0 };
    r.total++;
    const hasta = leido.get(m.conversacion_id);
    if (m.autor_id !== usuarioId && (!hasta || Date.parse(m.created_at) > Date.parse(hasta))) r.sinLeer++;
    porConv.set(m.conversacion_id, r);
  }
  const res: Record<string, ResumenConversacion> = {};
  for (const c of convs as { id: string; cotizacion_id: string }[]) {
    const r = porConv.get(c.id);
    if (r) res[c.cotizacion_id] = r;
  }
  return res;
}
