import { createClient } from "@/lib/supabase/server";

/**
 * Storage privado: en la DB se guardan PATHS, nunca URLs.
 * La lectura se hace con URLs firmadas de 1 hora generadas en el servidor
 * (el chequeo de permisos es la política RLS de la entidad dueña + la sesión).
 */

const EXPIRACION_SEGUNDOS = 3600;

export type Bucket = "servicio" | "documentos" | "cotizaciones" | "contenidos" | "material";

export async function firmarUrl(
  bucket: Bucket,
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
  bucket: Bucket,
  paths: (string | null)[]
): Promise<(string | null)[]> {
  return Promise.all(paths.map((p) => firmarUrl(bucket, p)));
}

/** Varias rutas de un bucket en una sola llamada (galerías): path → URL firmada. */
export async function firmarLote(bucket: Bucket, paths: string[], segundos = EXPIRACION_SEGUNDOS): Promise<Map<string, string>> {
  const unicos = [...new Set(paths.filter(Boolean))];
  if (!unicos.length) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.storage.from(bucket).createSignedUrls(unicos, segundos);
  return new Map((data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path as string, d.signedUrl as string]));
}
