"use server";

// Cobranzas (manual 4.4): facturas del CRM con vencimiento, cobro, promesa,
// reclamo y la condición que aprueba dirección para despachar sin cobro.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hoyISO } from "@/lib/format";
import { esGestor, factura as puedeFacturar } from "@/lib/puestos";
import { liberarVenta } from "@/lib/servidor/ventas";
import { puestoActual, usuarioActual } from "./comun";

type FacturaFila = {
  id: string;
  cliente_id: string;
  oportunidad_id: string | null;
  ot_id: string | null;
  numero: string;
  cobro_estado: string;
};

async function leerFactura(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  const { data } = await supabase
    .from("facturas")
    .select("id, cliente_id, oportunidad_id, ot_id, numero, cobro_estado")
    .eq("id", id)
    .maybeSingle();
  return (data as FacturaFila | null) ?? null;
}

async function nota(
  supabase: Awaited<ReturnType<typeof createClient>>,
  f: FacturaFila,
  contenido: string,
  userId?: string | null
) {
  await supabase.from("actividades").insert({
    cliente_id: f.cliente_id,
    oportunidad_id: f.oportunidad_id,
    tipo: "cobranza",
    contenido,
    created_by: userId ?? null,
  });
}

/** Cobro acreditado. Si la factura es de una venta, la libera para preparar. */
export async function registrarCobro(facturaId: string, input?: { fecha?: string; nota?: string }) {
  const supabase = await createClient();
  if (!puedeFacturar(await puestoActual(supabase))) return { error: "Los cobros los registra administración" };
  const user = await usuarioActual();
  const f = await leerFactura(supabase, facturaId);
  if (!f) return { error: "No se encontró la factura" };
  if (f.cobro_estado === "cobrado") return { ok: true as const };
  const fecha = input?.fecha && /^\d{4}-\d{2}-\d{2}$/.test(input.fecha) ? input.fecha : null;
  const { error } = await supabase
    .from("facturas")
    .update({
      cobro_estado: "cobrado",
      cobrado_at: fecha ? `${fecha}T15:00:00.000Z` : new Date().toISOString(),
      promesa_fecha: null,
    })
    .eq("id", facturaId);
  if (error) return { error: error.message };
  await nota(supabase, f, `Cobro registrado · factura ${f.numero}${input?.nota?.trim() ? ` · ${input.nota.trim()}` : ""}`, user?.id);

  let aviso: string | undefined;
  if (f.oportunidad_id) {
    const r = await liberarVenta(supabase, f.oportunidad_id, { porCondicion: false, userId: user?.id });
    aviso = r.aviso;
  }
  if (f.ot_id) {
    await supabase.from("ordenes_trabajo").update({ cobro_ok_at: new Date().toISOString() }).eq("id", f.ot_id).is("cobro_ok_at", null);
  }
  revalidatePath("/", "layout");
  return { ok: true as const, aviso };
}

/** El cliente prometió pagar en una fecha. */
export async function registrarPromesa(facturaId: string, fecha: string, comentario?: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: "Elegí la fecha que prometió" };
  const supabase = await createClient();
  if (!puedeFacturar(await puestoActual(supabase))) return { error: "Las cobranzas las lleva administración" };
  const user = await usuarioActual();
  const f = await leerFactura(supabase, facturaId);
  if (!f) return { error: "No se encontró la factura" };
  const { error } = await supabase
    .from("facturas")
    .update({ cobro_estado: "prometido", promesa_fecha: fecha, ultimo_reclamo_at: new Date().toISOString() })
    .eq("id", facturaId);
  if (error) return { error: error.message };
  await nota(supabase, f, `Cobranza · factura ${f.numero}: prometió pagar el ${fecha.split("-").reverse().join("/")}${comentario?.trim() ? ` · ${comentario.trim()}` : ""}`, user?.id);
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** Se reclamó y no respondió. */
export async function registrarSinRespuesta(facturaId: string) {
  const supabase = await createClient();
  if (!puedeFacturar(await puestoActual(supabase))) return { error: "Las cobranzas las lleva administración" };
  const user = await usuarioActual();
  const f = await leerFactura(supabase, facturaId);
  if (!f) return { error: "No se encontró la factura" };
  const { error } = await supabase
    .from("facturas")
    .update({ cobro_estado: "sin_respuesta", ultimo_reclamo_at: new Date().toISOString() })
    .eq("id", facturaId);
  if (error) return { error: error.message };
  await nota(supabase, f, `Cobranza · factura ${f.numero}: reclamada, sin respuesta`, user?.id);
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/**
 * Dirección aprueba despachar sin el cobro acreditado (o pese al atraso del
 * cliente). Queda firmado quién y por qué; la venta pasa a preparar.
 */
export async function aprobarCondicion(facturaId: string, motivo: string) {
  if (!motivo.trim()) return { error: "Anotá la condición (plazo, cheque, anticipo…)" };
  const supabase = await createClient();
  if (!esGestor(await puestoActual(supabase))) return { error: "La condición la aprueba dirección" };
  const user = await usuarioActual();
  const f = await leerFactura(supabase, facturaId);
  if (!f) return { error: "No se encontró la factura" };
  const { error } = await supabase
    .from("facturas")
    .update({
      condicion_aprobada_por: user?.id ?? null,
      condicion_aprobada_at: new Date().toISOString(),
      condicion_nota: motivo.trim(),
    })
    .eq("id", facturaId);
  if (error) return { error: error.message };
  await nota(supabase, f, `Condición aprobada por dirección · factura ${f.numero}: ${motivo.trim()}`, user?.id);
  if (f.oportunidad_id) await liberarVenta(supabase, f.oportunidad_id, { porCondicion: true, userId: user?.id });
  if (f.ot_id)
    await supabase.from("ordenes_trabajo").update({ cobro_ok_at: new Date().toISOString() }).eq("id", f.ot_id).is("cobro_ok_at", null);
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/**
 * Factura cargada a mano (service, consumible o repuesto que no salió de
 * una venta del embudo). Queda en Cobranzas con su vencimiento.
 */
export async function cargarFactura(input: {
  clienteId: string;
  tipo: "venta" | "servicio" | "consumible" | "repuesto";
  numero: string;
  fecha?: string;
  vencimiento?: string | null;
  monto: number | null;
  moneda?: string;
  sucursalId?: string | null;
  otId?: string | null;
  oportunidadId?: string | null;
  nota?: string;
}) {
  const numero = input.numero.trim();
  if (!numero) return { error: "Falta el número de factura" };
  if (!input.clienteId) return { error: "Elegí el cliente" };
  const supabase = await createClient();
  if (!puedeFacturar(await puestoActual(supabase))) return { error: "Factura administración" };
  const user = await usuarioActual();
  const fecha = input.fecha && /^\d{4}-\d{2}-\d{2}$/.test(input.fecha) ? input.fecha : hoyISO();
  const { data, error } = await supabase
    .from("facturas")
    .insert({
      cliente_id: input.clienteId,
      sucursal_id: input.sucursalId || null,
      ot_id: input.otId || null,
      oportunidad_id: input.oportunidadId || null,
      tipo: input.tipo,
      numero,
      fecha,
      vencimiento: input.vencimiento || fecha,
      monto: input.monto,
      moneda: input.moneda || "ARS",
      nota: input.nota?.trim() || null,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "No se pudo guardar la factura" };
  await supabase.from("actividades").insert({
    cliente_id: input.clienteId,
    tipo: "cobranza",
    contenido: `Factura ${numero} cargada (${input.tipo})`,
    created_by: user?.id ?? null,
  });
  revalidatePath("/", "layout");
  return { ok: true as const, id: data.id as string };
}
