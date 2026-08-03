import { createClient } from "@/lib/supabase/server";

/**
 * Storage privado: en la DB se guardan PATHS, nunca URLs.
 * La lectura se hace con URLs firmadas de 1 hora generadas en el servidor
 * (el chequeo de permisos es la política RLS de la entidad dueña + la sesión).
 */

const EXPIRACION_SEGUNDOS = 3600;

export async function firmarUrl(
  bucket: "servicio" | "documentos" | "cotizaciones",
  path: string | null
): Promise<string | null> {
  if (!path) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, EXPIRACION_SEGUNDOS);
  return data?.signedUrl ?? null;
}

/** Firma varias rutas en paralelo; conserva el orden. */
export async function firmarUrls(
  bucket: "servicio" | "documentos" | "cotizaciones",
  paths: (string | null)[]
): Promise<(string | null)[]> {
  return Promise.all(paths.map((p) => firmarUrl(bucket, p)));
}
