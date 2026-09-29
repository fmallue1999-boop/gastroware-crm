import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { armarPdfCotizacion, cargarCotizacionPdf } from "@/lib/servidor/cotizacion-pdf";

export const maxDuration = 60;

/**
 * La cotización en PDF lista para mandar al cliente, con las fichas de los
 * productos anexadas. ?v=N elige la versión; ?descargar=1 la baja como archivo.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  const v = Number(request.nextUrl.searchParams.get("v")) || null;
  const supabase = await createClient();

  const carga = await cargarCotizacionPdf(supabase, id, v);
  if (!carga.ok) {
    // Esperando aprobación o rechazada: la página explica qué pasa
    if (carga.motivo === "aprobacion") return NextResponse.redirect(new URL(`/cotizacion/${id}?v=${carga.version}`, request.url));
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }

  const pdf = await armarPdfCotizacion(supabase, carga.datos, carga.anexos);
  const ascii = carga.archivo.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  const modo = request.nextUrl.searchParams.get("descargar") === "1" ? "attachment" : "inline";
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${modo}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(carga.archivo)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
