import Anthropic from "@anthropic-ai/sdk";
import type { createClient } from "@/lib/supabase/server";

/**
 * IA de GastroWare OS — reglas fijas:
 * - La IA solo recibe los datos que el USUARIO ya puede ver (las consultas
 *   se hacen con la sesión del usuario, RLS filtra antes de armar el prompt
 *   o de responder una herramienta).
 * - Nunca se manda la base entera: cada función o herramienta arma un
 *   contexto acotado.
 * - Todo es borrador o consulta: la IA no guarda, no cambia ni envía nada.
 * - Límite diario de usos configurable (config.ia_limite_diario) y registro
 *   de uso en ia_usos para auditar el costo.
 */

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

/** Modelos que se pueden elegir en Administración → IA (el primero es el de por defecto). */
export const MODELOS_IA = [
  { id: "claude-fable-5-1", nombre: "Claude Fable 5.1", detalle: "El más capaz. Mejor para el asistente y los análisis." },
  { id: "claude-opus-5-5", nombre: "Claude Opus 5.5", detalle: "Muy capaz." },
  { id: "claude-sonnet-5", nombre: "Claude Sonnet 5", detalle: "Más rápido y más económico. Buen equilibrio." },
  { id: "claude-haiku-4-5-20251001", nombre: "Claude Haiku 4.5", detalle: "El más barato, para tareas simples." },
] as const;
export const MODELO_POR_DEFECTO: string = MODELOS_IA[0].id;

export function iaConfigurada(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

/** Modelo elegido en Administración → IA (config ia_modelo). */
export async function modeloIA(supabase: SupabaseServer): Promise<string> {
  const { data } = await supabase.from("config").select("valor").eq("clave", "ia_modelo").maybeSingle();
  const v = (data?.valor as string | undefined)?.trim();
  return MODELOS_IA.some((m) => m.id === v) ? (v as string) : MODELO_POR_DEFECTO;
}

const SISTEMA_BASE = `Sos el asistente de GastroWare OS, el sistema de GastroWare Argentina
(equipos gastronómicos: exprimidoras Zumex, licuadoras GX22/GX18, hornos
Rational y sus pastillas de limpieza, máquinas de café Jetinno). Escribís en
español rioplatense, tono cercano y profesional, sin exagerar.

Reglas estrictas:
- Usá SOLO los datos del contexto. Si un dato no está (precio, serie, fecha),
  NO lo inventes: omitilo o dejá un marcador claro como [completar precio].
- No prometas nada que no esté en el contexto (plazos, stock, descuentos).
- En "fuentes" listá qué datos del contexto usaste, en palabras simples.`;

/** Límite diario de todo el equipo (control de costo). Devuelve el motivo si no se puede usar. */
async function chequearLimite(supabase: SupabaseServer): Promise<string | null> {
  if (!iaConfigurada()) return "La IA no está configurada todavía. Dirección puede activarla en Administración → IA.";
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
  const { data: cfg } = await supabase.from("config").select("valor").eq("clave", "ia_limite_diario").maybeSingle();
  const limite = Number(cfg?.valor ?? 100);
  if (limite <= 0) return "La IA está apagada (límite diario en 0).";
  const { count } = await supabase
    .from("ia_usos")
    .select("id", { count: "exact", head: true })
    .gte("created_at", `${hoy}T00:00:00-03:00`);
  if ((count ?? 0) >= limite) return `Se alcanzó el límite diario de IA (${limite} usos). Se puede subir en Administración → IA.`;
  return null;
}

async function registrarUso(supabase: SupabaseServer, usuarioId: string | null, funcion: string, entrada: number, salida: number) {
  await supabase.from("ia_usos").insert({ usuario_id: usuarioId, funcion, tokens_entrada: entrada, tokens_salida: salida });
}

/** Una consulta con respuesta en formato fijo (esquema JSON). */
export async function consultarIA<T>(input: {
  supabase: SupabaseServer;
  usuarioId: string | null;
  funcion: string;
  instrucciones: string;
  contexto: string;
  esquema: Record<string, unknown>;
  maxTokens?: number;
  /** Imagen opcional (visión): base64 sin el prefijo data-url. */
  imagen?: { base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" };
}): Promise<{ ok: true; datos: T } | { ok: false; error: string }> {
  const bloqueo = await chequearLimite(input.supabase);
  if (bloqueo) return { ok: false, error: bloqueo };
  const modelo = await modeloIA(input.supabase);

  const texto = `${input.instrucciones}\n\n<contexto>\n${input.contexto}\n</contexto>`;
  const client = new Anthropic();
  let respuesta;
  try {
    respuesta = await client.messages.create({
      model: modelo,
      max_tokens: input.maxTokens ?? 4000,
      output_config: { effort: "low", format: { type: "json_schema", schema: input.esquema } },
      system: SISTEMA_BASE,
      messages: [
        {
          role: "user",
          content: input.imagen
            ? [
                {
                  type: "image" as const,
                  source: { type: "base64" as const, media_type: input.imagen.mediaType, data: input.imagen.base64 },
                },
                { type: "text" as const, text: texto },
              ]
            : texto,
        },
      ],
    }, { timeout: 50_000, maxRetries: 1 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "error desconocido";
    return { ok: false, error: `No se pudo consultar la IA: ${msg}` };
  }

  await registrarUso(input.supabase, input.usuarioId, input.funcion, respuesta.usage.input_tokens, respuesta.usage.output_tokens);

  if (respuesta.stop_reason === "refusal") return { ok: false, error: "La IA declinó esta consulta. Probá reformularla." };
  if (respuesta.stop_reason === "max_tokens") return { ok: false, error: "La respuesta quedó cortada. Probá de nuevo." };
  const bloque = respuesta.content.find((b) => b.type === "text");
  if (!bloque || bloque.type !== "text") return { ok: false, error: "La IA no devolvió contenido." };
  try {
    return { ok: true, datos: JSON.parse(bloque.text) as T };
  } catch {
    return { ok: false, error: "La respuesta de la IA no tiene el formato esperado." };
  }
}

// ---------------------------------------------------------------------------
// Asistente con herramientas (consulta los datos del usuario, no cambia nada)
// ---------------------------------------------------------------------------

export type HerramientaIA = {
  nombre: string;
  descripcion: string;
  parametros: Record<string, unknown>;
  /** Texto que ve la persona mientras se usa ("Buscando contactos…"). */
  etiqueta: string;
  ejecutar: (args: Record<string, unknown>) => Promise<unknown>;
};

export type MensajeChat = { rol: "usuario" | "asistente"; texto: string };

/**
 * Conversación con herramientas de solo lectura: la IA pide datos (con la
 * sesión del usuario, así RLS decide qué ve) hasta tener la respuesta.
 * Cuenta como un uso por pregunta.
 */
export async function asistenteIA(input: {
  supabase: SupabaseServer;
  usuarioId: string | null;
  sistema: string;
  mensajes: MensajeChat[];
  herramientas: HerramientaIA[];
  maxVueltas?: number;
}): Promise<{ ok: true; texto: string; usadas: string[] } | { ok: false; error: string }> {
  const bloqueo = await chequearLimite(input.supabase);
  if (bloqueo) return { ok: false, error: bloqueo };
  const modelo = await modeloIA(input.supabase);
  const client = new Anthropic();
  const porNombre = new Map(input.herramientas.map((h) => [h.nombre, h]));
  const tools = input.herramientas.map((h) => ({
    name: h.nombre,
    description: h.descripcion,
    input_schema: h.parametros as Anthropic.Tool.InputSchema,
  }));
  const mensajes: Anthropic.MessageParam[] = input.mensajes.map((m) => ({
    role: m.rol === "usuario" ? "user" : "assistant",
    content: m.texto,
  }));
  const usadas: string[] = [];
  let entrada = 0;
  let salida = 0;
  const maxVueltas = input.maxVueltas ?? 6;
  // El servidor corta a los 60 s: pasados ~35 s se responde con lo que ya se consultó
  const inicio = Date.now();
  const transcurrido = () => Date.now() - inicio;

  try {
    for (let vuelta = 0; vuelta < maxVueltas; vuelta++) {
      const ultima = vuelta === maxVueltas - 1 || transcurrido() > 35_000;
      const respuesta = await client.messages.create({
        model: modelo,
        max_tokens: 3000,
        output_config: { effort: "low" },
        system: input.sistema,
        tools,
        // En la última vuelta ya no se piden más datos: se responde con lo que hay
        ...(ultima ? { tool_choice: { type: "none" as const } } : {}),
        messages: mensajes,
      }, { timeout: Math.max(10_000, 55_000 - transcurrido()), maxRetries: 0 });
      entrada += respuesta.usage.input_tokens;
      salida += respuesta.usage.output_tokens;

      if (respuesta.stop_reason === "tool_use") {
        mensajes.push({ role: "assistant", content: respuesta.content });
        // Las consultas de una misma vuelta van en paralelo
        const pedidos = respuesta.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
        const resultados = await Promise.all(
          pedidos.map(async (b): Promise<Anthropic.ToolResultBlockParam> => {
            const h = porNombre.get(b.name);
            if (!h) return { type: "tool_result", tool_use_id: b.id, content: "Herramienta desconocida.", is_error: true };
            usadas.push(h.etiqueta);
            try {
              const datos = await h.ejecutar((b.input ?? {}) as Record<string, unknown>);
              return { type: "tool_result", tool_use_id: b.id, content: JSON.stringify(datos).slice(0, 14000) };
            } catch (e) {
              return {
                type: "tool_result",
                tool_use_id: b.id,
                content: `No se pudo consultar: ${e instanceof Error ? e.message : "error"}`,
                is_error: true,
              };
            }
          })
        );
        mensajes.push({ role: "user", content: resultados });
        continue;
      }

      await registrarUso(input.supabase, input.usuarioId, "asistente", entrada, salida);
      if (respuesta.stop_reason === "refusal") return { ok: false, error: "La IA declinó esta consulta. Probá reformularla." };
      const texto = respuesta.content
        .filter((b) => b.type === "text")
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("\n")
        .trim();
      if (!texto) return { ok: false, error: "La IA no devolvió respuesta. Probá de nuevo." };
      return { ok: true, texto, usadas: [...new Set(usadas)] };
    }
  } catch (e: unknown) {
    await registrarUso(input.supabase, input.usuarioId, "asistente", entrada, salida);
    const msg = e instanceof Error ? e.message : "error desconocido";
    return { ok: false, error: `No se pudo consultar la IA: ${msg}` };
  }
  await registrarUso(input.supabase, input.usuarioId, "asistente", entrada, salida);
  return { ok: false, error: "La consulta necesitó demasiados pasos. Probá con una pregunta más concreta." };
}
