import Anthropic from "@anthropic-ai/sdk";
import type { createClient } from "@/lib/supabase/server";

/**
 * IA de GastroWare OS — reglas fijas del spec:
 * - La IA solo recibe los datos que el USUARIO ya puede ver (las consultas
 *   se hacen con la sesión del usuario, RLS filtra antes de armar el prompt).
 * - Nunca se manda la base entera: cada función arma un contexto acotado.
 * - Salidas validadas por esquema JSON (structured outputs).
 * - Todo es borrador con vista previa: nada se guarda ni se envía solo.
 * - Límite diario de llamadas configurable (config.ia_limite_diario) y
 *   registro de uso en ia_usos para auditar el costo.
 */

const MODELO = "claude-opus-5";

export function iaConfigurada(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

const SISTEMA_BASE = `Sos el asistente del CRM de GastroWare Argentina (equipos gastronómicos:
exprimidoras Zumex, licuadoras GX22/GX18, hornos Rational y sus pastillas de
limpieza, máquinas de café Jetinno). Escribís en español rioplatense, tono
cercano y profesional, sin exagerar.

Reglas estrictas:
- Usá SOLO los datos del contexto. Si un dato no está (precio, serie, fecha),
  NO lo inventes: omitilo o dejá un marcador claro como [completar precio].
- No prometas nada que no esté en el contexto (plazos, stock, descuentos).
- En "fuentes" listá qué datos del contexto usaste, en palabras simples.`;

export async function consultarIA<T>(input: {
  supabase: SupabaseServer;
  usuarioId: string | null;
  funcion: string;
  instrucciones: string;
  contexto: string;
  esquema: Record<string, unknown>;
  maxTokens?: number;
}): Promise<{ ok: true; datos: T } | { ok: false; error: string }> {
  if (!iaConfigurada()) {
    return {
      ok: false,
      error:
        "La IA no está configurada todavía. Dirección puede activarla en Administración → IA.",
    };
  }

  // Límite diario de todo el equipo (control de costo)
  const [{ data: cfg }, hoy] = [
    await input.supabase
      .from("config")
      .select("valor")
      .eq("clave", "ia_limite_diario")
      .maybeSingle(),
    new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Argentina/Buenos_Aires",
    }),
  ];
  const limite = Number(cfg?.valor ?? 100);
  if (limite <= 0) {
    return { ok: false, error: "La IA está apagada (límite diario en 0)." };
  }
  const { count } = await input.supabase
    .from("ia_usos")
    .select("id", { count: "exact", head: true })
    .gte("created_at", `${hoy}T00:00:00-03:00`);
  if ((count ?? 0) >= limite) {
    return {
      ok: false,
      error: `Se alcanzó el límite diario de IA (${limite} usos). Se puede subir en Administración → IA.`,
    };
  }

  const client = new Anthropic();
  let respuesta;
  try {
    respuesta = await client.messages.create({
      model: MODELO,
      max_tokens: input.maxTokens ?? 4000,
      output_config: {
        effort: "low",
        format: {
          type: "json_schema",
          schema: input.esquema,
        },
      },
      system: SISTEMA_BASE,
      messages: [
        {
          role: "user",
          content: `${input.instrucciones}\n\n<contexto>\n${input.contexto}\n</contexto>`,
        },
      ],
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "error desconocido";
    return { ok: false, error: `No se pudo consultar la IA: ${msg}` };
  }

  // Registrar uso (auditable, cuenta para el límite y el costo)
  await input.supabase.from("ia_usos").insert({
    usuario_id: input.usuarioId,
    funcion: input.funcion,
    tokens_entrada: respuesta.usage.input_tokens,
    tokens_salida: respuesta.usage.output_tokens,
  });

  if (respuesta.stop_reason === "refusal") {
    return { ok: false, error: "La IA declinó esta consulta. Probá reformularla." };
  }
  if (respuesta.stop_reason === "max_tokens") {
    return { ok: false, error: "La respuesta quedó cortada. Probá de nuevo." };
  }

  const texto = respuesta.content.find((b) => b.type === "text");
  if (!texto || texto.type !== "text") {
    return { ok: false, error: "La IA no devolvió contenido." };
  }
  try {
    return { ok: true, datos: JSON.parse(texto.text) as T };
  } catch {
    return { ok: false, error: "La respuesta de la IA no tiene el formato esperado." };
  }
}
