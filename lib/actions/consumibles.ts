"use server";

// Consumibles (migración 031): venta con cantidades, plan de reposición por
// cliente/sucursal/producto y las acciones del seguimiento (contactar,
// reprogramar, suspender, cotizar). La fecha estimada nunca genera ventas ni
// mensajes solos: solo avisa a quién contactar.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fechaCorta, hoyISO } from "@/lib/format";
import { MEDIOS, RESULTADOS, textoActividad } from "@/lib/actividad";
import { cantidadTexto, fechaContacto, ANTICIPACION_POR_DEFECTO } from "@/lib/consumibles";
import { usuarioActual } from "./comun";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export type ItemVentaConsumible = {
  productoId: string;
  cantidad: number;
  unidad?: string | null;
  /** Cada cuántos días repone (null = todavía no se sabe). */
  frecuencia?: number | null;
  /** Cuántos días antes contactar. */
  anticipacion?: number;
  /** Fecha de contacto elegida a mano (si no se sabe la frecuencia). */
  fechaContacto?: string | null;
};

export async function registrarVentaConsumibles(input: {
  clienteId: string;
  sucursalId?: string | null;
  fecha: string;
  items: ItemVentaConsumible[];
  monto?: number | null;
  moneda?: "ARS" | "USD";
  responsableId?: string | null;
  nota?: string;
}) {
  if (!input.clienteId) return { error: "Elegí el cliente" };
  if (!FECHA.test(input.fecha) || input.fecha > hoyISO()) return { error: "La fecha de compra no puede ser futura" };
  const items = input.items.filter((i) => i.productoId && i.cantidad > 0);
  if (!items.length) return { error: "Elegí al menos un producto con su cantidad" };
  for (const i of items) {
    if (i.frecuencia != null && (!Number.isInteger(i.frecuencia) || i.frecuencia < 1 || i.frecuencia > 730)) return { error: "La frecuencia va de 1 a 730 días" };
    if (i.anticipacion != null && (i.anticipacion < 0 || i.anticipacion > 90)) return { error: "La anticipación va de 0 a 90 días" };
    if (i.fechaContacto && !FECHA.test(i.fechaContacto)) return { error: "La fecha de contacto no es válida" };
  }
  const supabase = await createClient();
  const user = await usuarioActual();
  if (!user) return { error: "Sesión vencida: volvé a entrar" };

  const [{ data: cliente }, { data: productos }] = await Promise.all([
    supabase.from("clientes").select("id, comercial_id").eq("id", input.clienteId).maybeSingle(),
    supabase.from("productos").select("id, nombre, es_consumible").in("id", items.map((i) => i.productoId)),
  ]);
  if (!cliente) return { error: "No se encontró el cliente" };
  const nombreDe = new Map(((productos ?? []) as { id: string; nombre: string; es_consumible: boolean }[]).map((p) => [p.id, p]));
  if (items.some((i) => !nombreDe.get(i.productoId)?.es_consumible)) return { error: "Hay un producto que no es consumible" };
  const detalle = items.map((i) => `${cantidadTexto(i.cantidad, i.unidad)} ${nombreDe.get(i.productoId)?.nombre ?? ""}`.trim()).join(" · ");

  // La venta: una operación del apartado consumibles, que sigue el circuito (facturar, cobrar, entregar)
  const { data: opp, error } = await supabase
    .from("oportunidades")
    .insert({
      cliente_id: input.clienteId,
      sucursal_id: input.sucursalId || null,
      producto_id: items[0].productoId,
      productos_extra: items.slice(1).map((i) => i.productoId),
      linea: "consumibles",
      comercial_id: (cliente.comercial_id as string | null) ?? user.id,
      origen: "Reposición",
      pedido: "general",
      etapa: "nueva",
      monto_estimado: input.monto || null,
      moneda: input.moneda === "USD" ? "USD" : "ARS",
      mensaje_inicial: detalle.slice(0, 200),
    })
    .select("id")
    .single();
  if (error || !opp) return { error: error?.message ?? "No se pudo registrar la venta" };

  const { error: errItems } = await supabase.from("oportunidad_items").insert(
    items.map((i) => ({ oportunidad_id: opp.id, producto_id: i.productoId, cantidad: i.cantidad, unidad: i.unidad || null }))
  );
  if (errItems) return { error: errItems.message };

  // Ganada con la fecha de compra: actualiza (o crea) el plan de cada producto
  const { error: errGanar } = await supabase.rpc("fn_ganar_venta", { p_oportunidad_id: opp.id, p_fecha_compra: input.fecha });
  if (errGanar) return { error: `cerrar la venta: ${errGanar.message}` };

  // Lo que se eligió en el formulario (frecuencia, anticipación, fecha, responsable)
  for (const i of items) {
    let q = supabase.from("recurrencias").select("id").eq("cliente_id", input.clienteId).eq("producto_id", i.productoId).eq("activa", true);
    q = input.sucursalId ? q.eq("sucursal_id", input.sucursalId) : q.is("sucursal_id", null);
    const { data: plan } = await q.maybeSingle();
    if (!plan) continue;
    const anticipacion = i.anticipacion ?? ANTICIPACION_POR_DEFECTO;
    const cambios: Record<string, unknown> = {
      anticipacion_dias: anticipacion,
      proxima_alerta: i.fechaContacto || fechaContacto(input.fecha, i.frecuencia ?? null, anticipacion),
    };
    if (i.frecuencia !== undefined) cambios.frecuencia_dias = i.frecuencia;
    if (input.responsableId) cambios.responsable_id = input.responsableId;
    await supabase.from("recurrencias").update(cambios).eq("id", plan.id);
  }

  await supabase.from("actividades").insert({
    cliente_id: input.clienteId,
    oportunidad_id: opp.id,
    tipo: "nota",
    contenido: `Venta de consumibles: ${detalle}${input.nota?.trim() ? ` — ${input.nota.trim()}` : ""}`,
    created_by: user.id,
  });

  revalidatePath("/", "layout");
  return { ok: true as const, oportunidadId: opp.id as string };
}

type PlanBase = { id: string; cliente_id: string; producto: { nombre: string } | null };

async function planes(supabase: Awaited<ReturnType<typeof createClient>>, ids: string[]) {
  const { data } = await supabase.from("recurrencias").select("id, cliente_id, producto:productos(nombre)").in("id", ids);
  return (data ?? []) as unknown as PlanBase[];
}

const nombresProductos = (lista: PlanBase[]) => lista.map((p) => p.producto?.nombre ?? "consumible").join(", ");

/** Registrar el contacto por la reposición y, si tiene stock, cuándo volver a contactar. */
export async function contactoReposicion(
  ids: string[],
  input: { medio?: string | null; resultado?: string | null; nota?: string; volverEl?: string | null; motivo?: string | null }
) {
  if (!ids.length) return { error: "No hay productos elegidos" };
  const medio = MEDIOS.some((m) => m.value === input.medio) ? input.medio! : null;
  const resultado = input.resultado && input.resultado in RESULTADOS ? input.resultado : null;
  if (!medio && !input.nota?.trim() && !input.volverEl) return { error: "Elegí cómo fue o escribí qué pasó" };
  if (input.volverEl && (!FECHA.test(input.volverEl) || input.volverEl < hoyISO())) return { error: "Elegí una fecha de hoy en adelante" };
  const supabase = await createClient();
  const user = await usuarioActual();
  const lista = await planes(supabase, ids);
  if (!lista.length) return { error: "No se encontró la reposición" };

  const partes = [
    `Reposición de ${nombresProductos(lista)}`,
    textoActividad(medio, resultado),
    input.nota?.trim(),
    input.volverEl ? `volver a contactar el ${fechaCorta(input.volverEl)}${input.motivo?.trim() ? ` (${input.motivo.trim()})` : ""}` : null,
  ].filter(Boolean);
  const { error } = await supabase.from("actividades").insert({
    cliente_id: lista[0].cliente_id,
    tipo: "nota",
    contenido: partes.join(" · "),
    medio,
    resultado,
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };
  if (input.volverEl) {
    const { error: e2 } = await supabase.from("recurrencias").update({ proxima_alerta: input.volverEl }).in("id", ids);
    if (e2) return { error: e2.message };
  }
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** Reprogramar (por ejemplo, todavía tiene stock). La fecha anterior queda en el historial. */
export async function reprogramarReposicion(ids: string[], fecha: string, motivo?: string) {
  return contactoReposicion(ids, { volverEl: fecha, motivo: motivo || "reprogramado" });
}

/** Suspender la reposición con el motivo (deja de avisar; se puede reactivar). */
export async function suspenderReposicion(ids: string[], motivo: string) {
  if (!motivo.trim()) return { error: "Elegí el motivo" };
  const supabase = await createClient();
  const user = await usuarioActual();
  const lista = await planes(supabase, ids);
  if (!lista.length) return { error: "No se encontró la reposición" };
  const { error } = await supabase
    .from("recurrencias")
    .update({ activa: false, motivo_suspension: motivo.trim().slice(0, 200), suspendida_at: new Date().toISOString() })
    .in("id", ids);
  if (error) return { error: error.message };
  await supabase.from("actividades").insert({
    cliente_id: lista[0].cliente_id,
    tipo: "nota",
    contenido: `Reposición suspendida: ${nombresProductos(lista)} (${motivo.trim()})`,
    created_by: user?.id ?? null,
  });
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function reactivarReposicion(id: string, fecha: string) {
  if (!FECHA.test(fecha)) return { error: "Elegí la fecha de contacto" };
  const supabase = await createClient();
  const user = await usuarioActual();
  const lista = await planes(supabase, [id]);
  if (!lista.length) return { error: "No se encontró la reposición" };
  const { error } = await supabase
    .from("recurrencias")
    .update({ activa: true, motivo_suspension: null, suspendida_at: null, proxima_alerta: fecha })
    .eq("id", id);
  if (error) return { error: error.code === "23505" ? "Ya hay otra reposición activa de ese producto" : error.message };
  await supabase.from("actividades").insert({
    cliente_id: lista[0].cliente_id,
    tipo: "nota",
    contenido: `Reposición reactivada: ${nombresProductos(lista)}, contactar el ${fechaCorta(fecha)}`,
    created_by: user?.id ?? null,
  });
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** Ajustar el plan: frecuencia, anticipación, responsable (recalcula el contacto desde la última compra). */
export async function ajustarReposicion(id: string, input: { frecuencia: number | null; anticipacion: number; responsableId?: string | null; fecha?: string | null }) {
  if (input.frecuencia != null && (!Number.isInteger(input.frecuencia) || input.frecuencia < 1 || input.frecuencia > 730)) return { error: "La frecuencia va de 1 a 730 días" };
  if (input.anticipacion < 0 || input.anticipacion > 90) return { error: "La anticipación va de 0 a 90 días" };
  const supabase = await createClient();
  const { data: plan } = await supabase.from("recurrencias").select("ultima_compra").eq("id", id).maybeSingle();
  if (!plan) return { error: "No se encontró la reposición" };
  const cambios: Record<string, unknown> = { frecuencia_dias: input.frecuencia, anticipacion_dias: input.anticipacion };
  if (input.responsableId !== undefined) cambios.responsable_id = input.responsableId || null;
  if (input.fecha && FECHA.test(input.fecha)) cambios.proxima_alerta = input.fecha;
  else if (plan.ultima_compra) cambios.proxima_alerta = fechaContacto(plan.ultima_compra as string, input.frecuencia, input.anticipacion);
  const { error } = await supabase.from("recurrencias").update(cambios).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** Cotizar la reposición: abre un interés de consumibles en la ficha para armar la cotización. */
export async function cotizarReposicion(ids: string[]) {
  const supabase = await createClient();
  const user = await usuarioActual();
  const { data } = await supabase.from("recurrencias").select("cliente_id, producto_id, cliente:clientes(comercial_id)").in("id", ids);
  const lista = (data ?? []) as unknown as { cliente_id: string; producto_id: string; cliente: { comercial_id: string | null } | null }[];
  if (!lista.length) return { error: "No se encontró la reposición" };
  const { data: opp, error } = await supabase
    .from("oportunidades")
    .insert({
      cliente_id: lista[0].cliente_id,
      producto_id: lista[0].producto_id,
      productos_extra: lista.slice(1).map((p) => p.producto_id),
      linea: "consumibles",
      comercial_id: lista[0].cliente?.comercial_id ?? user?.id ?? null,
      origen: "Reposición",
      pedido: "precio",
      etapa: "nueva",
      primer_contacto_at: new Date().toISOString(),
      mensaje_inicial: "Reposición de consumibles",
    })
    .select("id")
    .single();
  if (error || !opp) return { error: error?.message ?? "No se pudo crear" };
  revalidatePath("/", "layout");
  return { ok: true as const, clienteId: lista[0].cliente_id, oportunidadId: opp.id as string };
}

/** Sucursales de un cliente (para elegir dónde se repone). */
export async function sucursalesDe(clienteId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sucursales")
    .select("id, nombre, ciudad")
    .eq("cliente_id", clienteId)
    .is("deleted_at", null)
    .order("es_principal", { ascending: false });
  return (data ?? []) as { id: string; nombre: string; ciudad: string | null }[];
}
