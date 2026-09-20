"use server";

// Stock e ingresos previstos (lo mantiene administración; lo ven todos).

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirGestor } from "@/lib/auth";
import { usuarioActual } from "./comun";

// =====================================================================
// Stock e ingresos previstos (lo mantiene administración; lo ven todos)
// =====================================================================

export async function guardarStock(productoId: string, stock: number) {
  const bloqueo = await exigirGestor();
  if (bloqueo) return bloqueo;
  const supabase = await createClient();
  const { error } = await supabase
    .from("productos")
    .update({ stock: Math.max(0, Math.round(Number(stock) || 0)) })
    .eq("id", productoId);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function crearIngresoStock(input: {
  productoId: string;
  cantidad: number;
  fechaEstimada?: string | null;
  nota?: string;
}) {
  const bloqueo = await exigirGestor();
  if (bloqueo) return bloqueo;
  const cantidad = Math.round(Number(input.cantidad) || 0);
  if (cantidad <= 0) return { error: "Poné cuántas unidades van a entrar" };
  const supabase = await createClient();
  const user = await usuarioActual();
  const { error } = await supabase.from("ingresos_stock").insert({
    producto_id: input.productoId,
    cantidad,
    fecha_estimada: input.fechaEstimada || null,
    nota: input.nota?.trim() || null,
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** Marca un ingreso como recibido: suma las unidades al stock del producto. */
export async function recibirIngresoStock(ingresoId: string) {
  const bloqueo = await exigirGestor();
  if (bloqueo) return bloqueo;
  const supabase = await createClient();
  const { data: ing } = await supabase
    .from("ingresos_stock")
    .select("id, producto_id, cantidad, recibido_at")
    .eq("id", ingresoId)
    .single();
  if (!ing) return { error: "No se encontró el ingreso" };
  if (ing.recibido_at) return { error: "Ese ingreso ya fue recibido" };
  const { data: prod } = await supabase
    .from("productos")
    .select("stock")
    .eq("id", ing.producto_id)
    .single();
  const nuevo = (prod?.stock ?? 0) + ing.cantidad;
  const { error: e1 } = await supabase
    .from("productos")
    .update({ stock: nuevo })
    .eq("id", ing.producto_id);
  if (e1) return { error: e1.message };
  const { error: e2 } = await supabase
    .from("ingresos_stock")
    .update({ recibido_at: new Date().toISOString() })
    .eq("id", ingresoId);
  if (e2) return { error: e2.message };
  revalidatePath("/", "layout");
  return { ok: true as const, stock: nuevo };
}

export async function borrarIngresoStock(ingresoId: string) {
  const bloqueo = await exigirGestor();
  if (bloqueo) return bloqueo;
  const supabase = await createClient();
  const { error } = await supabase.from("ingresos_stock").delete().eq("id", ingresoId);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true as const };
}
