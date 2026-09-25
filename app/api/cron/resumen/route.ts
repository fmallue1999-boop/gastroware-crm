import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const ABIERTAS = ["nueva", "cotizada", "seguimiento", "espera"];

/**
 * Cron matutino (Vercel Cron, 8:30 AR): manda a cada vendedor suscripto un
 * push con lo que tiene para contactar hoy. Desde la migración 026 el próximo
 * contacto vive en el interés (oportunidades.proximo_contacto): se cuentan sus
 * intereses atrasados y de hoy, más sus avisos de recompra.
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

  const [{ data: subs }, { data: intereses }, { data: recompras }] = await Promise.all([
    supabase.from("push_subs").select("*"),
    supabase
      .from("oportunidades")
      .select("comercial_id, proximo_contacto, proximo_nota, cliente:clientes!inner(nombre_comercial, deleted_at)")
      .in("etapa", ABIERTAS)
      .lte("proximo_contacto", hoy)
      .is("cliente.deleted_at", null)
      .order("proximo_contacto")
      .limit(1000),
    supabase
      .from("tareas")
      .select("usuario_id, vence_el")
      .eq("tipo", "recompra")
      .is("completada_at", null)
      .eq("cancelada", false)
      .lte("vence_el", hoy)
      .limit(1000),
  ]);

  type Interes = {
    comercial_id: string | null;
    proximo_contacto: string;
    proximo_nota: string | null;
    cliente: { nombre_comercial: string } | null;
  };
  const lista = (intereses ?? []) as unknown as Interes[];

  let enviadas = 0;
  for (const sub of subs ?? []) {
    const mios = lista.filter((i) => i.comercial_id === sub.usuario_id);
    const atrasados = mios.filter((i) => i.proximo_contacto < hoy).length;
    const deHoy = mios.filter((i) => i.proximo_contacto === hoy).length;
    const llegoStock = mios.filter((i) => i.proximo_nota === "Llegó stock").length;
    const recompra = (recompras ?? []).filter((t) => t.usuario_id === sub.usuario_id).length;
    if (atrasados + deHoy + recompra === 0) continue;

    const partes: string[] = [];
    if (deHoy > 0) partes.push(`${deHoy} para hoy`);
    if (atrasados > 0) partes.push(`${atrasados} de días anteriores`);
    if (recompra > 0) partes.push(`${recompra} recompra${recompra > 1 ? "s" : ""}`);
    const primero = mios[0]?.cliente?.nombre_comercial;
    const body =
      `Tenés ${partes.join(", ")}` +
      (llegoStock > 0 ? `. Llegó stock para ${llegoStock}` : "") +
      (primero ? `. Primero: ${primero}.` : ".");

    try {
      await webpush.sendNotification(
        sub.subscription,
        JSON.stringify({ title: "Para contactar hoy", body, url: "/hoy" })
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
