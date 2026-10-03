"use server";

// Conversación del equipo de cada interés (v1.24; por interés desde v1.26,
// pedido de dirección: "que quede súper pro"). Un chat interno para anotar y
// conversar sobre el interés —de la consulta a la postventa—, con @ para
// avisarle a alguien. La ve y escribe quien ve el interés. No la ve el
// cliente ni sale en el PDF.

import { createClient } from "@/lib/supabase/server";
import { detectarMenciones, veElInteres, type Persona } from "@/lib/conversaciones";
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
  /** A quiénes se puede mencionar (los que ven el interés, sin uno mismo). */
  personas: Persona[];
  /** Hasta cuándo había leído antes de abrir (para marcar lo nuevo). */
  leidoAntes: string | null;
  /** Cuántas versiones tiene la cotización (si hay más de una se muestra "sobre v2"). */
  versiones: number;
  miId: string;
  miNombre: string;
};

const urlConversacion = (oportunidadId: string) => `/conversacion/${oportunidadId}`;

type Contexto = {
  cliente: string;
  que: string;
  clienteComercialId: string | null;
  comercialId: string | null;
  versionActual: number;
  creadores: string[];
  conversacionId: string | null;
};

/** El interés (si el usuario lo puede ver) y su conversación, si ya hay. */
async function contexto(supabase: SupabaseServidor, oportunidadId: string): Promise<Contexto | null> {
  const { data } = await supabase
    .from("oportunidades")
    .select(
      "id, comercial_id, mensaje_inicial, producto:productos(nombre), cliente:clientes(nombre_comercial, comercial_id), cotizaciones(versiones:cotizacion_versiones(version, creado_por)), chat:chats(id)"
    )
    .eq("id", oportunidadId)
    .maybeSingle();
  if (!data) return null;
  const o = data as unknown as {
    comercial_id: string | null;
    mensaje_inicial: string | null;
    producto: { nombre: string } | null;
    cliente: { nombre_comercial: string; comercial_id: string | null } | null;
    cotizaciones: { versiones: { version: number; creado_por: string | null }[] | null }[] | null;
    chat: { id: string } | { id: string }[] | null;
  };
  const conv = Array.isArray(o.chat) ? o.chat[0] : o.chat;
  const versiones = (o.cotizaciones ?? []).flatMap((c) => c.versiones ?? []);
  return {
    cliente: o.cliente?.nombre_comercial ?? "contacto",
    que: o.producto?.nombre ?? o.mensaje_inicial?.slice(0, 40) ?? "interés",
    clienteComercialId: o.cliente?.comercial_id ?? null,
    comercialId: o.comercial_id,
    versionActual: versiones.reduce((m, v) => Math.max(m, v.version), 0),
    creadores: versiones.map((v) => v.creado_por).filter((x): x is string => Boolean(x)),
    conversacionId: conv?.id ?? null,
  };
}

/** Los usuarios activos que ven el interés (los que se pueden mencionar). */
async function quienesLoVen(supabase: SupabaseServidor, ctx: Contexto): Promise<Persona[]> {
  const { data } = await supabase.from("usuarios").select("id, nombre, rol, activo").order("nombre");
  const usuarios = (data ?? []) as { id: string; nombre: string | null; rol: string; activo: boolean }[];
  const vendedorDelCliente = usuarios.find((u) => u.id === ctx.clienteComercialId);
  const cliente = { comercialId: ctx.clienteComercialId, comercialEsVendedor: vendedorDelCliente?.rol === "comercial" };
  return usuarios.filter((u) => u.activo && u.nombre && veElInteres(u, cliente)).map((u) => ({ id: u.id, nombre: u.nombre!.trim() }));
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

/** Los mensajes de la conversación del interés; al leerlos quedan como leídos. */
export async function leerConversacion(oportunidadId: string): Promise<DatosConversacion | { error: string }> {
  const supabase = await createClient();
  const user = await usuarioActual();
  if (!user) return { error: "Tenés que entrar de nuevo" };
  const ctx = await contexto(supabase, oportunidadId);
  if (!ctx) return { error: "No se encontró el interés" };
  const todos = await quienesLoVen(supabase, ctx);
  const personas = todos.filter((p) => p.id !== user.id);
  const { data: yoFila } = await supabase.from("usuarios").select("nombre").eq("id", user.id).maybeSingle();
  const yo = { miId: user.id, miNombre: (yoFila?.nombre as string | undefined)?.trim() ?? "" };
  if (!ctx.conversacionId) return { mensajes: [], personas, leidoAntes: null, versiones: ctx.versionActual, ...yo };
  const [mensajes, lectura] = await Promise.all([
    leerMensajes(supabase, ctx.conversacionId),
    supabase.from("chat_lecturas").select("leido_at").eq("chat_id", ctx.conversacionId).eq("usuario_id", user.id).maybeSingle(),
  ]);
  await marcarLeida(supabase, ctx.conversacionId, user.id);
  return { mensajes, personas, leidoAntes: (lectura.data?.leido_at as string | undefined) ?? null, versiones: ctx.versionActual, ...yo };
}

/** Escribe en la conversación del interés y avisa: a los mencionados con @ y a los que participan. */
export async function enviarMensaje(oportunidadId: string, texto: string): Promise<{ ok: true; mensajes: MensajeChat[] } | { error: string }> {
  const limpio = texto.trim();
  if (!limpio) return { error: "Escribí algo" };
  if (limpio.length > 4000) return { error: "Es muy largo (hasta 4000 letras)" };
  const supabase = await createClient();
  const user = await usuarioActual();
  if (!user) return { error: "Tenés que entrar de nuevo" };
  const ctx = await contexto(supabase, oportunidadId);
  if (!ctx) return { error: "No se encontró el interés" };

  let conversacionId = ctx.conversacionId;
  if (!conversacionId) {
    const nueva = await supabase.from("chats").insert({ tipo: "interes", oportunidad_id: oportunidadId }).select("id").maybeSingle();
    // Si otro la creó recién, se usa esa
    conversacionId =
      (nueva.data?.id as string | undefined) ??
      ((await supabase.from("chats").select("id").eq("oportunidad_id", oportunidadId).maybeSingle()).data?.id as string | undefined) ??
      null;
    if (!conversacionId) return { error: nueva.error?.message ?? "No se pudo abrir la conversación" };
  }

  const todos = await quienesLoVen(supabase, ctx);
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
  const { data: yoFila } = await supabase.from("usuarios").select("nombre").eq("id", user.id).maybeSingle();
  const yo = (yoFila?.nombre as string | undefined) ?? "Alguien";
  const deQue = `${ctx.cliente} · ${ctx.que}`;
  const cuerpo = limpio.length > 160 ? `${limpio.slice(0, 157)}…` : limpio;
  const url = urlConversacion(oportunidadId);
  await avisar(supabase, menciones, { tipo: "mencion", titulo: `${yo} te mencionó en ${deQue}`, cuerpo, url }, user.id);
  // Los que participan: el vendedor del interés, quien armó la cotización y los que ya escribieron
  const pueden = new Set(todos.map((p) => p.id));
  const participan = [ctx.comercialId, ...ctx.creadores, ...mensajes.map((m) => m.autorId)].filter(
    (id): id is string => Boolean(id) && pueden.has(id!) && !menciones.includes(id!)
  );
  await avisar(supabase, participan, { tipo: "conversacion", titulo: `${yo} escribió en ${deQue}`, cuerpo, url }, user.id);
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
