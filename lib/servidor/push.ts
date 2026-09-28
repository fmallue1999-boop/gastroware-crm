import { after } from "next/server";

/**
 * Avisos al celular (push). Todo aviso de la campana (tabla notificaciones)
 * se manda también al celular de quien lo recibe, una sola vez (columna
 * push_at, migración 029). Se miran solo los de los últimos 15 minutos: los
 * viejos no se mandan de golpe. Sin las claves VAPID o la de servicio no
 * hace nada (la campana sigue funcionando igual).
 */

type Aviso = { id: string; usuario_id: string; titulo: string; cuerpo: string | null; url: string | null };
type Suscripcion = { id: string; usuario_id: string; subscription: unknown };

export async function mandarAvisosPendientes(): Promise<number> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/\s+/g, "");
  const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privada = process.env.VAPID_PRIVATE_KEY;
  if (!url || !clave || !publica || !privada) return 0;

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(url, clave, { auth: { autoRefreshToken: false, persistSession: false } });
    const desde = new Date(Date.now() - 15 * 60_000).toISOString();
    const { data: pendientes } = await admin
      .from("notificaciones")
      .select("id")
      .is("push_at", null)
      .gte("created_at", desde)
      .limit(100);
    const ids = ((pendientes ?? []) as { id: string }[]).map((n) => n.id);
    if (!ids.length) return 0;

    // Se "toman" antes de mandar: si otra ejecución corre a la vez, no se repiten
    const { data: tomados } = await admin
      .from("notificaciones")
      .update({ push_at: new Date().toISOString() })
      .in("id", ids)
      .is("push_at", null)
      .select("id, usuario_id, titulo, cuerpo, url");
    const avisos = (tomados ?? []) as Aviso[];
    if (!avisos.length) return 0;

    const usuarios = [...new Set(avisos.map((a) => a.usuario_id))];
    const { data: subsData } = await admin.from("push_subs").select("id, usuario_id, subscription").in("usuario_id", usuarios);
    const subs = (subsData ?? []) as Suscripcion[];
    if (!subs.length) return 0;

    const webpush = (await import("web-push")).default;
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:info@gastroware.com.ar", publica, privada);

    let enviados = 0;
    for (const u of usuarios) {
      const mios = avisos.filter((a) => a.usuario_id === u);
      // Hasta 3 avisos van uno por uno; más, en un resumen
      const mensajes =
        mios.length <= 3
          ? mios.map((a) => ({ title: a.titulo, body: a.cuerpo ?? "", url: a.url ?? "/notificaciones" }))
          : [{ title: `${mios.length} avisos nuevos`, body: mios.slice(0, 3).map((a) => a.titulo).join(" · "), url: "/notificaciones" }];
      for (const s of subs.filter((x) => x.usuario_id === u)) {
        for (const m of mensajes) {
          try {
            await webpush.sendNotification(s.subscription as Parameters<typeof webpush.sendNotification>[0], JSON.stringify(m));
            enviados++;
          } catch (e: unknown) {
            const status = (e as { statusCode?: number }).statusCode;
            // El celular ya no acepta avisos (se desinstaló o se revocó el permiso)
            if (status === 404 || status === 410) {
              await admin.from("push_subs").delete().eq("id", s.id);
              break;
            }
          }
        }
      }
    }
    return enviados;
  } catch {
    return 0;
  }
}

/** Manda los avisos pendientes después de responder (no demora la pantalla). */
export function avisarAlCelular() {
  try {
    after(async () => {
      await mandarAvisosPendientes();
    });
  } catch {
    // Fuera de una solicitud (scripts): no hay nada que mandar
  }
}
