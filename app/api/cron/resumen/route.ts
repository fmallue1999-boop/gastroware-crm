import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

/**
 * Cron matutino (Vercel Cron, 8:30 AR): manda a cada vendedor suscripto
 * un push con sus seguimientos vencidos y los de hoy.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (
    !process.env.SUPABASE_SERVICE_ROLE_KEY ||
    !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    !process.env.VAPID_PRIVATE_KEY
  ) {
    return NextResponse.json(
      { error: "Faltan variables de entorno (service key o VAPID)" },
      { status: 500 }
    );
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:info@gastroware.com.ar",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY.replace(/\s+/g, "")
  );

  const hoy = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  });

  const [{ data: subs }, { data: tareas }] = await Promise.all([
    supabase.from("push_subs").select("*"),
    supabase
      .from("tareas")
      .select("usuario_id, vence_el, cliente:clientes(nombre_comercial)")
      .is("completada_at", null)
      .eq("cancelada", false)
      .eq("auto", false)
      .lte("vence_el", hoy),
  ]);

  let enviadas = 0;
  for (const sub of subs ?? []) {
    const mias = (tareas ?? []).filter((t) => t.usuario_id === sub.usuario_id);
    const vencidas = mias.filter((t) => t.vence_el < hoy).length;
    const paraHoy = mias.filter((t) => t.vence_el === hoy).length;
    if (vencidas + paraHoy === 0) continue;

    const primera = mias[0] as unknown as {
      cliente: { nombre_comercial: string } | null;
    };
    const partes = [];
    if (vencidas > 0) partes.push(`${vencidas} vencida${vencidas > 1 ? "s" : ""}`);
    if (paraHoy > 0) partes.push(`${paraHoy} para hoy`);
    const body =
      `Tenés ${partes.join(" y ")}` +
      (primera?.cliente ? `. Primera: ${primera.cliente.nombre_comercial}.` : ".");

    try {
      await webpush.sendNotification(
        sub.subscription,
        JSON.stringify({ title: "Seguimientos de hoy", body, url: "/clientes?vista=contactar" })
      );
      enviadas++;
    } catch (e: unknown) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await supabase.from("push_subs").delete().eq("id", sub.id);
      }
    }
  }

  return NextResponse.json({ ok: true, enviadas });
}
