import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Catálogo público de productos para la web (gastroware.com.ar / zumex.com.ar).
 * Solo lectura, sin precios (los precios se manejan en la venta). Devuelve la
 * ficha de venta que se carga en Administración → Catálogo.
 */
export const revalidate = 3600; // cache 1 hora

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase
    .from("productos")
    .select("nombre, marca, categoria, descripcion, destacados, imagen_url, garantia_meses, es_consumible")
    .eq("activo", true)
    .order("categoria")
    .order("nombre");

  if (error) {
    return NextResponse.json({ error: "No disponible" }, { status: 500 });
  }

  return NextResponse.json(
    { productos: data ?? [] },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    }
  );
}
