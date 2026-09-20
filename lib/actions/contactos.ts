"use server";

// Contactos: alta, edición, búsqueda, notas, seguimientos y documentos.

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { consultarIA } from "@/lib/core/ia";
import { exigirGestor, rolActual } from "@/lib/auth";
import { hoyISO, sumarDias, normalizarTelefono, fechaCorta } from "@/lib/format";
import { ETAPAS_ABIERTAS, RUBROS } from "@/lib/constants";
import type { Cliente } from "@/lib/types";
import { usuarioActual, type SupabaseServidor } from "./comun";

// =====================================================================
// Clientes y leads
// =====================================================================

export async function buscarClientePorTelefono(
  telefono: string
): Promise<Cliente | null> {
  const tel = normalizarTelefono(telefono);
  if (tel.length < 6) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("clientes")
    .select("*")
    .eq("telefono", tel)
    .is("deleted_at", null)
    .maybeSingle();
  return data as Cliente | null;
}

export async function crearLead(input: {
  clienteId?: string;
  telefono: string;
  nombre_comercial: string;
  rubro?: string;
  ciudad?: string;
  /** Productos consultados: el primero queda como principal. */
  productoIds: string[];
  origen: string;
  temperatura: string;
  mensaje_inicial?: string;
  /** Qué pidió: precio / info / general — define el guión y la 1ª tarea. */
  pedido?: "precio" | "info" | "general";
}) {
  const supabase = await createClient();
  const user = await usuarioActual();

  let clienteId = input.clienteId;
  if (!clienteId) {
    const existente = await buscarClientePorTelefono(input.telefono);
    if (existente) {
      clienteId = existente.id;
    } else {
      const { data: nuevo, error } = await supabase
        .from("clientes")
        .insert({
          nombre_comercial: input.nombre_comercial.trim(),
          rubro: input.rubro || "Otro",
          telefono: input.telefono,
          comercial_id: user?.id ?? null,
        })
        .select("id")
        .single();
      if (error || !nuevo)
        return { error: error?.message ?? "No se pudo crear el cliente" };
      clienteId = nuevo.id;
      if (input.ciudad?.trim()) {
        await supabase.from("sucursales").insert({
          cliente_id: clienteId,
          nombre: "Principal",
          ciudad: input.ciudad.trim(),
          es_principal: true,
        });
      }
    }
  }

  const pedido = input.pedido ?? "general";
  const { data: opp, error: errOpp } = await supabase
    .from("oportunidades")
    .insert({
      cliente_id: clienteId,
      producto_id: input.productoIds[0] || null,
      productos_extra: input.productoIds.slice(1),
      pedido,
      comercial_id: user?.id ?? null,
      origen: input.origen,
      temperatura: input.temperatura || null,
      mensaje_inicial: input.mensaje_inicial?.trim() || null,
    })
    .select("id")
    .single();
  if (errOpp || !opp)
    return { error: errOpp?.message ?? "No se pudo crear la oportunidad" };

  // Sin tarea automática: el seguimiento lo agenda la persona cuando hace falta.
  const ETIQUETA_PEDIDO: Record<string, string> = {
    precio: " — pidió precio directo",
    info: " — pidió info",
    general: "",
  };
  await supabase.from("actividades").insert({
    cliente_id: clienteId,
    oportunidad_id: opp.id,
    tipo: "nota",
    contenido: `Lead creado (${input.origen})${ETIQUETA_PEDIDO[pedido]}${input.mensaje_inicial ? `: ${input.mensaje_inicial}` : ""}`,
    created_by: user?.id ?? null,
  });

  revalidatePath("/", "layout");
  redirect(`/clientes/${clienteId}?interes=${opp.id}`);
}

/** Alta de cliente directo, sin crear una consulta (para cargar la cartera). */
export async function crearCliente(input: {
  nombre_comercial: string;
  telefono?: string;
  rubro: string;
  ciudad?: string;
  razon_social?: string;
  cuit?: string;
  email?: string;
  notas?: string;
  /** "cliente_activo" si ya compró alguna vez; "prospecto" si todavía no. */
  estado?: "cliente_activo" | "prospecto";
}): Promise<{ error: string } | { ok: true; id: string }> {
  const supabase = await createClient();
  const user = await usuarioActual();

  const telefono = input.telefono?.replace(/\D/g, "") || null;
  if (telefono) {
    const dup = await buscarClientePorTelefono(telefono);
    if (dup)
      return {
        error: `Ese teléfono ya está cargado como "${dup.nombre_comercial}". Buscalo en Clientes en vez de crearlo de nuevo.`,
      };
  }

  const { data, error } = await supabase
    .from("clientes")
    .insert({
      nombre_comercial: input.nombre_comercial.trim(),
      rubro: input.rubro,
      telefono,
      razon_social: input.razon_social?.trim() || null,
      cuit: input.cuit?.replace(/\D/g, "") || null,
      email: input.email?.trim() || null,
      notas: input.notas?.trim() || null,
      estado: input.estado ?? "prospecto",
      comercial_id: user?.id ?? null,
    })
    .select("id")
    .single();
  if (error || !data)
    return {
      error:
        error?.code === "23505"
          ? "Ya existe un cliente con ese CUIT"
          : error?.message ?? "No se pudo crear el cliente",
    };

  if (input.ciudad?.trim()) {
    await supabase.from("sucursales").insert({
      cliente_id: data.id,
      nombre: "Principal",
      ciudad: input.ciudad.trim(),
      es_principal: true,
    });
  }

  await supabase.from("actividades").insert({
    cliente_id: data.id,
    tipo: "nota",
    contenido: "Cliente cargado manualmente",
    created_by: user?.id ?? null,
  });

  revalidatePath("/", "layout");
  return { ok: true, id: data.id };
}

/**
 * Borrado de cliente (solo dirección/admin). Es borrado suave: la ficha y su
 * historial quedan guardados en la base pero desaparecen de todos los listados.
 * Cierra las consultas abiertas y cancela las tareas pendientes para que no
 * queden colgadas en el pipeline ni en Hoy.
 */
export async function eliminarCliente(clienteId: string) {
  const rol = await rolActual();
  if (!["direccion", "admin"].includes(rol))
    return { error: "Solo dirección o administración pueden borrar clientes" };
  const supabase = await createClient();
  const user = await usuarioActual();

  await supabase
    .from("oportunidades")
    .update({ etapa: "perdida", motivo_perdida: "Cliente eliminado" })
    .eq("cliente_id", clienteId)
    .not("etapa", "in", "(ganada,perdida)");
  await supabase
    .from("tareas")
    .update({ cancelada: true })
    .eq("cliente_id", clienteId)
    .is("completada_at", null);

  const { error } = await supabase
    .from("clientes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", clienteId);
  if (error) return { error: error.message };

  await supabase.from("actividades").insert({
    cliente_id: clienteId,
    tipo: "nota",
    contenido: "Cliente eliminado",
    created_by: user?.id ?? null,
  });

  revalidatePath("/", "layout");
  redirect("/clientes");
}

export async function actualizarCliente(
  clienteId: string,
  patch: Record<string, string | null>
) {
  const permitidos = [
    "razon_social",
    "nombre_comercial",
    "cuit",
    "condicion_fiscal",
    "rubro",
    "telefono",
    "email",
    "instagram_web",
    "estado",
    "potencial",
    "comercial_id",
    "notas",
  ];
  const limpio: Record<string, string | null> = {};
  for (const k of permitidos) if (k in patch) limpio[k] = patch[k] || null;
  const supabase = await createClient();
  const { error } = await supabase
    .from("clientes")
    .update(limpio)
    .eq("id", clienteId);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function crearSucursal(input: {
  clienteId: string;
  nombre: string;
  direccion?: string;
  ciudad?: string;
  provincia?: string;
  telefono?: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("sucursales").insert({
    cliente_id: input.clienteId,
    nombre: input.nombre.trim() || "Sucursal",
    direccion: input.direccion?.trim() || null,
    ciudad: input.ciudad?.trim() || null,
    provincia: input.provincia?.trim() || null,
    telefono: input.telefono?.trim() || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function agregarNota(
  clienteId: string,
  contenido: string,
  oportunidadId?: string | null
) {
  if (!contenido.trim()) return { error: "Nota vacía" };
  const supabase = await createClient();
  const user = await usuarioActual();
  await supabase.from("actividades").insert({
    cliente_id: clienteId,
    oportunidad_id: oportunidadId ?? null,
    tipo: "nota",
    contenido: contenido.trim(),
    created_by: user?.id ?? null,
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
// =====================================================================
// Tareas
// =====================================================================

export async function completarTarea(tareaId: string, resultado?: string) {
  const supabase = await createClient();
  const user = await usuarioActual();
  const { data: tarea } = await supabase
    .from("tareas")
    .select("*")
    .eq("id", tareaId)
    .single();
  if (!tarea) return { error: "Tarea no encontrada" };

  await supabase
    .from("tareas")
    .update({ completada_at: new Date().toISOString() })
    .eq("id", tareaId);

  if (resultado) {
    await supabase.from("actividades").insert({
      cliente_id: tarea.cliente_id,
      oportunidad_id: tarea.oportunidad_id,
      tipo: "nota",
      contenido: `${tarea.titulo} → ${resultado}`,
      created_by: user?.id ?? null,
    });
  }

  if (tarea.recurrencia_id) {
    const { data: rec } = await supabase
      .from("recurrencias")
      .select("*")
      .eq("id", tarea.recurrencia_id)
      .single();
    if (rec) {
      await supabase
        .from("recurrencias")
        .update({
          ultima_compra: hoyISO(),
          proxima_alerta: sumarDias(rec.frecuencia_dias),
        })
        .eq("id", rec.id);
    }
  }

  let sinProximaAccion = false;
  if (tarea.oportunidad_id) {
    const { count } = await supabase
      .from("tareas")
      .select("id", { count: "exact", head: true })
      .eq("oportunidad_id", tarea.oportunidad_id)
      .is("completada_at", null)
      .eq("cancelada", false);
    const { data: opp } = await supabase
      .from("oportunidades")
      .select("etapa")
      .eq("id", tarea.oportunidad_id)
      .single();
    sinProximaAccion =
      (count ?? 0) === 0 && !!opp && !["ganada", "perdida"].includes(opp.etapa);
  }

  revalidatePath("/", "layout");
  return {
    ok: true,
    sinProximaAccion,
    oportunidadId: tarea.oportunidad_id as string | null,
  };
}

/**
 * Pospone una tarea: `hasta` puede ser una cantidad de días (+3, +7…) o una
 * fecha exacta "YYYY-MM-DD" elegida en el calendario. Si viene un motivo
 * ("está de vacaciones"), queda registrado en el historial del cliente.
 */
export async function posponerTarea(
  tareaId: string,
  hasta: number | string,
  motivo?: string
) {
  const supabase = await createClient();
  const vence = typeof hasta === "number" ? sumarDias(hasta) : hasta;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(vence) || vence < hoyISO())
    return { error: "Elegí una fecha de hoy en adelante" };

  const { error } = await supabase
    .from("tareas")
    .update({ vence_el: vence })
    .eq("id", tareaId);
  if (error) return { error: error.message };

  if (motivo?.trim()) {
    const user = await usuarioActual();
    const { data: tarea } = await supabase
      .from("tareas")
      .select("cliente_id, oportunidad_id, titulo")
      .eq("id", tareaId)
      .single();
    if (tarea)
      await supabase.from("actividades").insert({
        cliente_id: tarea.cliente_id,
        oportunidad_id: tarea.oportunidad_id,
        tipo: "nota",
        contenido: `Seguimiento pospuesto al ${fechaCorta(vence)}: ${motivo.trim()}`,
        created_by: user?.id ?? null,
      });
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Vendedor responsable del contacto (solo dirección/administración). Con
 * eso pasa a verlo ese vendedor (y dirección/administración). Queda en
 * Movimientos.
 */
export async function asignarComercial(clienteId: string, usuarioId: string | null) {
  const bloqueo = await exigirGestor();
  if (bloqueo) return bloqueo;
  const supabase = await createClient();
  const user = await usuarioActual();
  const { error } = await supabase
    .from("clientes")
    .update({ comercial_id: usuarioId })
    .eq("id", clienteId);
  if (error) return { error: error.message };
  let nombre = "un vendedor";
  if (usuarioId) {
    const { data: u } = await supabase.from("usuarios").select("nombre").eq("id", usuarioId).single();
    nombre = u?.nombre ?? nombre;
  }
  await supabase.from("actividades").insert({
    cliente_id: clienteId,
    tipo: "nota",
    contenido: usuarioId ? `Ahora lo atiende ${nombre}` : "Queda sin vendedor asignado",
    created_by: user?.id ?? null,
  });
  revalidatePath("/", "layout");
  return { ok: true as const };
}
export async function setNoContactar(clienteId: string, valor: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("clientes")
    .update({ no_contactar: valor })
    .eq("id", clienteId);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}
export async function iaResumenCliente(clienteId: string) {
  const supabase = await createClient();
  const user = await usuarioActual();

  const [cliente, equipos, opps, acts, ots] = await Promise.all([
    supabase
      .from("clientes")
      .select("nombre_comercial, rubro, estado, potencial, notas, created_at")
      .eq("id", clienteId)
      .single(),
    supabase
      .from("equipos")
      .select("numero_serie, origen, estado, garantia_hasta, fecha_venta, producto:productos(nombre), marca_modelo_libre")
      .eq("cliente_id", clienteId)
      .is("deleted_at", null),
    supabase
      .from("oportunidades")
      .select("etapa, monto_estimado, moneda, motivo_perdida, created_at, producto:productos(nombre)")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("actividades")
      .select("tipo, contenido, created_at")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("ordenes_trabajo")
      .select("numero, estado, tipo, problema, created_at")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  if (!cliente.data) return { error: "Cliente no encontrado" };

  const contexto = JSON.stringify({
    cliente: cliente.data,
    equipos: equipos.data,
    oportunidades: opps.data,
    actividades_recientes: acts.data,
    ordenes_servicio: ots.data,
    hoy: hoyISO(),
  });

  const res = await consultarIA<{
    resumen: string[];
    alertas: string[];
    proxima_accion: string;
    fuentes: string[];
  }>({
    supabase,
    usuarioId: user?.id ?? null,
    funcion: "resumen_cliente",
    instrucciones: `Armá el resumen ejecutivo de este cliente para un vendedor que lo va a llamar en 2 minutos: "resumen" con 3 a 5 puntos clave de la relación (qué compró, qué consulta, cómo viene), "alertas" con riesgos u oportunidades concretas (garantías por vencer, consultas sin responder, servicio pendiente; lista vacía si no hay), y "proxima_accion" con UNA acción recomendada, específica.`,
    contexto,
    esquema: {
      type: "object",
      properties: {
        resumen: { type: "array", items: { type: "string" } },
        alertas: { type: "array", items: { type: "string" } },
        proxima_accion: { type: "string" },
        fuentes: { type: "array", items: { type: "string" } },
      },
      required: ["resumen", "alertas", "proxima_accion", "fuentes"],
      additionalProperties: false,
    },
  });
  return res.ok ? { ok: true, ...res.datos } : { error: res.error };
}
// =====================================================================
// Buscador global
// =====================================================================

export async function buscarClientes(q: string): Promise<Cliente[]> {
  // Comas y paréntesis rompen el filtro "or" de PostgREST
  const t = q.trim().replace(/[,()]/g, " ").trim();
  if (t.length < 2) return [];
  const supabase = await createClient();
  const digitos = t.replace(/\D/g, "");
  // Nombre, empresa (razón social o "Contacto: X" en notas), email, teléfono, CUIT
  const filtros = [
    `nombre_comercial.ilike.%${t}%`,
    `razon_social.ilike.%${t}%`,
    `email.ilike.%${t}%`,
    `notas.ilike.%${t}%`,
  ];
  if (digitos.length >= 4) {
    filtros.push(`telefono.ilike.%${digitos}%`);
    filtros.push(`cuit.ilike.%${digitos}%`);
  }

  const [porNombre, porSerie] = await Promise.all([
    supabase
      .from("clientes")
      .select("*, sucursales(ciudad, es_principal)")
      .or(filtros.join(","))
      .is("deleted_at", null)
      .limit(10),
    supabase
      .from("equipos")
      .select("cliente:clientes(*, sucursales(ciudad, es_principal))")
      .ilike("numero_serie", `%${t}%`)
      .limit(5),
  ]);

  type ConSucursales = Cliente & {
    sucursales?: { ciudad: string | null; es_principal: boolean }[];
  };
  const aplanar = (c: ConSucursales): Cliente => {
    const { sucursales, ...resto } = c;
    const principal =
      (sucursales ?? []).find((s) => s.es_principal) ?? (sucursales ?? [])[0];
    return { ...resto, ciudad: principal?.ciudad ?? null };
  };

  const resultado = new Map<string, Cliente>();
  for (const c of (porNombre.data ?? []) as ConSucursales[])
    resultado.set(c.id, aplanar(c));
  for (const e of (porSerie.data ?? []) as unknown as {
    cliente: ConSucursales | null;
  }[]) {
    if (e.cliente) resultado.set(e.cliente.id, aplanar(e.cliente));
  }
  return Array.from(resultado.values()).slice(0, 10);
}
// =====================================================================
// Documentos adjuntos (el archivo ya subido al bucket 'documentos')
// =====================================================================

export async function registrarDocumento(input: {
  entidad: "cliente" | "equipo" | "orden" | "oportunidad" | "repuesto";
  entidadId: string;
  tipo: string;
  nombre: string;
  path: string;
}) {
  const supabase = await createClient();
  const user = await usuarioActual();
  const { error } = await supabase.from("documentos").insert({
    entidad: input.entidad,
    entidad_id: input.entidadId,
    tipo: input.tipo || "otro",
    nombre: input.nombre.trim(),
    path: input.path,
    subido_por: user?.id ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function borrarDocumento(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("documentos").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}
/**
 * Interés abierto sobre el que se anota: el indicado (si es del contacto),
 * o el más reciente. Con `crear`, si el contacto no tiene ninguno se crea
 * uno mínimo con el texto como interés, para que el pendiente tenga dónde
 * vivir. Devuelve null si no hay interés y no se pidió crear.
 */
async function interesObjetivo(
  supabase: SupabaseServidor,
  clienteId: string,
  usuarioId: string | null,
  oportunidadId?: string | null,
  crear = false,
  texto?: string
): Promise<{ id: string; etapa: string } | null> {
  if (oportunidadId) {
    const { data } = await supabase
      .from("oportunidades")
      .select("id, etapa")
      .eq("id", oportunidadId)
      .eq("cliente_id", clienteId)
      .maybeSingle();
    if (data) return data as { id: string; etapa: string };
  }
  const { data: ultimo } = await supabase
    .from("oportunidades")
    .select("id, etapa")
    .eq("cliente_id", clienteId)
    .in("etapa", [...ETAPAS_ABIERTAS])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (ultimo) return ultimo as { id: string; etapa: string };
  if (!crear) return null;
  const { data: nuevo } = await supabase
    .from("oportunidades")
    .insert({
      cliente_id: clienteId,
      comercial_id: usuarioId,
      origen: "Otro",
      pedido: "general",
      etapa: "nueva",
      mensaje_inicial: texto?.trim().slice(0, 120) || "Seguimiento",
    })
    .select("id, etapa")
    .single();
  return (nuevo as { id: string; etapa: string } | null) ?? null;
}

/**
 * Próximo contacto de un interés: uno solo, cambiarlo reemplaza el anterior.
 * Vive en oportunidades.proximo_contacto / proximo_nota (migración 026); el
 * módulo comercial no agenda tareas. `fecha` null = "Sin fecha": el interés
 * queda visible en gris, sin próxima fecha. Si el contacto no tiene interés
 * abierto, se crea uno mínimo.
 */
async function agendarVolver(
  supabase: SupabaseServidor,
  clienteId: string,
  fecha: string | null,
  usuarioId: string | null,
  nota?: string,
  oportunidadId?: string | null
): Promise<{ error: string } | { ok: true; oportunidadId: string }> {
  if (fecha && (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha < hoyISO()))
    return { error: "Elegí una fecha de hoy en adelante" };
  const interes = await interesObjetivo(supabase, clienteId, usuarioId, oportunidadId, true, nota);
  if (!interes) return { error: "No se pudo ubicar el interés del contacto" };
  const { error } = await supabase
    .from("oportunidades")
    .update({
      proximo_contacto: fecha,
      proximo_nota: fecha ? nota?.trim().slice(0, 80) || null : null,
    })
    .eq("id", interes.id);
  if (error) return { error: error.message };
  return { ok: true as const, oportunidadId: interes.id };
}
/**
 * Alta de contacto (cliente o interesado) con lo mínimo: nombre y un modo de
 * contactarlo. Todo lo demás es opcional y se completa después en la ficha.
 */
export async function crearContacto(input: {
  nombre: string;
  telefono?: string;
  email?: string;
  empresa?: string;
  esCliente?: boolean;
  /** Productos que le interesan (catálogo) y/o texto libre. */
  productoIds?: string[];
  interesTexto?: string;
  origen?: string;
  rubro?: string;
  ciudad?: string;
  nota?: string;
  /** Fecha para volver a contactar (YYYY-MM-DD), opcional. */
  volverEl?: string;
  /** Cuánto le interesa: caliente (muy) / tibio / frio. */
  nivel?: string;
  /** true = quiere comprar pero no hay stock: entra en lista de espera. */
  enEspera?: boolean;
}) {
  const nombre = input.nombre.trim();
  if (!nombre) return { error: "Falta el nombre" };
  const telefono = normalizarTelefono(input.telefono ?? "");
  const email = input.email?.trim().toLowerCase() || null;
  if (telefono.length < 6 && !email)
    return { error: "Cargá un teléfono o un email para poder contactarlo" };

  const supabase = await createClient();
  const user = await usuarioActual();

  if (telefono.length >= 6) {
    const dup = await buscarClientePorTelefono(telefono);
    if (dup)
      return {
        error: `Ese teléfono ya está cargado como "${dup.nombre_comercial}"`,
        existenteId: dup.id,
      };
  }

  const empresa = input.empresa?.trim();
  const nota = input.nota?.trim() || null;
  const notas =
    [empresa ? `Contacto: ${nombre}` : null, nota].filter(Boolean).join(" | ") ||
    null;

  const { data: nuevo, error } = await supabase
    .from("clientes")
    .insert({
      nombre_comercial: empresa || nombre,
      rubro: (RUBROS as readonly string[]).includes(input.rubro ?? "")
        ? input.rubro
        : "Otro",
      telefono: telefono.length >= 6 ? telefono : null,
      email,
      estado: input.esCliente ? "cliente_activo" : "prospecto",
      comercial_id: user?.id ?? null,
      notas,
    })
    .select("id")
    .single();
  if (error || !nuevo)
    return { error: error?.message ?? "No se pudo crear el contacto" };
  const clienteId = nuevo.id as string;

  if (input.ciudad?.trim()) {
    await supabase.from("sucursales").insert({
      cliente_id: clienteId,
      nombre: "Principal",
      ciudad: input.ciudad.trim(),
      es_principal: true,
    });
  }

  const productoIds = (input.productoIds ?? []).filter(Boolean);
  const interes = input.interesTexto?.trim() || null;
  const nivel = ["caliente", "tibio", "frio"].includes(input.nivel ?? "")
    ? input.nivel
    : null;
  const enEspera = !!input.enEspera && (productoIds.length > 0 || !!interes);
  if (productoIds.length || interes) {
    await supabase.from("oportunidades").insert({
      cliente_id: clienteId,
      producto_id: productoIds[0] ?? null,
      productos_extra: productoIds.slice(1),
      comercial_id: user?.id ?? null,
      origen: input.origen || "Otro",
      pedido: "general",
      etapa: enEspera ? "espera" : "nueva",
      temperatura: nivel,
      mensaje_inicial: interes,
    });
  }

  await supabase.from("actividades").insert({
    cliente_id: clienteId,
    tipo: "nota",
    contenido: `${input.esCliente ? "Cliente" : "Interesado"} cargado${
      input.origen ? ` (${input.origen})` : ""
    }${interes ? `: ${interes}` : ""}${
      nivel === "caliente" ? " — muy interesado" : ""
    }${enEspera ? " — en lista de espera (sin stock)" : ""}${nota ? ` — ${nota}` : ""}`,
    created_by: user?.id ?? null,
  });

  if (input.volverEl) {
    const r = await agendarVolver(supabase, clienteId, input.volverEl, user?.id ?? null);
    if ("error" in r) return { error: r.error };
  }

  revalidatePath("/", "layout");
  redirect(`/clientes/${clienteId}`);
}

/**
 * "¿Qué pasó?": guarda el movimiento en el historial del contacto (sobre el
 * interés elegido, o el más reciente) y, si se eligió fecha, la deja como
 * próximo contacto de ese interés. "Sin fecha" la borra. Un interés cotizado
 * pasa solo a "En seguimiento" cuando hubo contacto después de cotizar.
 * Es la acción diaria del equipo.
 */
export async function anotarContacto(
  clienteId: string,
  texto: string,
  volverEl?: string | null,
  opciones?: { oportunidadId?: string | null; sinFecha?: boolean }
) {
  const contenido = texto.trim();
  const sinFecha = !!opciones?.sinFecha && !volverEl;
  if (!contenido && !volverEl && !sinFecha)
    return { error: "Escribí qué pasó o elegí cuándo volver a contactar" };
  const supabase = await createClient();
  const user = await usuarioActual();
  const usuarioId = user?.id ?? null;

  // Interés sobre el que se anota: si hay fecha y el contacto no tiene
  // ninguno abierto, se crea uno mínimo (el pendiente necesita dónde vivir).
  const interes = await interesObjetivo(
    supabase,
    clienteId,
    usuarioId,
    opciones?.oportunidadId,
    !!volverEl,
    contenido
  );

  const { error } = await supabase.from("actividades").insert({
    cliente_id: clienteId,
    oportunidad_id: interes?.id ?? null,
    tipo: "nota",
    contenido:
      contenido ||
      (volverEl
        ? `Volver a contactar el ${fechaCorta(volverEl)}`
        : "Queda sin próxima fecha"),
    created_by: usuarioId,
  });
  if (error) return { error: error.message };

  if (volverEl) {
    const r = await agendarVolver(
      supabase,
      clienteId,
      volverEl,
      usuarioId,
      contenido || undefined,
      interes?.id
    );
    if ("error" in r) return { error: r.error };
  } else if (sinFecha && interes) {
    const { error: errSin } = await supabase
      .from("oportunidades")
      .update({ proximo_contacto: null, proximo_nota: null })
      .eq("id", interes.id);
    if (errSin) return { error: errSin.message };
  }

  if (interes?.etapa === "cotizada" && contenido) {
    await supabase
      .from("oportunidades")
      .update({ etapa: "seguimiento" })
      .eq("id", interes.id)
      .eq("etapa", "cotizada");
  }

  revalidatePath("/", "layout");
  return { ok: true as const, oportunidadId: interes?.id ?? null };
}

/** De quién ver los pendientes del inicio (gestores): mios / todos / id de vendedor. Se recuerda. */
export async function guardarPreferenciaPendientes(quien: string) {
  const valor = quien.trim().slice(0, 40);
  const cookieStore = await cookies();
  cookieStore.set("pendientes_quien", valor, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
  return { ok: true as const };
}
