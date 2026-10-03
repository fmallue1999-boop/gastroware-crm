import type { SupabaseServidor } from "@/lib/actions/comun";

/** Conversación del equipo de cada interés (v1.26): lecturas con la sesión del usuario. */

export type ResumenConversacion = {
  total: number;
  sinLeer: number;
  /** El último mensaje, para mostrarlo sin abrir la conversación. */
  ultimo: { autor: string; texto: string; at: string; propio: boolean } | null;
};

type Chat = { id: string; oportunidad_id: string; ultimo_mensaje_at: string | null };
type Msg = { chat_id: string; autor_id: string | null; texto: string; created_at: string; autor: { nombre: string | null } | null };

const TANDA = 150;
const tandas = <T,>(lista: T[]) => Array.from({ length: Math.ceil(lista.length / TANDA) }, (_, i) => lista.slice(i * TANDA, (i + 1) * TANDA));

async function armarResumen(supabase: SupabaseServidor, chats: Chat[], usuarioId: string): Promise<Record<string, ResumenConversacion>> {
  const conMensajes = chats.filter((c) => c.ultimo_mensaje_at);
  if (!conMensajes.length) return {};
  const partes = await Promise.all(
    tandas(conMensajes.map((c) => c.id)).map((ids) =>
      Promise.all([
        supabase
          .from("chat_mensajes")
          .select("chat_id, autor_id, texto, created_at, autor:usuarios(nombre)")
          .in("chat_id", ids)
          .order("created_at", { ascending: false })
          .limit(5000),
        supabase.from("chat_lecturas").select("chat_id, leido_at").eq("usuario_id", usuarioId).in("chat_id", ids),
      ])
    )
  );
  const mensajes = partes.flatMap(([m]) => (m.data ?? []) as unknown as Msg[]);
  const leido = new Map(partes.flatMap(([, l]) => (l.data ?? []) as { chat_id: string; leido_at: string }[]).map((l) => [l.chat_id, Date.parse(l.leido_at)]));
  const porChat = new Map<string, ResumenConversacion>();
  for (const m of mensajes) {
    const r = porChat.get(m.chat_id) ?? { total: 0, sinLeer: 0, ultimo: null };
    r.total++;
    // Vienen del más nuevo al más viejo: el primero es el último mensaje
    if (!r.ultimo) r.ultimo = { autor: m.autor?.nombre ?? "Alguien", texto: m.texto, at: m.created_at, propio: m.autor_id === usuarioId };
    const hasta = leido.get(m.chat_id);
    if (m.autor_id !== usuarioId && (hasta === undefined || Date.parse(m.created_at) > hasta)) r.sinLeer++;
    porChat.set(m.chat_id, r);
  }
  const res: Record<string, ResumenConversacion> = {};
  for (const c of conMensajes) {
    const r = porChat.get(c.id);
    if (r) res[c.oportunidad_id] = r;
  }
  return res;
}

/**
 * Cuántos mensajes tiene la conversación de cada interés, cuántos no leyó
 * el usuario (los propios no cuentan) y cuál fue el último. Sin lista de
 * intereses, todos los que el usuario ve. Si algo falla, vacío.
 */
export async function resumenConversaciones(
  supabase: SupabaseServidor,
  oportunidadIds: string[] | null,
  usuarioId: string
): Promise<Record<string, ResumenConversacion>> {
  const ids = oportunidadIds ? [...new Set(oportunidadIds)] : null;
  if (ids && !ids.length) return {};
  let chats: Chat[] = [];
  // Pocos intereses: se piden por id; muchos (embudo): todas las conversaciones que se ven
  if (ids && ids.length <= TANDA) {
    const { data, error } = await supabase.from("chats").select("id, oportunidad_id, ultimo_mensaje_at").eq("tipo", "interes").in("oportunidad_id", ids);
    if (error) return {};
    chats = (data ?? []) as Chat[];
  } else {
    const { data, error } = await supabase
      .from("chats")
      .select("id, oportunidad_id, ultimo_mensaje_at")
      .eq("tipo", "interes")
      .not("ultimo_mensaje_at", "is", null)
      .order("ultimo_mensaje_at", { ascending: false })
      .limit(2000);
    if (error) return {};
    const quiero = ids ? new Set(ids) : null;
    chats = ((data ?? []) as Chat[]).filter((c) => !quiero || quiero.has(c.oportunidad_id));
  }
  return armarResumen(supabase, chats, usuarioId);
}

export type ConversacionNueva = {
  oportunidadId: string;
  clienteId: string;
  cliente: string;
  que: string;
  sinLeer: number;
  ultimo: ResumenConversacion["ultimo"];
};

/**
 * Para Mi día: las conversaciones con mensajes nuevos donde la persona está
 * metida (es el vendedor del interés, ya escribió o ya la abrió). Así
 * dirección, que ve todas, no recibe las ajenas.
 */
export async function conversacionesConNuevos(supabase: SupabaseServidor, usuarioId: string): Promise<ConversacionNueva[]> {
  const [{ data: lecturas, error }, { data: chatsData }] = await Promise.all([
    supabase.from("chat_lecturas").select("chat_id, leido_at").eq("usuario_id", usuarioId).limit(5000),
    supabase
      .from("chats")
      .select("id, oportunidad_id, ultimo_mensaje_at, oportunidad:oportunidades(comercial_id)")
      .eq("tipo", "interes")
      .not("ultimo_mensaje_at", "is", null)
      .order("ultimo_mensaje_at", { ascending: false })
      .limit(2000),
  ]);
  if (error) return [];
  const leidoEn = new Map(((lecturas ?? []) as { chat_id: string; leido_at: string }[]).map((l) => [l.chat_id, Date.parse(l.leido_at)]));
  const chats = (chatsData ?? []) as unknown as (Chat & { oportunidad: { comercial_id: string | null } | null })[];
  const candidatos = chats.filter((c) => {
    const hasta = leidoEn.get(c.id);
    const metido = hasta !== undefined || c.oportunidad?.comercial_id === usuarioId;
    return metido && (hasta === undefined || Date.parse(c.ultimo_mensaje_at!) > hasta);
  });
  if (!candidatos.length) return [];
  const resumen = await armarResumen(supabase, candidatos.slice(0, 100), usuarioId);
  const conNuevos = Object.entries(resumen).filter(([, r]) => r.sinLeer > 0);
  if (!conNuevos.length) return [];
  const { data: opps } = await supabase
    .from("oportunidades")
    .select("id, cliente_id, mensaje_inicial, producto:productos(nombre), cliente:clientes(nombre_comercial)")
    .in(
      "id",
      conNuevos.map(([id]) => id)
    );
  const porId = new Map(
    ((opps ?? []) as unknown as { id: string; cliente_id: string; mensaje_inicial: string | null; producto: { nombre: string } | null; cliente: { nombre_comercial: string } | null }[]).map((o) => [o.id, o])
  );
  return conNuevos
    .map(([id, r]) => {
      const o = porId.get(id);
      return o
        ? { oportunidadId: id, clienteId: o.cliente_id, cliente: o.cliente?.nombre_comercial ?? "Contacto", que: o.producto?.nombre ?? o.mensaje_inicial ?? "Interés", sinLeer: r.sinLeer, ultimo: r.ultimo }
        : null;
    })
    .filter((x): x is ConversacionNueva => Boolean(x))
    .sort((a, b) => (b.ultimo?.at ?? "").localeCompare(a.ultimo?.at ?? ""));
}
