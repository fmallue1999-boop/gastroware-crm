"use server";

// Feria (HOTELGA): lectura de credencial, alta de lead y seguimiento.

import { revalidatePath } from "next/cache";
import { avisarAlCelular } from "@/lib/servidor/push";
import { createClient } from "@/lib/supabase/server";
import { consultarIA } from "@/lib/core/ia";
import { rolActual } from "@/lib/auth";
import { RUBROS } from "@/lib/constants";
import { usuarioActual } from "./comun";

/**
 * Lee una foto de credencial de feria con la IA y devuelve los campos para
 * precargar el formulario de captura. Lo que no se lee, vuelve vacío.
 */
export async function iaLeerCredencial(imagenBase64: string) {
  if (!imagenBase64) return { error: "Falta la foto" };
  const supabase = await createClient();
  const user = await usuarioActual();

  const res = await consultarIA<{
    nombre: string;
    apellido: string;
    empresa: string;
    email: string;
    telefono: string;
    rubro: string;
    provincia: string;
  }>({
    supabase,
    usuarioId: user?.id ?? null,
    funcion: "leer_credencial",
    maxTokens: 1000,
    imagen: { base64: imagenBase64, mediaType: "image/jpeg" },
    instrucciones: `La imagen es una credencial/acreditación de una feria gastronómica argentina (o una tarjeta personal). Extraé los datos visibles de la persona:
- nombre (solo el nombre de pila) y apellido
- empresa (razón social o nombre del negocio)
- email y telefono si figuran
- rubro: mapealo a UNO de: ${RUBROS.join(", ")} — si no se puede inferir, dejá vacío
- provincia: provincia argentina si figura o se infiere de la ciudad; si no, vacío
Devolvé string vacío en todo campo que no se lea con claridad. NO inventes datos.`,
    contexto: "Captura de leads en stand de feria (HOTELGA).",
    esquema: {
      type: "object",
      properties: {
        nombre: { type: "string" },
        apellido: { type: "string" },
        empresa: { type: "string" },
        email: { type: "string" },
        telefono: { type: "string" },
        rubro: { type: "string" },
        provincia: { type: "string" },
      },
      required: ["nombre", "apellido", "empresa", "email", "telefono", "rubro", "provincia"],
      additionalProperties: false,
    },
  });
  return res.ok ? { ok: true, ...res.datos } : { error: res.error };
}

/**
 * Captura rápida de lead en feria: crea (o reutiliza, dedup por teléfono y
 * email) el cliente como prospecto, abre la consulta con origen HOTELGA y
 * guarda la foto de la credencial en sus documentos. Sin tarea automática:
 * el seguimiento post-feria se hace por campañas.
 */
export async function crearLeadFeria(input: {
  nombre: string;
  apellido: string;
  empresa: string;
  email: string;
  telefono: string;
  lineas: string[];
  rubro: string;
  provincia: string;
  nota?: string;
  fotoBase64?: string;
}) {
  const nombreCompleto = `${input.nombre.trim()} ${input.apellido.trim()}`.trim();
  if (!nombreCompleto && !input.empresa.trim())
    return { error: "Cargá al menos el nombre o la empresa" };
  if (!input.telefono.trim() && !input.email.trim())
    return { error: "Cargá teléfono o email (sino después no lo podemos contactar)" };

  const supabase = await createClient();
  const user = await usuarioActual();

  // Todo o nada en la base (fn_crear_lead_feria, migración 025): contacto
  // (o el existente por teléfono/email), oportunidad, seguimiento de feria
  // y actividad. Devuelve {cliente_id, oportunidad_id, existente}.
  const { data: resultado, error: errRpc } = await supabase.rpc("fn_crear_lead_feria", {
    p: {
      nombre: input.nombre,
      apellido: input.apellido,
      empresa: input.empresa,
      email: input.email,
      telefono: input.telefono,
      lineas: input.lineas,
      rubro: (RUBROS as readonly string[]).includes(input.rubro) ? input.rubro : "Otro",
      provincia: input.provincia,
      nota: input.nota ?? "",
    },
  });
  if (errRpc) return { error: errRpc.message };
  const { cliente_id: clienteId, oportunidad_id: oppId, existente } = (resultado ?? {}) as {
    cliente_id?: string;
    oportunidad_id?: string;
    existente?: boolean;
  };
  if (!clienteId || !oppId) return { error: "No se pudo cargar el contacto de la feria" };
  const opp = { id: oppId };

  // Foto de la credencial → documentos del cliente (subida por el servidor)
  if (input.fotoBase64) {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/\s+/g, "");
    if (serviceKey) {
      const { createClient: createAdmin } = await import("@supabase/supabase-js");
      const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const path = `feria/${opp.id}.jpg`;
      const bytes = Buffer.from(input.fotoBase64, "base64");
      const { error: errFoto } = await admin.storage
        .from("documentos")
        .upload(path, bytes, { contentType: "image/jpeg", upsert: true });
      if (!errFoto) {
        await supabase.from("documentos").insert({
          entidad: "cliente",
          entidad_id: clienteId,
          tipo: "foto",
          nombre: `Credencial HOTELGA 2026 — ${nombreCompleto || input.empresa}`,
          path,
          subido_por: user?.id ?? null,
        });
      }
    }
  }

  revalidatePath("/hotelga");
  return { ok: true as const, existente: !!existente };
}
// =====================================================================
// Seguimiento de feria (HOTELGA): estados, calificación, asignación
// =====================================================================

const ESTADOS_FERIA_VALIDOS = ["inicial", "contactado", "cerrado", "descartado"];

/**
 * Cambia estado, calificación u observaciones de un contacto de feria.
 * Al marcarlo contactado/cerrado/descartado queda registrado quién y cuándo,
 * y se anota en el historial del contacto (aparece en Movimientos).
 */
export async function actualizarFeriaLead(
  id: string,
  patch: { estado?: string; calificacion?: number | null; observaciones?: string }
) {
  const supabase = await createClient();
  const user = await usuarioActual();
  const { data: lead } = await supabase
    .from("feria_leads")
    .select("id, cliente_id, estado, nombre, empresa")
    .eq("id", id)
    .single();
  if (!lead) return { error: "No se encontró el contacto de feria" };

  const update: Record<string, unknown> = {};
  if (patch.estado !== undefined) {
    if (!ESTADOS_FERIA_VALIDOS.includes(patch.estado)) return { error: "Estado inválido" };
    update.estado = patch.estado;
    if (patch.estado !== "inicial") {
      update.contactado_por = user?.id ?? null;
      update.contactado_at = new Date().toISOString();
    } else {
      update.contactado_por = null;
      update.contactado_at = null;
    }
  }
  if (patch.calificacion !== undefined) {
    const c = patch.calificacion;
    update.calificacion = c == null || c < 1 ? null : Math.min(5, Math.round(c));
  }
  if (patch.observaciones !== undefined)
    update.observaciones = patch.observaciones.trim() || null;

  const { error } = await supabase.from("feria_leads").update(update).eq("id", id);
  if (error) return { error: error.message };

  if (patch.estado !== undefined && patch.estado !== lead.estado) {
    const TEXTO: Record<string, string> = {
      inicial: "vuelve a sin contactar",
      contactado: "contactado",
      cerrado: "cerrado (compró)",
      descartado: "descartado",
    };
    await supabase.from("actividades").insert({
      cliente_id: lead.cliente_id,
      tipo: "feria",
      contenido: `HOTELGA: ${TEXTO[patch.estado] ?? patch.estado}${
        patch.observaciones?.trim() ? ` — ${patch.observaciones.trim()}` : ""
      }`,
      created_by: user?.id ?? null,
    });
  }
  revalidatePath("/hotelga");
  revalidatePath(`/clientes/${lead.cliente_id}`);
  return { ok: true as const };
}

/**
 * Asigna el contacto de feria a un vendedor (solo dirección/administración).
 * También queda como comercial del contacto, con lo que pasa a verlo solo
 * ese vendedor (y dirección/administración).
 */
export async function asignarFeriaLead(id: string, usuarioId: string | null) {
  const rol = await rolActual();
  if (!["direccion", "admin"].includes(rol))
    return { error: "Solo dirección o administración asignan vendedores" };
  const supabase = await createClient();
  const user = await usuarioActual();
  const { data: lead } = await supabase
    .from("feria_leads")
    .select("id, cliente_id")
    .eq("id", id)
    .single();
  if (!lead) return { error: "No se encontró el contacto de feria" };

  const { error } = await supabase
    .from("feria_leads")
    .update({ asignado_a: usuarioId })
    .eq("id", id);
  if (error) return { error: error.message };
  await supabase
    .from("clientes")
    .update({ comercial_id: usuarioId })
    .eq("id", lead.cliente_id);

  if (usuarioId) {
    const { data: u } = await supabase
      .from("usuarios")
      .select("nombre")
      .eq("id", usuarioId)
      .single();
    await supabase.from("actividades").insert({
      cliente_id: lead.cliente_id,
      tipo: "feria",
      contenido: `HOTELGA: asignado a ${u?.nombre ?? "un vendedor"}`,
      created_by: user?.id ?? null,
    });
    if (usuarioId !== user?.id)
      await supabase.from("notificaciones").insert({
        usuario_id: usuarioId,
        tipo: "feria_asignada",
        titulo: "Te asignaron un contacto de HOTELGA",
        url: "/hotelga?vista=mios",
      });
    avisarAlCelular();
  }
  revalidatePath("/hotelga");
  revalidatePath("/", "layout");
  return { ok: true as const };
}
