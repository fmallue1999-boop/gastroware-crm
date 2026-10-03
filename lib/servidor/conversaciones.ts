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
  const { data: convs, error } = await supabase.from("chats").select("id, cotizacion_id").in("cotizacion_id", ids);
  if (error || !convs?.length) return {};
  const convIds = convs.map((c) => c.id as string);
  const [mensajes, lecturas] = await Promise.all([
    supabase.from("chat_mensajes").select("chat_id, autor_id, created_at").in("chat_id", convIds).limit(5000),
    supabase.from("chat_lecturas").select("chat_id, leido_at").eq("usuario_id", usuarioId).in("chat_id", convIds),
  ]);
  const leido = new Map(((lecturas.data ?? []) as { chat_id: string; leido_at: string }[]).map((l) => [l.chat_id, l.leido_at]));
  const porConv = new Map<string, ResumenConversacion>();
  for (const m of (mensajes.data ?? []) as { chat_id: string; autor_id: string | null; created_at: string }[]) {
    const r = porConv.get(m.chat_id) ?? { total: 0, sinLeer: 0 };
    r.total++;
    const hasta = leido.get(m.chat_id);
    if (m.autor_id !== usuarioId && (!hasta || Date.parse(m.created_at) > Date.parse(hasta))) r.sinLeer++;
    porConv.set(m.chat_id, r);
  }
  const res: Record<string, ResumenConversacion> = {};
  for (const c of convs as { id: string; cotizacion_id: string }[]) {
    const r = porConv.get(c.id);
    if (r) res[c.cotizacion_id] = r;
  }
  return res;
}
