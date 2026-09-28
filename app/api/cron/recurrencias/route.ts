import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Cron diario (Vercel Cron): avisos de garantías por vencer. Las reposiciones
 * de consumibles se siguen desde su plan (migración 031). Protegido con CRON_SECRET.
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
    process.env.SUPABASE_SERVICE_ROLE_KEY!.replace(/\s+/g, "")
  );

  const hoy = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  });

  // Desde la migración 031 el plan de reposición de consumibles (recurrencias)
  // es el seguimiento: aparece en Consumibles y en Mi día de quien lo tiene a
  // cargo. Ya no se crean tareas de recompra aparte (evitaría duplicados).
  const creadas = 0;
  const errores: string[] = [];

  // --- Garantías por vencer (30 días): una tarea por equipo, sin repetir ---
  const en30 = new Date(hoy + "T12:00:00");
  en30.setDate(en30.getDate() + 30);
  const hasta = en30.toLocaleDateString("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  });

  const { data: porVencer } = await supabase
    .from("equipos")
    .select(
      "id, cliente_id, comercial_id, garantia_hasta, numero_serie, producto:productos(nombre), marca_modelo_libre"
    )
    .is("deleted_at", null)
    .gte("garantia_hasta", hoy)
    .lte("garantia_hasta", hasta);

  let avisosGarantia = 0;
  for (const eq of porVencer ?? []) {
    // Dedup: ¿ya existe una tarea de garantía para este equipo?
    const { count } = await supabase
      .from("tareas")
      .select("id", { count: "exact", head: true })
      .eq("equipo_id", eq.id)
      .eq("tipo", "garantia");
    if ((count ?? 0) > 0) continue;

    const nombreEq =
      (eq.producto as unknown as { nombre: string } | null)?.nombre ??
      eq.marca_modelo_libre ??
      "equipo";
    const { error } = await supabase.from("tareas").insert({
      cliente_id: eq.cliente_id,
      equipo_id: eq.id,
      usuario_id: eq.comercial_id ?? null,
      tipo: "garantia",
      titulo: `Garantía de ${nombreEq}${eq.numero_serie ? ` (serie ${eq.numero_serie})` : ""} vence el ${eq.garantia_hasta} — ofrecer service/plan`,
      vence_el: hoy,
      auto: true,
    });
    if (error) {
      errores.push(`garantía ${eq.id}: ${error.message}`);
      continue;
    }
    avisosGarantia++;
  }

  if (errores.length) console.error("cron recurrencias:", errores);
  return NextResponse.json({ ok: errores.length === 0, creadas, avisosGarantia, errores });
}
