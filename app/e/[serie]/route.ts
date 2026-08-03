import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Ruta corta del QR pegado en cada equipo: /e/{numero_serie}.
 * Requiere sesión (el proxy redirige a /login si no hay) y busca la ficha.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ serie: string }> }
) {
  const { serie } = await params;
  const url = new URL(request.url);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  const { data } = await supabase
    .from("equipos")
    .select("id")
    .eq("numero_serie", decodeURIComponent(serie))
    .is("deleted_at", null)
    .maybeSingle();

  if (!data) {
    return NextResponse.redirect(
      new URL(`/equipos?q=${encodeURIComponent(serie)}`, url.origin)
    );
  }
  return NextResponse.redirect(new URL(`/equipos/${data.id}`, url.origin));
}
