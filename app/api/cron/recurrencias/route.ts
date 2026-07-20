import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Cron diario (Vercel Cron): genera tareas de recompra para las recurrencias
 * vencidas. Protegido con CRON_SECRET.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Falta SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 }
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const hoy = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  });

  const { data: recurrencias } = await supabase
    .from("recurrencias")
    .select("*, producto:productos(nombre), cliente:clientes(nombre_comercial, vendedor_id)")
    .eq("activa", true)
    .lte("proxima_alerta", hoy);

  let creadas = 0;
  for (const rec of recurrencias ?? []) {
    // Evitar duplicados: ¿ya hay una tarea de recompra pendiente para esta recurrencia?
    const { count } = await supabase
      .from("tareas")
      .select("id", { count: "exact", head: true })
      .eq("recurrencia_id", rec.id)
      .is("completada_at", null)
      .eq("cancelada", false);
    if ((count ?? 0) > 0) continue;

    await supabase.from("tareas").insert({
      cliente_id: rec.cliente_id,
      recurrencia_id: rec.id,
      vendedor_id: rec.cliente?.vendedor_id ?? null,
      tipo: "recompra",
      titulo: `Ofrecer recompra: ${rec.producto?.nombre ?? "consumible"}`,
      vence_el: hoy,
      auto: true,
    });
    creadas++;
  }

  return NextResponse.json({ ok: true, creadas });
}
