"use server";

// Marketing: segmentos, campañas WhatsApp y email, redacción y diseño con IA.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { consultarIA } from "@/lib/core/ia";
import { enviarEmail } from "@/lib/core/email";
import { rolActual } from "@/lib/auth";
import { hoyISO, sumarDias } from "@/lib/format";
import { usuarioActual } from "./comun";

// =====================================================================
// Marketing: segmentos dinámicos + campañas WhatsApp asistidas
// =====================================================================

export type FiltrosSegmento = {
  estados?: string[];
  rubros?: string[];
  marca?: string;
  ciudad?: string;
  dormidoMeses?: number | null;
  garantiaDias?: number | null;
  conRecurrencia?: boolean;
};

type ClienteSegmento = {
  id: string;
  nombre_comercial: string;
  telefono: string | null;
  email: string | null;
};

/**
 * Supabase corta cada consulta en 1000 filas aunque se pida más: esta
 * función pagina con range() hasta traer todo (la base ya supera los 5000).
 */
async function traerTodo<T>(
  arma: (desde: number, hasta: number) => PromiseLike<{ data: unknown[] | null }>
): Promise<T[]> {
  const todo: T[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data } = await arma(desde, desde + 999);
    const pagina = (data ?? []) as T[];
    todo.push(...pagina);
    if (pagina.length < 1000) break;
  }
  return todo;
}

async function evaluarSegmento(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filtros: FiltrosSegmento
): Promise<ClienteSegmento[]> {
  type Fila = ClienteSegmento & { sucursales?: { ciudad: string | null }[] };
  let lista = await traerTodo<Fila>((desde, hasta) => {
    let q = supabase
      .from("clientes")
      .select("id, nombre_comercial, telefono, email, sucursales(ciudad)")
      .is("deleted_at", null)
      .eq("no_contactar", false)
      .order("id")
      .range(desde, hasta);
    if (filtros.estados?.length) q = q.in("estado", filtros.estados);
    if (filtros.rubros?.length) q = q.in("rubro", filtros.rubros);
    return q;
  });

  if (filtros.ciudad?.trim()) {
    const c = filtros.ciudad.trim().toLowerCase();
    lista = lista.filter((f) =>
      (f.sucursales ?? []).some((s) => (s.ciudad ?? "").toLowerCase().includes(c))
    );
  }

  if (filtros.marca?.trim()) {
    const m = filtros.marca.trim().toLowerCase();
    type EquipoFila = {
      cliente_id: string;
      marca_modelo_libre: string | null;
      producto: { marca: string | null; nombre: string | null } | null;
      modelo: { marca: string | null } | null;
    };
    const eqs = await traerTodo<EquipoFila>((desde, hasta) =>
      supabase
        .from("equipos")
        .select(
          "cliente_id, marca_modelo_libre, producto:productos(marca, nombre), modelo:modelos(marca)"
        )
        .is("deleted_at", null)
        .order("id")
        .range(desde, hasta)
    );
    const con = new Set(
      eqs
        .filter((e) => {
          const marcas = [
            e.producto?.marca,
            e.producto?.nombre,
            e.modelo?.marca,
            e.marca_modelo_libre,
          ];
          return marcas.some((x) => (x ?? "").toLowerCase().includes(m));
        })
        .map((e) => e.cliente_id)
    );
    lista = lista.filter((f) => con.has(f.id));
  }

  if (filtros.garantiaDias) {
    const eqs = await traerTodo<{ cliente_id: string }>((desde, hasta) =>
      supabase
        .from("equipos")
        .select("cliente_id, garantia_hasta")
        .is("deleted_at", null)
        .gte("garantia_hasta", hoyISO())
        .lte("garantia_hasta", sumarDias(filtros.garantiaDias!))
        .order("id")
        .range(desde, hasta)
    );
    const con = new Set(eqs.map((e) => e.cliente_id));
    lista = lista.filter((f) => con.has(f.id));
  }

  if (filtros.conRecurrencia) {
    const recs = await traerTodo<{ cliente_id: string }>((desde, hasta) =>
      supabase
        .from("recurrencias")
        .select("cliente_id")
        .eq("activa", true)
        .order("id")
        .range(desde, hasta)
    );
    const con = new Set(recs.map((r) => r.cliente_id));
    lista = lista.filter((f) => con.has(f.id));
  }

  if (filtros.dormidoMeses) {
    const corte = sumarDias(-30 * filtros.dormidoMeses);
    const acts = await traerTodo<{ cliente_id: string }>((desde, hasta) =>
      supabase
        .from("actividades")
        .select("cliente_id")
        .gte("created_at", corte)
        .order("id")
        .range(desde, hasta)
    );
    const activos = new Set(acts.map((a) => a.cliente_id));
    lista = lista.filter((f) => !activos.has(f.id));
  }

  return lista.map(({ id, nombre_comercial, telefono, email }) => ({
    id,
    nombre_comercial,
    telefono,
    email,
  }));
}

export async function previewSegmento(filtros: FiltrosSegmento) {
  const supabase = await createClient();
  const lista = await evaluarSegmento(supabase, filtros);
  const conTelefono = lista.filter((c) => c.telefono).length;
  const conEmail = lista.filter((c) => c.email).length;
  return {
    total: lista.length,
    conTelefono,
    conEmail,
    muestra: lista.slice(0, 5).map((c) => c.nombre_comercial),
  };
}

export async function crearCampania(input: {
  nombre: string;
  filtros: FiltrosSegmento;
  plantilla: string;
  canal?: "whatsapp" | "email";
  asunto?: string;
  /** Email diseñado por IA (HTML completo con {nombre} y {baja}). */
  html?: string;
  /** true = guardar como borrador (la lista se congela recién al activar). */
  borrador?: boolean;
}) {
  const rol = await rolActual();
  if (!["direccion", "admin", "marketing"].includes(rol))
    return { error: "Sin permiso para crear campañas" };
  if (!input.nombre.trim()) return { error: "Falta el nombre de la campaña" };
  if (!input.plantilla.trim()) return { error: "Falta el mensaje" };
  const canal = input.canal ?? "whatsapp";
  if (canal === "email" && !input.asunto?.trim())
    return { error: "Falta el asunto del email" };

  const supabase = await createClient();
  const user = await usuarioActual();
  const lista = (await evaluarSegmento(supabase, input.filtros)).filter((c) =>
    canal === "email" ? c.email : c.telefono
  );
  if (lista.length === 0)
    return {
      error:
        canal === "email"
          ? "El segmento no tiene clientes con email. Ajustá los filtros."
          : "El segmento no tiene clientes con teléfono. Ajustá los filtros.",
    };

  const { data: camp, error } = await supabase
    .from("campanias")
    .insert({
      nombre: input.nombre.trim(),
      canal,
      asunto: input.asunto?.trim() || null,
      html: canal === "email" ? input.html?.trim() || null : null,
      filtros: input.filtros,
      plantilla: input.plantilla.trim(),
      estado: input.borrador ? "borrador" : "en_curso",
      creado_por: user?.id ?? null,
    })
    .select("id")
    .single();
  if (error || !camp) return { error: error?.message ?? "No se pudo crear" };

  // En borrador la lista NO se congela: se arma recién al activar
  if (!input.borrador) {
    const { error: errDest } = await supabase.from("campania_destinatarios").insert(
      lista.map((c) => ({ campania_id: camp.id, cliente_id: c.id }))
    );
    if (errDest) return { error: errDest.message };
  }

  revalidatePath("/", "layout");
  redirect(`/marketing/${camp.id}`);
}

/** Activa una campaña en borrador: congela la lista del segmento y arranca. */
export async function activarCampania(campaniaId: string) {
  const rol = await rolActual();
  if (!["direccion", "admin", "marketing"].includes(rol))
    return { error: "Sin permiso para activar campañas" };
  const supabase = await createClient();
  const { data: camp } = await supabase
    .from("campanias")
    .select("id, canal, filtros, estado")
    .eq("id", campaniaId)
    .single();
  if (!camp) return { error: "Campaña no encontrada" };
  if (camp.estado !== "borrador") return { error: "La campaña ya está activa" };

  const lista = (
    await evaluarSegmento(supabase, (camp.filtros ?? {}) as FiltrosSegmento)
  ).filter((c) => (camp.canal === "email" ? c.email : c.telefono));
  if (lista.length === 0)
    return { error: "El segmento quedó vacío. Editá los filtros creando otra campaña." };

  const { error: errDest } = await supabase.from("campania_destinatarios").insert(
    lista.map((c) => ({ campania_id: camp.id, cliente_id: c.id }))
  );
  if (errDest) return { error: errDest.message };

  const { error } = await supabase
    .from("campanias")
    .update({ estado: "en_curso" })
    .eq("id", campaniaId);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { ok: true, destinatarios: lista.length };
}

/** Manda el email de la campaña a la casilla del usuario logueado, para verlo real. */
export async function enviarPruebaCampania(input: {
  asunto: string;
  plantilla: string;
  html?: string;
}) {
  const rol = await rolActual();
  if (!["direccion", "admin", "marketing"].includes(rol))
    return { error: "Sin permiso" };
  const user = await usuarioActual();
  if (!user?.email) return { error: "Tu usuario no tiene email" };

  const supabase = await createClient();
  const { data: cfgLogo } = await supabase
    .from("config")
    .select("valor")
    .eq("clave", "logo_url")
    .maybeSingle();

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://gastroware-crm.vercel.app";
  const html = input.html?.trim()
    ? input.html
        .replaceAll("{nombre}", "Juan Pérez")
        .replaceAll("{baja}", `${base}/api/baja`)
    : htmlCampania(
        rellenarPlantillaServidor(input.plantilla, "Juan Pérez"),
        `${base}/api/baja`,
        cfgLogo?.valor?.trim() || null
      );
  const res = await enviarEmail({
    para: user.email,
    asunto: `[PRUEBA] ${rellenarPlantillaServidor(input.asunto || "Sin asunto", "Juan Pérez")}`,
    html,
  });
  if ("error" in res) return { error: res.error };
  return { ok: true, para: user.email };
}

export async function marcarDestinatario(
  destinatarioId: string,
  estado: "enviado" | "salteado"
) {
  const supabase = await createClient();
  const user = await usuarioActual();
  const { data: dest, error } = await supabase
    .from("campania_destinatarios")
    .update({
      estado,
      enviado_at: estado === "enviado" ? new Date().toISOString() : null,
      enviado_por: user?.id ?? null,
    })
    .eq("id", destinatarioId)
    .select("campania_id, cliente_id")
    .single();
  if (error || !dest) return { error: error?.message ?? "No se pudo marcar" };

  if (estado === "enviado") {
    const { data: camp } = await supabase
      .from("campanias")
      .select("nombre")
      .eq("id", dest.campania_id)
      .single();
    await supabase.from("actividades").insert({
      cliente_id: dest.cliente_id,
      tipo: "nota",
      contenido: `Campaña "${camp?.nombre ?? ""}": mensaje enviado por WhatsApp`,
      created_by: user?.id ?? null,
    });
  }

  // ¿Quedan pendientes? Si no, la campaña se cierra sola.
  const { count } = await supabase
    .from("campania_destinatarios")
    .select("id", { count: "exact", head: true })
    .eq("campania_id", dest.campania_id)
    .eq("estado", "pendiente");
  if ((count ?? 0) === 0) {
    await supabase
      .from("campanias")
      .update({ estado: "terminada" })
      .eq("id", dest.campania_id);
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Link de baja firmado (HMAC con CRON_SECRET): nadie puede dar de baja a otro. */
function urlBaja(clienteId: string): string {
  // Secreto propio para los links de baja (BAJA_SECRET); CRON_SECRET solo
  // como compatibilidad hasta que esté cargado en Vercel.
  const secreto = process.env.BAJA_SECRET || process.env.CRON_SECRET || "";
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHmac } = require("crypto") as typeof import("crypto");
  const token = createHmac("sha256", secreto).update(clienteId).digest("hex").slice(0, 32);
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://gastroware-crm.vercel.app";
  return `${base}/api/baja?c=${clienteId}&t=${token}`;
}

function htmlCampania(texto: string, bajaUrl: string, logoUrl: string | null): string {
  const parrafos = texto
    .split(/\n{2,}/)
    .map(
      (p) =>
        `<p style="margin:0 0 14px 0; line-height:1.55;">${p.replace(/\n/g, "<br/>")}</p>`
    )
    .join("");
  return `<!doctype html><html><body style="margin:0; padding:0; background:#f5f4f0;">
  <div style="max-width:560px; margin:0 auto; padding:28px 20px; font-family:Arial,Helvetica,sans-serif; font-size:15px; color:#1d1d1f;">
    <div style="background:#ffffff; border-radius:14px; padding:28px;">
      ${logoUrl ? `<img src="${logoUrl}" alt="GastroWare" style="height:44px; margin-bottom:18px;"/>` : `<p style="font-size:19px; font-weight:bold; margin:0 0 18px 0;">GastroWare</p>`}
      ${parrafos}
      <p style="margin:18px 0 0 0; line-height:1.5;">Saludos,<br/><b>GastroWare</b><br/><span style="color:#6b6b6b; font-size:13px;">Equipamiento gastronómico · Mitre 2007, Mar del Plata</span></p>
    </div>
    <p style="text-align:center; color:#9a9a94; font-size:12px; margin-top:16px;">
      Recibiste este email por ser cliente o haberte contactado con GastroWare.<br/>
      <a href="${bajaUrl}" style="color:#9a9a94;">No quiero recibir más emails</a>
    </p>
  </div>
</body></html>`;
}

/**
 * Envía una tanda de emails de la campaña (secuencial, respeta no_contactar).
 * Se manda por tandas a propósito: cuida el límite del plan de Resend y la
 * reputación del dominio (ir de a poco los primeros días).
 */
export async function enviarTandaEmail(campaniaId: string, cantidad = 50) {
  const rol = await rolActual();
  if (!["direccion", "admin", "marketing"].includes(rol))
    return { error: "Sin permiso para enviar campañas" };

  const supabase = await createClient();
  const user = await usuarioActual();
  const { data: camp } = await supabase
    .from("campanias")
    .select("id, nombre, canal, asunto, plantilla, html, estado")
    .eq("id", campaniaId)
    .single();
  if (!camp) return { error: "Campaña no encontrada" };
  if (camp.canal !== "email") return { error: "Esta campaña no es de email" };
  if (camp.estado !== "en_curso") return { error: "La campaña no está en curso" };

  const { data: cfgLogo } = await supabase
    .from("config")
    .select("valor")
    .eq("clave", "logo_url")
    .maybeSingle();
  const logoUrl = cfgLogo?.valor?.trim() || null;

  const { data: dests } = await supabase
    .from("campania_destinatarios")
    .select("id, cliente:clientes(id, nombre_comercial, email, no_contactar)")
    .eq("campania_id", campaniaId)
    .eq("estado", "pendiente")
    .limit(Math.min(Math.max(cantidad, 1), 100));

  type Dest = {
    id: string;
    cliente: {
      id: string;
      nombre_comercial: string;
      email: string | null;
      no_contactar: boolean;
    } | null;
  };
  const lista = ((dests ?? []) as unknown as Dest[]).filter((d) => d.cliente);

  let enviados = 0;
  let salteados = 0;
  let errores = 0;
  for (const d of lista) {
    const c = d.cliente!;
    if (!c.email || c.no_contactar) {
      await supabase
        .from("campania_destinatarios")
        .update({ estado: "salteado", enviado_por: user?.id ?? null })
        .eq("id", d.id);
      salteados++;
      continue;
    }
    const texto = rellenarPlantillaServidor(camp.plantilla, c.nombre_comercial);
    // Diseño de IA si existe; si no, la plantilla prolija de siempre
    const htmlFinal = camp.html
      ? camp.html
          .replaceAll("{nombre}", c.nombre_comercial)
          .replaceAll("{baja}", urlBaja(c.id))
      : htmlCampania(texto, urlBaja(c.id), logoUrl);
    const res = await enviarEmail({
      para: c.email,
      asunto: rellenarPlantillaServidor(camp.asunto ?? "", c.nombre_comercial) || camp.nombre,
      html: htmlFinal,
    });
    if ("error" in res) {
      await supabase
        .from("campania_destinatarios")
        .update({ estado: "error", error: res.error.slice(0, 300) })
        .eq("id", d.id);
      errores++;
      // Si falla la configuración (sin API key), cortar acá
      if (res.error.includes("RESEND_API_KEY")) break;
    } else {
      await supabase
        .from("campania_destinatarios")
        .update({
          estado: "enviado",
          enviado_at: new Date().toISOString(),
          enviado_por: user?.id ?? null,
        })
        .eq("id", d.id);
      await supabase.from("actividades").insert({
        cliente_id: c.id,
        tipo: "nota",
        contenido: `Campaña "${camp.nombre}": email enviado a ${c.email}`,
        created_by: user?.id ?? null,
      });
      enviados++;
    }
  }

  const { count: pendientesRestantes } = await supabase
    .from("campania_destinatarios")
    .select("id", { count: "exact", head: true })
    .eq("campania_id", campaniaId)
    .eq("estado", "pendiente");
  if ((pendientesRestantes ?? 0) === 0) {
    await supabase
      .from("campanias")
      .update({ estado: "terminada" })
      .eq("id", campaniaId);
  }

  revalidatePath("/", "layout");
  return { ok: true, enviados, salteados, errores, restantes: pendientesRestantes ?? 0 };
}

/** Reemplaza {nombre} sin depender del cliente (versión servidor). */
function rellenarPlantillaServidor(texto: string, nombre: string): string {
  return texto.replaceAll("{nombre}", nombre);
}
/**
 * Redacta una campaña con IA a partir de una descripción en una frase.
 * Usa el catálogo para nombrar bien los productos; nunca inventa precios
 * ni promociones que no estén en el pedido del usuario.
 */
export async function iaRedactarCampania(input: {
  objetivo: string;
  canal: "whatsapp" | "email";
  borradorActual?: string;
}) {
  const rol = await rolActual();
  if (!["direccion", "admin", "marketing"].includes(rol))
    return { error: "Sin permiso" };
  if (!input.objetivo.trim())
    return { error: "Contame en una frase qué querés comunicar" };

  const supabase = await createClient();
  const user = await usuarioActual();
  const { data: productos } = await supabase
    .from("productos")
    .select("nombre, categoria, marca")
    .eq("activo", true)
    .order("nombre");

  const contexto = JSON.stringify({
    empresa:
      "GastroWare — equipamiento gastronómico profesional, Mar del Plata (Mitre 2007). Marcas: GastroWare, Zumex, Rational, Jetinno. Service técnico propio y repuestos en el país.",
    canal: input.canal,
    catalogo: productos ?? [],
    borrador_actual: input.borradorActual?.trim() || null,
  });

  const res = await consultarIA<{ asunto: string; cuerpo: string }>({
    supabase,
    usuarioId: user?.id ?? null,
    funcion: "campania_marketing",
    instrucciones: `Redactá una campaña de ${input.canal === "email" ? "EMAIL" : "WhatsApp"} para los clientes de GastroWare. Objetivo del usuario: "${input.objetivo}".
Reglas:
- Español rioplatense (voseo), tono cercano y profesional, sin exagerar.
- Usá {nombre} donde va el nombre del cliente (el sistema lo reemplaza).
- ${input.canal === "email" ? "Asunto de hasta 55 caracteres, atractivo sin mayúsculas gritadas ni clickbait. Cuerpo de 4 a 8 líneas en párrafos cortos." : "Asunto: dejalo vacío. Mensaje de 3 a 6 líneas."}
- Si el objetivo menciona productos, usá el nombre EXACTO del catálogo.
- NO inventes precios, descuentos ni plazos que el usuario no haya dicho.
- Cerrá con un llamado a la acción concreto (responder este email o escribir por WhatsApp).
- Si hay borrador_actual, mejoralo respetando su idea; si no, escribí de cero.
- No firmes: la firma y el logo los agrega el sistema.`,
    contexto,
    esquema: {
      type: "object",
      properties: {
        asunto: { type: "string" },
        cuerpo: { type: "string" },
      },
      required: ["asunto", "cuerpo"],
      additionalProperties: false,
    },
  });
  return res.ok ? { ok: true, ...res.datos } : { error: res.error };
}

/**
 * Diseña un EMAIL completo con IA: HTML apto para clientes de correo
 * (tablas, estilos inline, 600px), con el logo, bloques de producto si
 * corresponde, botón de acción y pie con el link de baja ({baja}).
 */
export async function iaDisenarCampania(input: {
  objetivo: string;
  borradorActual?: string;
}) {
  const rol = await rolActual();
  if (!["direccion", "admin", "marketing"].includes(rol))
    return { error: "Sin permiso" };
  if (!input.objetivo.trim())
    return { error: "Contame en una frase qué querés comunicar" };

  const supabase = await createClient();
  const user = await usuarioActual();
  const [{ data: productos }, { data: cfgLogo }] = await Promise.all([
    supabase
      .from("productos")
      .select("nombre, marca, categoria, descripcion, destacados, imagen_url")
      .eq("activo", true)
      .order("nombre"),
    supabase.from("config").select("valor").eq("clave", "logo_url").maybeSingle(),
  ]);

  // Fichas completas solo de los productos que el objetivo menciona
  const objetivoLower = input.objetivo.toLowerCase();
  const mencionados = (productos ?? []).filter((p) =>
    p.nombre
      .toLowerCase()
      .split(/[\s—-]+/)
      .some((palabra: string) => palabra.length > 3 && objetivoLower.includes(palabra))
  );

  const contexto = JSON.stringify({
    empresa:
      "GastroWare — equipamiento gastronómico profesional, Mitre 2007, Mar del Plata. WhatsApp +54 9 223 340-0755 · www.gastroware.com.ar. Marcas: GastroWare, Zumex, Rational, Jetinno. Service propio y repuestos en el país.",
    logo_url: cfgLogo?.valor?.trim() || null,
    paleta: {
      tinta: "#1d1d1f",
      celeste: "#2f6fce",
      crema: "#f5f4f0",
      blanco: "#ffffff",
    },
    catalogo_nombres: (productos ?? []).map((p) => p.nombre),
    productos_mencionados: mencionados.slice(0, 4),
    borrador_actual: input.borradorActual?.trim() || null,
  });

  const res = await consultarIA<{ asunto: string; texto: string; html: string }>({
    supabase,
    usuarioId: user?.id ?? null,
    funcion: "campania_diseno",
    maxTokens: 8000,
    instrucciones: `Diseñá un EMAIL de marketing completo para GastroWare. Objetivo del usuario: "${input.objetivo}".

Devolvé tres cosas:
1. "asunto": hasta 55 caracteres, atractivo, sin mayúsculas gritadas.
2. "texto": la versión texto plano del mensaje (4-8 líneas, voseo rioplatense, con {nombre}).
3. "html": el email diseñado COMPLETO.

Reglas del HTML (crítico — debe verse bien en Gmail y Outlook):
- Documento completo con <html> y <body>, layout con TABLAS anidadas y estilos INLINE (nada de flexbox, grid, <style> externo, JavaScript ni fuentes externas). Ancho máximo 600px centrado, fondo exterior ${"#f5f4f0"}.
- Tarjeta blanca con esquinas redondeadas. Arriba el logo: si logo_url existe usá <img src="..." height="44">; si es null, el texto "GastroWare" en negrita 20px.
- Saludo con {nombre} (el sistema lo reemplaza por el nombre real del cliente).
- Si hay productos_mencionados, armá un bloque por producto (máximo 2): imagen (solo si imagen_url no es null, width 100% máx 520px con borde redondeado), nombre en negrita, 2-3 destacados como viñetas cortas.
- Un botón de acción "bulletproof" (tabla con celda de fondo ${"#2f6fce"}, texto blanco, padding 12px 28px, esquinas redondeadas) que enlace a https://wa.me/5492233400755 con un texto de acción claro.
- Pie: datos de la empresa en gris chico y un enlace con href EXACTAMENTE igual a {baja} y texto "No quiero recibir más emails". NO reemplaces {baja} por nada: es un marcador del sistema.
- Voseo rioplatense, tono profesional cercano. NO inventes precios, descuentos ni plazos que el usuario no haya dicho. Usá nombres EXACTOS del catálogo.
- Si hay borrador_actual, respetá su idea mejorándola.`,
    contexto,
    esquema: {
      type: "object",
      properties: {
        asunto: { type: "string" },
        texto: { type: "string" },
        html: { type: "string" },
      },
      required: ["asunto", "texto", "html"],
      additionalProperties: false,
    },
  });
  if (!res.ok) return { error: res.error };
  if (!res.datos.html.includes("{baja}"))
    return { error: "El diseño salió sin el link de baja. Probá de nuevo." };
  return { ok: true, ...res.datos };
}
