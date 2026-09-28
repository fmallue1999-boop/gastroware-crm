import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { textoMontos } from "@/lib/dinero";
import { primerContacto, textoMinutos, ventasPorTerritorio } from "@/lib/operacion";

/**
 * Operación del manual en el tablero de dirección: primer contacto de las
 * consultas, ventas por territorio, remitos hechos contra facturados, casos
 * y cobranza vencida. Período: desde (incluido) → hasta (no incluido).
 */
export default async function Operacion({ desde, hasta, hoy }: { desde: string; hasta: string; hoy: string }) {
  const supabase = await createClient();
  // Días en hora argentina (UTC-3)
  const ini = `${desde}T03:00:00.000Z`;
  const fin = `${hasta}T03:00:00.000Z`;
  const [consultas, ventas, territorios, remitos, casos, vencidas] = await Promise.all([
    supabase.from("oportunidades").select("asignado_at, primer_contacto_at").gte("asignado_at", ini).lt("asignado_at", fin).limit(5000),
    supabase.from("oportunidades").select("territorio, monto_estimado, moneda").eq("etapa", "ganada").gte("closed_at", ini).lt("closed_at", fin).limit(5000),
    supabase.from("territorios").select("codigo, nombre"),
    supabase.from("ordenes_trabajo").select("estado, cobertura").gte("cerrada_tecnico_at", ini).lt("cerrada_tecnico_at", fin).limit(5000),
    supabase.from("casos").select("estado, created_at, primera_respuesta_at, cerrado_at").gte("created_at", ini).lt("created_at", fin).limit(5000),
    supabase.from("facturas").select("monto, moneda, vencimiento").neq("cobro_estado", "cobrado").lt("vencimiento", hoy).limit(5000),
  ]);
  const pc = primerContacto((consultas.data ?? []) as { asignado_at: string; primer_contacto_at: string | null }[]);
  const nombres = Object.fromEntries(((territorios.data ?? []) as { codigo: string; nombre: string }[]).map((t) => [t.codigo, t.nombre]));
  const porTerritorio = ventasPorTerritorio(
    (ventas.data ?? []) as { territorio: string | null; monto_estimado: number | null; moneda: string }[],
    nombres
  );
  const rem = (remitos.data ?? []) as { estado: string; cobertura: string }[];
  const facturables = rem.filter((r) => r.cobertura === "facturable");
  const facturados = facturables.filter((r) => ["facturado", "cerrado"].includes(r.estado)).length;
  const cs = (casos.data ?? []) as { estado: string; created_at: string; primera_respuesta_at: string | null; cerrado_at: string | null }[];
  const venc: Record<string, number> = {};
  for (const f of (vencidas.data ?? []) as { monto: number | null; moneda: string }[])
    if (f.monto != null) venc[f.moneda] = (venc[f.moneda] ?? 0) + Number(f.monto);

  const tarjeta = "rounded-2xl bg-white p-4 shadow-sm";
  const titulo = "text-[11px] font-bold uppercase tracking-wide text-piedra";
  const numero = "text-2xl font-extrabold tabular-nums";
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-bold uppercase tracking-wide text-piedra">Operación (manual por áreas)</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className={tarjeta}>
          <p className={titulo}>Primer contacto</p>
          <p className={numero}>{textoMinutos(pc.medianaMin)}</p>
          <p className="text-xs text-piedra">
            mediana · {pc.pctEnLaHora ?? "—"}% dentro de la hora · {pc.sinContacto} sin contacto de {pc.total}
          </p>
        </div>
        <div className={tarjeta}>
          <p className={titulo}>Remitos del período</p>
          <p className={numero}>
            {facturados}/{facturables.length}
          </p>
          <p className="text-xs text-piedra">facturables ya facturados · {rem.length - facturables.length} en garantía o contrato</p>
        </div>
        <Link href="/casos" className={tarjeta}>
          <p className={titulo}>Casos del período</p>
          <p className={numero}>{cs.length}</p>
          <p className="text-xs text-piedra">
            {cs.filter((c) => c.estado === "cerrado").length} cerrados · {cs.filter((c) => !c.primera_respuesta_at && c.estado !== "cerrado").length} sin respuesta
          </p>
        </Link>
        <Link href="/cobranzas" className={tarjeta}>
          <p className={titulo}>Cobranza vencida hoy</p>
          <p className="truncate text-xl font-extrabold text-red-600">{Object.keys(venc).length ? textoMontos(venc) : "—"}</p>
          <p className="text-xs text-piedra">{(vencidas.data ?? []).length} facturas</p>
        </Link>
      </div>
      <div className={tarjeta}>
        <h3 className="mb-2 text-[15px] font-extrabold">Ventas por territorio</h3>
        {porTerritorio.length === 0 ? (
          <p className="text-[15px] text-piedra">Sin ventas en el período.</p>
        ) : (
          <ul className="space-y-1 text-[15px]">
            {porTerritorio.map((t) => (
              <li key={t.nombre} className="flex justify-between gap-2">
                <span>
                  {t.nombre} <span className="text-piedra">· {t.cantidad} venta{t.cantidad === 1 ? "" : "s"}</span>
                </span>
                <span className="font-bold tabular-nums">{Object.keys(t.montos).length ? textoMontos(t.montos) : "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
