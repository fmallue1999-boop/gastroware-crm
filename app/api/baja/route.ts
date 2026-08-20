import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";

/**
 * Baja de comunicaciones desde el link del email (público, sin login).
 * El token es un HMAC del id del cliente con CRON_SECRET: solo los links
 * generados por el sistema funcionan.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const clienteId = url.searchParams.get("c") ?? "";
  const token = url.searchParams.get("t") ?? "";
  const secreto = process.env.CRON_SECRET ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/\s+/g, "");

  const esperado = createHmac("sha256", secreto)
    .update(clienteId)
    .digest("hex")
    .slice(0, 32);

  const pagina = (titulo: string, texto: string, status = 200) =>
    new NextResponse(
      `<!doctype html><html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${titulo}</title></head>
<body style="margin:0; font-family:Arial,Helvetica,sans-serif; background:#f5f4f0; display:flex; min-height:100vh; align-items:center; justify-content:center;">
<div style="background:#fff; border-radius:14px; padding:32px; max-width:420px; text-align:center;">
<p style="font-size:19px; font-weight:bold; margin:0 0 10px 0;">GastroWare</p>
<p style="font-size:16px; margin:0; line-height:1.5;">${texto}</p>
</div></body></html>`,
      { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );

  if (!clienteId || !token || !secreto || token !== esperado)
    return pagina("Link inválido", "El link no es válido o ya venció.", 400);
  if (!serviceKey)
    return pagina("Error", "No se pudo procesar la baja. Escribinos a info@gastroware.com.ar.", 500);

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await admin
    .from("clientes")
    .update({ no_contactar: true })
    .eq("id", clienteId);
  if (error)
    return pagina("Error", "No se pudo procesar la baja. Escribinos a info@gastroware.com.ar.", 500);

  return pagina(
    "Listo",
    "Listo: no vas a recibir más emails nuestros. Si fue un error, escribinos a info@gastroware.com.ar."
  );
}
