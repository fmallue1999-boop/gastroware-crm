import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";

/**
 * Webhook de WhatsApp Business API (Meta oficial). Queda dormido hasta
 * configurar en Vercel: WHATSAPP_VERIFY_TOKEN (lo inventás vos y lo repetís
 * en el panel de Meta) y WHATSAPP_APP_SECRET (App secret de la app de Meta,
 * para validar la firma de cada entrega).
 * Sin scraping: solo la API oficial. No lee histórico: procesa lo que llega.
 */

// Verificación inicial del webhook (Meta manda un GET con un challenge)
export async function GET(request: Request) {
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "WhatsApp no configurado (falta WHATSAPP_VERIFY_TOKEN)" },
      { status: 503 }
    );
  }
  const url = new URL(request.url);
  const modo = url.searchParams.get("hub.mode");
  const verifyToken = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (modo === "subscribe" && verifyToken === token && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Token inválido" }, { status: 403 });
}

export async function POST(request: Request) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    return NextResponse.json(
      { error: "WhatsApp no configurado (falta WHATSAPP_APP_SECRET)" },
      { status: 503 }
    );
  }

  const cuerpo = await request.text();

  // Firma de Meta: sha256 HMAC del cuerpo con el App Secret
  const firma = request.headers.get("x-hub-signature-256") ?? "";
  const esperada =
    "sha256=" + createHmac("sha256", appSecret).update(cuerpo).digest("hex");
  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(cuerpo);
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  // La función fn_webhook_wa solo es ejecutable por service_role (025):
  // mismo cliente administrativo que usan los crons.
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/\s+/g, "");
  if (!serviceKey) {
    console.error("fn_webhook_wa: falta SUPABASE_SERVICE_ROLE_KEY");
    return NextResponse.json({ ok: true });
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await supabase.rpc("fn_webhook_wa", { p_payload: payload });
  if (error) {
    // Respondemos 200 igual: si devolvemos error, Meta reintenta en loop
    console.error("fn_webhook_wa:", error.message);
  }
  return NextResponse.json({ ok: true });
}
