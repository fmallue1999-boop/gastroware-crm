"use server";

// Pedidos de material a marketing (manual 4.6): comercial y dirección piden,
// marketing compromete fecha y marca entregado.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { esGestor } from "@/lib/puestos";
import { avisar, puestoActual, usuarioActual, usuariosDePuesto } from "./comun";

export async function pedirMaterial(input: { titulo: string; detalle?: string; paraFecha?: string | null }) {
  const titulo = input.titulo.trim();
  if (!titulo) return { error: "¿Qué material necesitás?" };
  const supabase = await createClient();
  const user = await usuarioActual();
  const { error } = await supabase.from("pedidos_material").insert({
    pedido_por: user?.id ?? null,
    titulo,
    detalle: input.detalle?.trim() || null,
    para_fecha: input.paraFecha || null,
  });
  if (error) return { error: error.message };
  const marketing = await usuariosDePuesto(supabase, ["marketing", "direccion"]);
  await avisar(supabase, marketing, { tipo: "pedido_material", titulo: `Pedido de material: ${titulo}`, url: "/marketing/pedidos" }, user?.id);
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function actualizarPedidoMaterial(id: string, input: { estado: "pedido" | "en_curso" | "entregado"; fechaComprometida?: string | null }) {
  const supabase = await createClient();
  const rol = await puestoActual(supabase);
  if (rol !== "marketing" && !esGestor(rol)) return { error: "Lo actualiza marketing" };
  const user = await usuarioActual();
  const { data: p } = await supabase.from("pedidos_material").select("titulo, pedido_por").eq("id", id).maybeSingle();
  if (!p) return { error: "No se encontró el pedido" };
  const { error } = await supabase
    .from("pedidos_material")
    .update({
      estado: input.estado,
      fecha_comprometida: input.fechaComprometida || null,
      entregado_at: input.estado === "entregado" ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  if (input.estado === "entregado")
    await avisar(supabase, [p.pedido_por as string | null], { tipo: "material_entregado", titulo: `Material listo: ${p.titulo}`, url: "/marketing/pedidos" }, user?.id);
  revalidatePath("/", "layout");
  return { ok: true as const };
}
