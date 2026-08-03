import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Recibe consultas del formulario del sitio (zumex.com.ar / gastroware.com.ar)
 * y crea lead + oportunidad + tarea vía fn_lead_web (security definer con
 * rate limit y dedup por teléfono). Anti-spam: honeypot + límite en la DB.
 */

const ORIGENES_PERMITIDOS = [
  "https://zumex.com.ar",
  "https://www.zumex.com.ar",
  "https://gastroware.com.ar",
  "https://www.gastroware.com.ar",
];

function corsHeaders(origin: string | null) {
  const permitido = origin && ORIGENES_PERMITIDOS.includes(origin);
  return {
    "Access-Control-Allow-Origin": permitido ? origin : ORIGENES_PERMITIDOS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("origin")),
  });
}

export async function POST(request: Request) {
  const headers = corsHeaders(request.headers.get("origin"));

  let datos: Record<string, string> = {};
  const contentType = request.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      datos = (await request.json()) as Record<string, string>;
    } else {
      const form = await request.formData();
      for (const [k, v] of form.entries()) {
        if (typeof v === "string") datos[k] = v;
      }
    }
  } catch {
    return NextResponse.json(
      { error: "Datos inválidos" },
      { status: 400, headers }
    );
  }

  // Honeypot: el campo "sitio_web" está oculto en el formulario;
  // si viene con contenido, lo llenó un bot. Respondemos ok sin crear nada.
  if (datos.sitio_web) {
    return NextResponse.json({ ok: true }, { headers });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { error } = await supabase.rpc("fn_lead_web", {
    p_nombre: datos.nombre ?? "",
    p_telefono: datos.telefono ?? "",
    p_email: datos.email ?? "",
    p_rubro: datos.rubro ?? "",
    p_ciudad: datos.ciudad ?? "",
    p_mensaje: datos.mensaje ?? "",
    p_producto: datos.producto ?? "",
  });

  if (error) {
    const msg = error.message.includes("rate_limit")
      ? "Recibimos muchas consultas, probá de nuevo en un rato."
      : error.message.includes("falta_nombre")
        ? "Contanos tu nombre."
        : error.message.includes("falta_contacto")
          ? "Dejanos un teléfono o un email para responderte."
          : "No pudimos registrar la consulta, probá de nuevo.";
    return NextResponse.json({ error: msg }, { status: 400, headers });
  }

  return NextResponse.json({ ok: true }, { headers });
}
