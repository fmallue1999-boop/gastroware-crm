import { createClient } from "@/lib/supabase/server";

/** Rol del usuario logueado según la tabla usuarios (fn_rol en la base). */
export async function rolActual(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("fn_rol");
  return (data as string) ?? "comercial";
}

export const ROLES_GESTOR = ["direccion", "admin"] as const;

/**
 * Chequeo de servidor para acciones reservadas a dirección/administración.
 * Devuelve `{ error }` en vez de lanzar: las acciones del servidor de este
 * proyecto responden siempre `{ error: string }` y el formulario lo muestra
 * (una excepción lanzada llega al navegador como error genérico).
 *
 *   const bloqueo = await exigirGestor();
 *   if (bloqueo) return bloqueo;
 */
export async function exigirGestor(): Promise<{ error: string } | null> {
  const rol = await rolActual();
  return (ROLES_GESTOR as readonly string[]).includes(rol)
    ? null
    : { error: "Acción reservada a dirección o administración" };
}
