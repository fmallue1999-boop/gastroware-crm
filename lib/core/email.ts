/**
 * Adaptador de email (Resend). Se activa cuando exista RESEND_API_KEY en las
 * variables de entorno y el dominio gastroware.com.ar esté verificado en
 * Resend (DNS). Hasta entonces devuelve un error claro: nada simula enviarse.
 */

const REMITENTE = "GastroWare <comunicacion@gastroware.com.ar>";
const RESPONDER_A = "info@gastroware.com.ar";

export async function enviarEmail(input: {
  para: string;
  asunto: string;
  html: string;
  responderA?: string;
}): Promise<{ ok: true; id: string } | { error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      error:
        "El envío de email no está configurado todavía (falta RESEND_API_KEY y verificar el dominio en Resend).",
    };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: REMITENTE,
      to: [input.para],
      subject: input.asunto,
      html: input.html,
      reply_to: input.responderA ?? RESPONDER_A,
    }),
  });

  if (!res.ok) {
    const detalle = await res.text().catch(() => "");
    return { error: `Resend respondió ${res.status}: ${detalle.slice(0, 300)}` };
  }
  const data = (await res.json()) as { id: string };
  return { ok: true, id: data.id };
}
