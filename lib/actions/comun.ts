import { createClient } from "@/lib/supabase/server";
import { avisarAlCelular } from "@/lib/servidor/push";

export type SupabaseServidor = Awaited<ReturnType<typeof createClient>>;

/** Usuario logueado (o null). Lo usan todas las acciones para firmar movimientos. */
export async function usuarioActual() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Puesto (rol) del usuario logueado. */
export async function puestoActual(supabase: SupabaseServidor): Promise<string> {
  const { data } = await supabase.rpc("fn_rol");
  return (data as string) ?? "comercial";
}

/**
 * Usuarios activos de uno o varios puestos, en orden de preferencia: si no
 * hay nadie en el primero, se usa el siguiente (un puesto vacante lo cubre
 * quien dice el manual).
 */
export async function usuariosDePuesto(
  supabase: SupabaseServidor,
  puestos: string[]
): Promise<string[]> {
  const { data } = await supabase.from("usuarios").select("id, rol").eq("activo", true).in("rol", puestos);
  const filas = (data ?? []) as { id: string; rol: string }[];
  for (const p of puestos) {
    const ids = filas.filter((u) => u.rol === p).map((u) => u.id);
    if (ids.length) return ids;
  }
  return [];
}

/** Deja un aviso en la campana de cada usuario (sin repetir al que lo genera) y lo manda al celular. */
export async function avisar(
  supabase: SupabaseServidor,
  usuarioIds: (string | null | undefined)[],
  aviso: { tipo: string; titulo: string; url?: string | null; cuerpo?: string | null },
  excepto?: string | null
) {
  const ids = [...new Set(usuarioIds.filter((u): u is string => Boolean(u) && u !== excepto))];
  if (!ids.length) return;
  await supabase.from("notificaciones").insert(
    ids.map((usuario_id) => ({
      usuario_id,
      tipo: aviso.tipo,
      titulo: aviso.titulo.slice(0, 200),
      cuerpo: aviso.cuerpo ?? null,
      url: aviso.url ?? null,
    }))
  );
  avisarAlCelular();
}

/** Valor de una regla de Administración → Reglas (tabla config). */
export async function regla(supabase: SupabaseServidor, clave: string): Promise<string | null> {
  const { data } = await supabase.from("config").select("valor").eq("clave", clave).maybeSingle();
  return (data?.valor as string | null | undefined) ?? null;
}
