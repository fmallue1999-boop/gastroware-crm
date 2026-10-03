"use server";

// Conversación de cada cotización (v1.24, pedido de dirección): un chat
// interno para anotar y conversar sobre la cotización, con @ para avisarle a
// alguien. La ve y escribe quien puede ver la cotización. No sale en el PDF.

import { createClient } from "@/lib/supabase/server";
import { detectarMenciones, veLaCotizacion, type Persona } from "@/lib/conversaciones";
import { avisar, usuarioActual, type SupabaseServidor } from "./comun";

export type MensajeChat = {
  id: string;
  autorId: string | null;
  autor: string;
  texto: string;
  version: number | null;
  created_at: string;
};

export type DatosConversacion = {
  mensajes: MensajeChat[];
  /** A quiénes se puede mencionar (los que ven la cotización, sin uno mismo). */
  personas: Persona[];
  /** Hasta cuándo había leído antes de abrir (para marcar lo nuevo). */
  leidoAntes: string | null;
  /** Cuántas versiones tiene la cotización (si hay más de una se muestra "sobre v2"). */
  versiones: number;
  miId: string;
  miNombre: string;
};

const urlConversacion = (cotizacionId: string) => `/cotizaciones/${cotizacionId}`;

type Contexto = {
  numero: number;
  cliente: string;
  comercialId: string | null;
  versionActual: number;
  creadores: string[];
  conversacionId: string | null;
};

/** La cotización (si el usuario la puede ver) y su conversación, si ya hay. */
async function contexto(supabase: SupabaseServidor, cotizacionId: string): Promise<Contexto | null> {
  const { data } = await supabase
    .from("cotizaciones")
    .select("id, numero, oportunidad:oportunidades(comercial_id, cliente:clientes(nombre_comercial)), versiones:cotizacion_versiones(version, creado_por), chat:chats(id)")
    .eq("id", cotizacionId)
    .maybeSingle();
  if (!data) return null;
  const c = data as unknown as {
    numero: number;
    oportunidad: { comercial_id: string | null; cliente: { nombre_comercial: string } | null } | null;
    versiones: { version: number; creado_por: string | null }[] | null;
    chat: { id: string } | { id: string }[] | null;
  };
  const conv = Array.isArray(c.chat) ? c.chat[0] : c.chat;
  const versiones = c.versiones ?? [];
  return {
    numero: c.numero,
    cliente: c.oportunidad?.cliente?.nombre_comercial ?? "contacto",
    comercialId: c.oportunidad?.comercial_id ?? null,
    versionActual: versiones.reduce((m, v) => Math.max(m, v.version), 0),
    creadores: versiones.map((v) => v.creado_por).filter((x): x is string => Boolean(x)),
    conversacionId: conv?.id ?? null,
  };
}

/** Los usuarios activos que pueden ver la cotización. */
async function quienesLaVen(supabase: SupabaseServidor, comercialId: string | null) {
  const { data } = await supabase.from("usuarios").select("id, nombre, rol").eq("activo", true).order("nombre");
  return ((data ?? []) as { id: string; nombre: string | null; rol: string }[])
    .filter((u) => u.nombre && veLaCotizacion(u, comercialId))
    .map((u) => ({ id: u.id, nombre: u.nombre!.trim() }));
}

async function leerMensajes(supabase: SupabaseServidor, conversacionId: string): Promise<MensajeChat[]> {
  const { data } = await supabase
    .from("chat_mensajes")
    .select("id, autor_id, texto, version, created_at, autor:usuarios(nombre)")
    .eq("chat_id", conversacionId)
    .order("created_at", { ascending: true })
    .limit(500);
  return ((data ?? []) as unknown as { id: string; autor_id: string | null; texto: string; version: number | null; created_at: string; autor: { nombre: string | null } | null }[]).map(
    (m) => ({ id: m.id, autorId: m.autor_id, autor: m.autor?.nombre ?? "Alguien", texto: m.texto, version: m.version, created_at: m.created_at })
  );
}

async function marcarLeida(supabase: SupabaseServidor, conversacionId: string, usuarioId: string) {
  await supabase
    .from("chat_lecturas")
    .upsert({ chat_id: conversacionId, usuario_id: usuarioId, leido_at: new Date().toISOString() }, { onConflict: "chat_id,usuario_id" });
}

/** Los mensajes de la cotización; al leerlos quedan como leídos. */
export async function leerConversacion(cotizacionId: string): Promise<DatosConversacion | { error: string }> {
  const supabase = await createClient();
  const user = await usuarioActual();
  if (!user) return { error: "Tenés que entrar de nuevo" };
  const ctx = await contexto(supabase, cotizacionId);
  if (!ctx) return { error: "No se encontró la cotización" };
  const todos = await quienesLaVen(supabase, ctx.comercialId);
  const personas = todos.filter((p) => p.id !== user.id);
  const yo = { miId: user.id, miNombre: todos.find((p) => p.id === user.id)?.nombre ?? "" };
  if (!ctx.conversacionId) return { mensajes: [], personas, leidoAntes: null, versiones: ctx.versionActual, ...yo };
  const [mensajes, lectura] = await Promise.all([
    leerMensajes(supabase, ctx.conversacionId),
    supabase.from("chat_lecturas").select("leido_at").eq("chat_id", ctx.conversacionId).eq("usuario_id", user.id).maybeSingle(),
  ]);
  await marcarLeida(supabase, ctx.conversacionId, user.id);
  return { mensajes, personas, leidoAntes: (lectura.data?.leido_at as string | undefined) ?? null, versiones: ctx.versionActual, ...yo };
}

/** Escribe en la conversación de la cotización y avisa: a los mencionados con @ y a los que participan. */
export async function enviarMensajeCotizacion(cotizacionId: string, texto: string): Promise<{ ok: true; mensajes: MensajeChat[] } | { error: string }> {
  const limpio = texto.trim();
  if (!limpio) return { error: "Escribí algo" };
  if (limpio.length > 4000) return { error: "Es muy largo (hasta 4000 letras)" };
  const supabase = await createClient();
  const user = await usuarioActual();
  if (!user) return { error: "Tenés que entrar de nuevo" };
  const ctx = await contexto(supabase, cotizacionId);
  if (!ctx) return { error: "No se encontró la cotización" };

  let conversacionId = ctx.conversacionId;
  if (!conversacionId) {
    const nueva = await supabase.from("chats").insert({ tipo: "cotizacion", cotizacion_id: cotizacionId }).select("id").maybeSingle();
    // Si otro la creó recién, se usa esa
    conversacionId =
      (nueva.data?.id as string | undefined) ??
      ((await supabase.from("chats").select("id").eq("cotizacion_id", cotizacionId).maybeSingle()).data?.id as string | undefined) ??
      null;
    if (!conversacionId) return { error: nueva.error?.message ?? "No se pudo abrir la conversación" };
  }

  const todos = await quienesLaVen(supabase, ctx.comercialId);
  const menciones = detectarMenciones(limpio, todos.filter((p) => p.id !== user.id));
  const { error } = await supabase.from("chat_mensajes").insert({
    chat_id: conversacionId,
    autor_id: user.id,
    texto: limpio,
    version: ctx.versionActual || null,
    menciones,
  });
  if (error) return { error: error.message };
  await marcarLeida(supabase, conversacionId, user.id);

  const mensajes = await leerMensajes(supabase, conversacionId);
  const yo = todos.find((p) => p.id === user.id)?.nombre ?? mensajes.at(-1)?.autor ?? "Alguien";
  const deQue = `la cotización N° ${ctx.numero} (${ctx.cliente})`;
  const cuerpo = limpio.length > 160 ? `${limpio.slice(0, 157)}…` : limpio;
  const url = urlConversacion(cotizacionId);
  await avisar(supabase, menciones, { tipo: "mencion", titulo: `${yo} te mencionó en ${deQue}`, cuerpo, url }, user.id);
  // Los que participan: el vendedor, quien armó la cotización y los que ya escribieron
  const pueden = new Set(todos.map((p) => p.id));
  const participan = [ctx.comercialId, ...ctx.creadores, ...mensajes.map((m) => m.autorId)].filter(
    (id): id is string => Boolean(id) && pueden.has(id!) && !menciones.includes(id!)
  );
  await avisar(supabase, participan, { tipo: "cotizacion_mensaje", titulo: `${yo} escribió en ${deQue}`, cuerpo, url }, user.id);
  return { ok: true, mensajes };
}

/** Borra un mensaje propio. */
export async function borrarMensaje(mensajeId: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const user = await usuarioActual();
  if (!user) return { error: "Tenés que entrar de nuevo" };
  const { data, error } = await supabase.from("chat_mensajes").delete().eq("id", mensajeId).eq("autor_id", user.id).select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "Solo podés borrar tus mensajes" };
  return { ok: true };
}
