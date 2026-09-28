import { CLAVES_MARCA, MARCA_POR_DEFECTO, marcaDesdeConfig, type Marca } from "@/lib/marca";
import type { SupabaseServidor } from "@/lib/actions/comun";

const CLAVES = Object.values(CLAVES_MARCA);

/** Marca del sistema leída con la sesión del usuario. */
export async function cargarMarca(supabase: SupabaseServidor): Promise<Marca> {
  const { data } = await supabase.from("config").select("clave, valor").in("clave", CLAVES);
  return marcaDesdeConfig(Object.fromEntries(((data ?? []) as { clave: string; valor: string }[]).map((c) => [c.clave, c.valor])));
}

/**
 * Marca para pantallas sin sesión (ingreso): se lee con la clave de servicio
 * solo las claves marca_*. Sin clave, la de GastroWare por defecto.
 */
export async function cargarMarcaPublica(): Promise<Marca> {
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/\s+/g, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!clave || !url) return MARCA_POR_DEFECTO;
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(url, clave, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data } = await admin.from("config").select("clave, valor").in("clave", CLAVES);
    return marcaDesdeConfig(Object.fromEntries(((data ?? []) as { clave: string; valor: string }[]).map((c) => [c.clave, c.valor])));
  } catch {
    return MARCA_POR_DEFECTO;
  }
}
