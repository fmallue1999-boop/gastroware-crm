import { VERSIONES } from "@/lib/novedades";

/**
 * La versión publicada (v1.21.2): la usa AvisoVersion para ofrecer actualizar
 * la app que quedó abierta con una versión vieja. No se guarda en caché.
 */
export function GET() {
  return Response.json({ version: VERSIONES[0].version }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
