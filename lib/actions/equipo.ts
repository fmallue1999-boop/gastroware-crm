"use server";

// Equipo y reglas del modelo por puestos: territorios con responsable,
// técnicos aliados, reglas "a definir" del manual y videos por modelo.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { esGestor, controlaServicio } from "@/lib/puestos";
import { puestoActual } from "./comun";

/** Responsable de un territorio (vacío = vacante: responde dirección general). */
export async function asignarResponsableTerritorio(codigo: string, usuarioId: string | null) {
  const supabase = await createClient();
  if (!esGestor(await puestoActual(supabase))) return { error: "Los territorios los asigna dirección" };
  const { error } = await supabase
    .from("territorios")
    .update({ responsable_id: usuarioId || null })
    .eq("codigo", codigo);
  if (error) return { error: error.message };
  if (usuarioId) await supabase.from("usuarios").update({ territorio: codigo }).eq("id", usuarioId);
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** Alta o edición de un técnico aliado (tercero, sin usuario). */
export async function guardarAliado(input: {
  id?: string | null;
  nombre: string;
  zona?: string;
  telefono?: string;
  email?: string;
  tarifa?: string;
  notas?: string;
  activo?: boolean;
}) {
  const nombre = input.nombre.trim();
  if (!nombre) return { error: "Poné el nombre del aliado" };
  const supabase = await createClient();
  if (!controlaServicio(await puestoActual(supabase))) return { error: "Los aliados los gestiona servicio técnico o dirección" };
  const fila = {
    nombre,
    zona: input.zona?.trim() || null,
    telefono: input.telefono?.trim() || null,
    email: input.email?.trim().toLowerCase() || null,
    tarifa: input.tarifa?.trim() || null,
    notas: input.notas?.trim() || null,
    activo: input.activo ?? true,
  };
  const { error } = input.id
    ? await supabase.from("tecnicos_aliados").update(fila).eq("id", input.id)
    : await supabase.from("tecnicos_aliados").insert(fila);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** Reglas que el manual deja "a definir" (Administración → Reglas). */
const REGLAS_CLAVES = [
  "dias_atraso_frena_despacho",
  "descuento_libre_pct",
  "plazo_pago_aliados_dias",
  "tarifa_hora",
] as const;

export async function guardarReglas(valores: Record<string, string>) {
  const supabase = await createClient();
  if (!esGestor(await puestoActual(supabase))) return { error: "Las reglas las define dirección" };
  const filas = Object.entries(valores)
    .filter(([clave]) => (REGLAS_CLAVES as readonly string[]).includes(clave))
    .map(([clave, valor]) => ({ clave, valor: valor.trim() }));
  for (const f of filas) {
    if (f.clave !== "plazo_pago_aliados_dias" && f.valor !== "" && !Number.isFinite(Number(f.valor.replace(",", "."))))
      return { error: `El valor de ${f.clave.replace(/_/g, " ")} tiene que ser un número` };
  }
  const { error } = await supabase.from("config").upsert(filas, { onConflict: "clave" });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** Video instructivo de un modelo (marketing o dirección). */
export async function guardarVideoProducto(productoId: string, url: string) {
  const limpio = url.trim();
  if (limpio && !/^https?:\/\//i.test(limpio)) return { error: "Pegá el link completo (https://…)" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_set_video_producto", { p_producto_id: productoId, p_url: limpio });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true as const };
}
