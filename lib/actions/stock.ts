"use server";

// Stock e ingresos previstos (lo mantiene administración; lo ven todos).

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirGestor } from "@/lib/auth";
import { hoyISO } from "@/lib/format";
import { NOTA_LLEGO_STOCK } from "@/lib/pendientes";
import { apartadoPorProducto, ventasSinEntregar, type VentaSinEntregar } from "@/lib/stock";
import { puestoActual, usuarioActual } from "./comun";

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

/**
 * "Llegó": marca un ingreso como recibido y suma las unidades al stock (de
 * forma atómica, fn_ajustar_stock). Es la única automatización del módulo
 * comercial: los intereses en lista de espera de ese producto pasan a
 * proximo_contacto = hoy con la nota "Llegó stock", y aparecen en el bloque
 * verde del inicio de cada vendedor. Nada más.
 */
export async function recibirIngresoStock(ingresoId: string) {
  const supabase = await createClient();
  // La mercadería la recibe el depósito (técnico) o administración (manual 4.3/4.4)
  const rol = await puestoActual(supabase);
  if (!["direccion", "admin", "administrativa", "servicio", "tecnico"].includes(rol))
    return { error: "La recepción la marca el depósito o administración" };
  const user = await usuarioActual();
  const { data: ing } = await supabase
    .from("ingresos_stock")
    .select("id, producto_id, cantidad, recibido_at, producto:productos(nombre)")
    .eq("id", ingresoId)
    .single();
  if (!ing) return { error: "No se encontró el ingreso" };
  if (ing.recibido_at) return { error: "Ese ingreso ya fue recibido" };

  const { data: nuevo, error: e1 } = await supabase.rpc("fn_ajustar_stock", {
    p_producto_id: ing.producto_id,
    p_delta: ing.cantidad,
  });
  if (e1) return { error: `sumar al stock: ${e1.message}` };
  const { error: e2 } = await supabase
    .from("ingresos_stock")
    .update({ recibido_at: new Date().toISOString() })
    .eq("id", ingresoId);
  if (e2) return { error: e2.message };

  // v1.22: lo que llega cubre primero lo ya vendido; a la lista de espera se le avisa si sobra
  const { data: sinEntregar } = await ventasSinEntregar(supabase);
  const apartado = apartadoPorProducto((sinEntregar ?? []) as unknown as VentaSinEntregar[])[ing.producto_id] ?? 0;
  const disponible = Number(nuevo ?? 0) - apartado;
  const { data: esperando } = await supabase
    .from("oportunidades")
    .select("id, cliente_id")
    .eq("etapa", "espera")
    .eq("producto_id", ing.producto_id);
  const nombreProducto =
    (ing.producto as unknown as { nombre: string } | null)?.nombre ?? "el producto";
  if (esperando?.length && disponible > 0) {
    // El técnico no edita intereses: el aviso a la lista de espera lo hace el sistema
    let db: typeof supabase = supabase;
    if (rol === "tecnico") {
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/\s+/g, "");
      if (serviceKey) {
        const { createClient: createAdmin } = await import("@supabase/supabase-js");
        db = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        }) as unknown as typeof supabase;
      }
    }
    const { error: e3 } = await db
      .from("oportunidades")
      .update({ proximo_contacto: hoyISO(), proximo_nota: NOTA_LLEGO_STOCK })
      .eq("etapa", "espera")
      .eq("producto_id", ing.producto_id);
    if (e3) return { error: `avisar a los que esperan: ${e3.message}` };
    await supabase.from("actividades").insert(
      esperando.map((o) => ({
        cliente_id: o.cliente_id,
        oportunidad_id: o.id,
        tipo: "stock",
        contenido: `Llegó stock de ${nombreProducto}`,
        created_by: user?.id ?? null,
      }))
    );
  }
  revalidatePath("/", "layout");
  return {
    ok: true as const,
    stock: nuevo as number,
    avisados: disponible > 0 ? (esperando?.length ?? 0) : 0,
    aviso:
      esperando?.length && disponible <= 0
        ? `Lo que llegó cubre ventas ya hechas (${apartado} apartadas): no se avisó a la lista de espera`
        : undefined,
  };
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
