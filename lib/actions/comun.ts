import { createClient } from "@/lib/supabase/server";

export type SupabaseServidor = Awaited<ReturnType<typeof createClient>>;

/** Usuario logueado (o null). Lo usan todas las acciones para firmar movimientos. */
export async function usuarioActual() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
