"use server";

// Dirección: aprobación de propuestas fuera de lista (manual, reglas
// generales) y respuesta a los informes comerciales de los lunes.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { avisar, puestoActual, usuarioActual, usuariosDePuesto } from "./comun";
import { hoyISO } from "@/lib/format";
import { esGestor } from "@/lib/puestos";
import { lunesDe, periodoInforme } from "@/lib/semana";
import { numerosInforme } from "@/lib/servidor/informe";

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

/**
 * Informe comercial de los lunes: el CRM completa los números de la semana
 * anterior y el vendedor agrega bloqueos, decisiones que necesita y agenda.
 * Se puede guardar y reenviar hasta que dirección responda.
 */
export async function enviarInforme(input: { bloqueos: string; decisiones: string; agenda: string; enviar: boolean }) {
  const supabase = await createClient();
  const user = await usuarioActual();
  if (!user) return { error: "Sesión vencida" };
  const semana = lunesDe(hoyISO());
  const { desde, hasta } = periodoInforme(semana);
  const numeros = await numerosInforme(supabase, user.id, desde, hasta);
  const { data: previo } = await supabase
    .from("informes_semanales")
    .select("id, respondido_at")
    .eq("usuario_id", user.id)
    .eq("semana", semana)
    .maybeSingle();
  if (previo?.respondido_at) return { error: "Dirección ya respondió este informe" };
  const fila = {
    usuario_id: user.id,
    semana,
    numeros,
    bloqueos: input.bloqueos.trim() || null,
    decisiones: input.decisiones.trim() || null,
    agenda: input.agenda.trim() || null,
    ...(input.enviar ? { enviado_at: new Date().toISOString() } : {}),
  };
  const { error } = await supabase.from("informes_semanales").upsert(fila, { onConflict: "usuario_id,semana" });
  if (error) return { error: error.message };
  if (input.enviar) {
    const { data: yo } = await supabase.from("usuarios").select("nombre").eq("id", user.id).maybeSingle();
    const direccion = await usuariosDePuesto(supabase, ["direccion"]);
    await avisar(
      supabase,
      direccion,
      {
        tipo: "informe_semanal",
        titulo: `Informe comercial de ${yo?.nombre ?? "un vendedor"}${input.decisiones.trim() ? ": pide decisiones" : ""}`,
        url: "/informes",
      },
      user.id
    );
  }
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** Dirección responde las decisiones del informe (le llega al vendedor). */
export async function responderInforme(informeId: string, respuesta: string) {
  if (!respuesta.trim()) return { error: "Escribí la respuesta" };
  const supabase = await createClient();
  if (!esGestor(await puestoActual(supabase))) return { error: "Responde dirección" };
  const user = await usuarioActual();
  const { data: inf } = await supabase.from("informes_semanales").select("usuario_id").eq("id", informeId).maybeSingle();
  if (!inf) return { error: "No se encontró el informe" };
  const { error } = await supabase
    .from("informes_semanales")
    .update({ respuesta: respuesta.trim(), respondido_por: user?.id ?? null, respondido_at: new Date().toISOString() })
    .eq("id", informeId);
  if (error) return { error: error.message };
  await avisar(supabase, [inf.usuario_id as string], { tipo: "informe_respondido", titulo: "Dirección respondió tu informe semanal", url: "/informe" }, user?.id);
  revalidatePath("/", "layout");
  return { ok: true as const };
}
