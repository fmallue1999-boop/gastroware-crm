"use server";

// Dirección: aprobación de propuestas fuera de lista (manual, reglas
// generales) y respuesta a los informes comerciales de los lunes.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { avisar, puestoActual, usuarioActual } from "./comun";

/** Aprueba o rechaza una propuesta fuera de lista. Rechazar pide el motivo. */
export async function decidirPropuesta(versionId: string, aprobar: boolean, nota?: string) {
  const supabase = await createClient();
  if ((await puestoActual(supabase)) !== "direccion") return { error: "Las propuestas fuera de lista las aprueba dirección general" };
  if (!aprobar && !nota?.trim()) return { error: "Anotá por qué se rechaza (así el vendedor sabe qué cambiar)" };
  const user = await usuarioActual();
  const { data } = await supabase
    .from("cotizacion_versiones")
    .select("id, version, total, moneda, creado_por, aprobacion, cotizacion:cotizaciones(numero, oportunidad:oportunidades(id, cliente_id, comercial_id))")
    .eq("id", versionId)
    .maybeSingle();
  const v = data as unknown as {
    id: string;
    version: number;
    creado_por: string | null;
    aprobacion: string;
    cotizacion: { numero: number; oportunidad: { id: string; cliente_id: string; comercial_id: string | null } | null } | null;
  } | null;
  if (!v?.cotizacion?.oportunidad) return { error: "No se encontró la propuesta" };
  if (v.aprobacion !== "pendiente") return { error: "Esta propuesta ya fue resuelta" };
  const { error } = await supabase
    .from("cotizacion_versiones")
    .update({
      aprobacion: aprobar ? "aprobada" : "rechazada",
      aprobado_por: user?.id ?? null,
      aprobado_at: new Date().toISOString(),
      aprobacion_nota: nota?.trim() || null,
    })
    .eq("id", versionId);
  if (error) return { error: error.message };
  const opp = v.cotizacion.oportunidad;
  const nombre = `Propuesta N° ${v.cotizacion.numero}${v.version > 1 ? ` v${v.version}` : ""}`;
  await supabase.from("actividades").insert({
    cliente_id: opp.cliente_id,
    oportunidad_id: opp.id,
    tipo: "cotizacion",
    contenido: `${nombre} ${aprobar ? "aprobada" : "rechazada"} por dirección${nota?.trim() ? `: ${nota.trim()}` : ""}`,
    created_by: user?.id ?? null,
  });
  await avisar(
    supabase,
    [v.creado_por, opp.comercial_id],
    {
      tipo: aprobar ? "propuesta_aprobada" : "propuesta_rechazada",
      titulo: aprobar ? `${nombre} aprobada: ya la podés mandar` : `${nombre} rechazada: ${nota?.trim() ?? ""}`,
      url: `/clientes/${opp.cliente_id}?interes=${opp.id}`,
    },
    user?.id
  );
  revalidatePath("/", "layout");
  return { ok: true as const };
}
