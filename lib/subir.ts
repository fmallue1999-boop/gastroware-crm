import { Upload } from "tus-js-client";
import { createClient } from "@/lib/supabase/client";

/**
 * Subir un archivo desde el navegador a un bucket privado (v1.10). Los
 * chicos van en una sola subida; los grandes (videos) por partes de 6 MB,
 * que resisten cortes de conexión y muestran el avance.
 */

/** Máximo que acepta la app por archivo. El plan de Supabase puede aceptar menos. */
export const MAX_ARCHIVO_MB = 500;
const PARTE = 6 * 1024 * 1024;

export const pesoTexto = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** Nombre seguro para el almacenamiento (el nombre original se guarda aparte). */
export const nombreSeguro = (nombre: string) =>
  nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w.\-]/g, "_")
    .slice(-120);

function mensajeError(texto: string, archivo: File): string {
  if (/maximum allowed size|too large|413|exceeded/i.test(texto))
    return `“${archivo.name}” pesa ${pesoTexto(archivo.size)} y supera el máximo que acepta el almacenamiento hoy (el plan gratis de Supabase permite 50 MB por archivo).`;
  if (/mime|content type|not allowed/i.test(texto)) return `“${archivo.name}”: ese tipo de archivo no está permitido acá.`;
  return `No se pudo subir “${archivo.name}”: ${texto}`;
}

export async function subirArchivo(
  bucket: string,
  path: string,
  archivo: File,
  onAvance?: (porcentaje: number) => void
): Promise<{ error?: string }> {
  if (archivo.size > MAX_ARCHIVO_MB * 1024 * 1024)
    return { error: `“${archivo.name}” pesa ${pesoTexto(archivo.size)}: el máximo es ${MAX_ARCHIVO_MB} MB por archivo.` };
  const supabase = createClient();

  if (archivo.size <= PARTE) {
    const { error } = await supabase.storage.from(bucket).upload(path, archivo, { contentType: archivo.type || undefined, upsert: false });
    onAvance?.(100);
    return error ? { error: mensajeError(error.message, archivo) } : {};
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { error: "Tu sesión venció: volvé a entrar." };
  return new Promise((resolve) => {
    const subida = new Upload(archivo, {
      endpoint: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${session.access_token}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        "x-upsert": "false",
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: { bucketName: bucket, objectName: path, contentType: archivo.type || "application/octet-stream", cacheControl: "3600" },
      chunkSize: PARTE,
      onProgress: (subidos, total) => onAvance?.(Math.round((subidos / total) * 100)),
      onError: (e) => resolve({ error: mensajeError(e.message, archivo) }),
      onSuccess: () => resolve({}),
    });
    subida.start();
  });
}
