"use server";

// Pedidos de contenido a marketing (manual 4.6; v1.23 con aprobación):
// cualquiera pide → marketing lo toma, lo hace y sube lo que hizo → lo manda
// a aprobar → dirección aprueba o pide cambios → aprobado, los archivos pasan
// a un espacio de Material y marketing los acomoda donde quiera.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { esGestor } from "@/lib/puestos";
import { avisar, puestoActual, usuarioActual, usuariosDePuesto, type SupabaseServidor } from "./comun";

const hechoPor = (rol: string) => rol === "marketing" || esGestor(rol);
const urlPedido = (id: string) => `/marketing/pedidos/${id}`;

async function leerPedido(supabase: SupabaseServidor, id: string) {
  const { data } = await supabase
    .from("pedidos_material")
    .select("id, titulo, estado, pedido_por, tomado_por, espacio_destino_id")
    .eq("id", id)
    .maybeSingle();
  return data as { id: string; titulo: string; estado: string; pedido_por: string | null; tomado_por: string | null; espacio_destino_id: string | null } | null;
}

export async function pedirMaterial(input: { titulo: string; detalle?: string; paraFecha?: string | null }) {
  const titulo = input.titulo.trim();
  if (!titulo) return { error: "¿Qué contenido necesitás?" };
  const supabase = await createClient();
  const user = await usuarioActual();
  const { data, error } = await supabase
    .from("pedidos_material")
    .insert({
      pedido_por: user?.id ?? null,
      titulo,
      detalle: input.detalle?.trim() || null,
      para_fecha: input.paraFecha || null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  const marketing = await usuariosDePuesto(supabase, ["marketing", "direccion"]);
  await avisar(supabase, marketing, { tipo: "pedido_material", titulo: `Pedido de contenido: ${titulo}`, url: urlPedido(data.id as string) }, user?.id);
  revalidatePath("/", "layout");
  return { ok: true as const, id: data.id as string };
}

/** Fecha comprometida por marketing (y volver a "pedido" o "en curso" a mano). */
export async function actualizarPedidoMaterial(id: string, input: { estado: "pedido" | "en_curso"; fechaComprometida?: string | null }) {
  const supabase = await createClient();
  if (!hechoPor(await puestoActual(supabase))) return { error: "Lo actualiza marketing" };
  const p = await leerPedido(supabase, id);
  if (!p) return { error: "No se encontró el pedido" };
  if (!["pedido", "en_curso", "cambios"].includes(p.estado)) return { error: "El pedido ya está para aprobar o cerrado" };
  const user = await usuarioActual();
  const { error } = await supabase
    .from("pedidos_material")
    .update({
      estado: input.estado,
      fecha_comprometida: input.fechaComprometida || null,
      ...(input.estado === "en_curso" && !p.tomado_por ? { tomado_por: user?.id ?? null } : {}),
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** En qué espacio de Material queda cuando se apruebe. */
export async function elegirDestinoPedido(id: string, espacioId: string | null) {
  const supabase = await createClient();
  if (!hechoPor(await puestoActual(supabase))) return { error: "Lo elige marketing" };
  const { error } = await supabase.from("pedidos_material").update({ espacio_destino_id: espacioId || null }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** Marketing terminó: lo manda a dirección para que lo apruebe. */
export async function enviarPedidoAprobar(id: string) {
  const supabase = await createClient();
  if (!hechoPor(await puestoActual(supabase))) return { error: "Lo manda marketing" };
  const user = await usuarioActual();
  const p = await leerPedido(supabase, id);
  if (!p) return { error: "No se encontró el pedido" };
  if (!["pedido", "en_curso", "cambios"].includes(p.estado)) return { error: "El pedido ya está para aprobar o cerrado" };
  const { count } = await supabase.from("material_archivos").select("id", { count: "exact", head: true }).eq("dueno", "pedido").eq("dueno_id", id);
  if (!count) return { error: "Subí lo que hiciste antes de mandarlo a aprobar" };
  const { error } = await supabase
    .from("pedidos_material")
    .update({ estado: "para_aprobar", enviado_at: new Date().toISOString(), tomado_por: p.tomado_por ?? user?.id ?? null })
    .eq("id", id);
  if (error) return { error: error.message };
  const direccion = await usuariosDePuesto(supabase, ["direccion"]);
  await avisar(supabase, direccion, { tipo: "contenido_a_aprobar", titulo: `Para aprobar: ${p.titulo}`, url: urlPedido(id) }, user?.id);
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** El espacio "Pedidos aprobados" (si no está, se crea). */
async function espacioPorDefecto(supabase: SupabaseServidor): Promise<string | null> {
  const { data } = await supabase.from("material_espacios").select("id").eq("ambito", "general").eq("nombre", "Pedidos aprobados").maybeSingle();
  if (data) return data.id as string;
  const { data: nuevo } = await supabase
    .from("material_espacios")
    .insert({ ambito: "general", nombre: "Pedidos aprobados", descripcion: "Lo que dirección aprobó de los pedidos de contenido. Marketing lo acomoda donde corresponda." })
    .select("id")
    .single();
  return (nuevo?.id as string | undefined) ?? null;
}

/**
 * Dirección decide: aprobado (lo entregado pasa al espacio de Material
 * elegido o a "Pedidos aprobados"), cambios (con qué corregir) o cancelado.
 */
export async function decidirPedidoContenido(id: string, decision: "aprobado" | "cambios" | "cancelado", correccion?: string) {
  const supabase = await createClient();
  if ((await puestoActual(supabase)) !== "direccion") return { error: "Lo aprueba dirección" };
  const texto = correccion?.trim() ?? "";
  if (decision === "cambios" && !texto) return { error: "Escribí qué hay que cambiar" };
  const user = await usuarioActual();
  const p = await leerPedido(supabase, id);
  if (!p) return { error: "No se encontró el pedido" };
  if (["aprobado", "entregado", "cancelado"].includes(p.estado)) return { error: "El pedido ya está cerrado" };

  let espacioId: string | null = null;
  if (decision === "aprobado") {
    espacioId = p.espacio_destino_id ?? (await espacioPorDefecto(supabase));
    if (!espacioId) return { error: "No se pudo preparar el espacio de Material" };
    const { error: eMov } = await supabase
      .from("material_archivos")
      .update({ dueno: "espacio", dueno_id: espacioId, espacio: "propio", pedido_id: id })
      .eq("dueno", "pedido")
      .eq("dueno_id", id);
    if (eMov) return { error: `pasar a Material: ${eMov.message}` };
  }
  const { error } = await supabase
    .from("pedidos_material")
    .update({
      estado: decision,
      correccion: decision === "cambios" ? texto : texto || null,
      revisado_por: user?.id ?? null,
      revisado_at: new Date().toISOString(),
      ...(decision === "aprobado" ? { entregado_at: new Date().toISOString(), espacio_destino_id: espacioId } : {}),
    })
    .eq("id", id);
  if (error) return { error: error.message };

  const marketing = p.tomado_por ? [p.tomado_por] : await usuariosDePuesto(supabase, ["marketing"]);
  const titulo =
    decision === "aprobado" ? `Aprobado: ${p.titulo}` : decision === "cambios" ? `Cambios en: ${p.titulo}` : `Cancelado: ${p.titulo}`;
  await avisar(supabase, marketing, { tipo: "contenido_revisado", titulo, url: urlPedido(id) }, user?.id);
  if (decision === "aprobado" && p.pedido_por && !marketing.includes(p.pedido_por))
    await avisar(supabase, [p.pedido_por], { tipo: "material_entregado", titulo: `Listo: ${p.titulo}`, url: urlPedido(id) }, user?.id);
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** Quien lo pidió puede cancelarlo mientras marketing no lo mandó a aprobar. */
export async function cancelarPedidoMaterial(id: string) {
  const supabase = await createClient();
  const user = await usuarioActual();
  const p = await leerPedido(supabase, id);
  if (!p) return { error: "No se encontró el pedido" };
  const rol = await puestoActual(supabase);
  if (rol !== "direccion" && p.pedido_por !== user?.id) return { error: "Lo cancela quien lo pidió o dirección" };
  if (!["pedido", "en_curso", "cambios"].includes(p.estado)) return { error: "Ya no se puede cancelar" };
  const { error } = await supabase.from("pedidos_material").update({ estado: "cancelado" }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true as const };
}
