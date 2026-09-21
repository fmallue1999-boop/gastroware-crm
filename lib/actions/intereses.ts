"use server";

// Intereses (consultas abiertas): etapas, cotizaciones, nivel, alta de interés.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { consultarIA } from "@/lib/core/ia";
import { dinero, normalizarTelefono, diasDesde } from "@/lib/format";
import { NIVELES_INTERES, RUBROS } from "@/lib/constants";
import type { Etapa } from "@/lib/types";
import { usuarioActual } from "./comun";
import { anotarContacto, buscarClientePorTelefono } from "./contactos";

// =====================================================================
// Oportunidades y cotizaciones
// =====================================================================

export async function cambiarEtapa(
  oportunidadId: string,
  etapa: Etapa,
  motivo?: string
) {
  const supabase = await createClient();
  const user = await usuarioActual();
  const { data: opp } = await supabase
    .from("oportunidades")
    .select("*")
    .eq("id", oportunidadId)
    .single();
  if (!opp) return { error: "Oportunidad no encontrada" };
  if (etapa === "perdida" && !motivo)
    return { error: "El motivo de pérdida es obligatorio" };
  // Idempotente: si ya está en esa etapa no se escribe nada
  if (opp.etapa === etapa) return { ok: true };

  if (etapa === "ganada") {
    // Todo o nada en la base (fn_ganar_venta, migración 025): etapa, cierre
    // de seguimientos, cliente activo, equipo con garantía, recurrencia del
    // consumible y actividad. Si algo falla no queda nada a medias.
    const { error: errRpc } = await supabase.rpc("fn_ganar_venta", {
      p_oportunidad_id: oportunidadId,
    });
    if (errRpc) return { error: `cerrar la venta: ${errRpc.message}` };
    revalidatePath("/", "layout");
    return { ok: true };
  }

  const update: Record<string, unknown> = { etapa };
  if (etapa === "perdida") {
    update.closed_at = new Date().toISOString();
    update.motivo_perdida = motivo;
    // Un interés cerrado no tiene próximo contacto
    update.proximo_contacto = null;
    update.proximo_nota = null;
  }
  // El circuito de la venta arranca al ganar; si se reabre o se pierde, se apaga
  update.pedido_estado = null;
  const { error: errUpd } = await supabase
    .from("oportunidades")
    .update(update)
    .eq("id", oportunidadId);
  if (errUpd) return { error: errUpd.message };

  if (etapa === "perdida") {
    // Consulta cerrada: no queda ningún seguimiento colgado
    const { error: errTareas } = await supabase
      .from("tareas")
      .update({ cancelada: true })
      .eq("oportunidad_id", oportunidadId)
      .is("completada_at", null);
    if (errTareas) return { error: `cerrar seguimientos: ${errTareas.message}` };
  }

  // Sin cadencias ni recordatorios automáticos: el equipo pidió que el CRM
  // no agende nada solo. Los seguimientos los carga cada persona a mano.

  const TEXTO_ETAPA: Record<string, string> = {
    nueva: "Vuelve a Interesado",
    cotizada: "Cotizado",
    seguimiento: "En seguimiento",
    espera: "Pasó a lista de espera (sin stock)",
    ganada: "Vendido",
    perdida: "No se dio",
  };
  await supabase.from("actividades").insert({
    cliente_id: opp.cliente_id,
    oportunidad_id: oportunidadId,
    tipo: "cambio_etapa",
    contenido: `${TEXTO_ETAPA[etapa] ?? etapa}${motivo ? ` (${motivo})` : ""}`,
    created_by: user?.id ?? null,
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function guardarDiagnostico(
  oportunidadId: string,
  diagnostico: Record<string, string | number | null>
) {
  const supabase = await createClient();
  const { data: opp } = await supabase
    .from("oportunidades")
    .select("etapa, diagnostico")
    .eq("id", oportunidadId)
    .single();
  if (!opp) return { error: "Oportunidad no encontrada" };

  const update: Record<string, unknown> = {
    diagnostico: { ...opp.diagnostico, ...diagnostico },
  };
  await supabase.from("oportunidades").update(update).eq("id", oportunidadId);
  revalidatePath("/", "layout");
  return { ok: true };
}
export type ItemCotizacion = {
  productoId: string | null;
  descripcion: string;
  cantidad: number;
  precioUnit: number;
};

/** Registra una cotización nueva (o una nueva versión de la última). */
export async function registrarCotizacion(input: {
  oportunidadId: string;
  monto: number | null;
  moneda: string;
  forma_pago?: string;
  archivoPath?: string | null;
  notas?: string;
  items?: ItemCotizacion[];
  vigenciaDias?: number | null;
}) {
  const supabase = await createClient();
  const user = await usuarioActual();

  const { data: existente } = await supabase
    .from("cotizaciones")
    .select("id, numero, versiones:cotizacion_versiones(version)")
    .eq("oportunidad_id", input.oportunidadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let cotizacionId = existente?.id as string | undefined;
  let numeroCot = (existente?.numero as number | undefined) ?? null;
  let version = 1;
  if (cotizacionId) {
    const versiones = (existente?.versiones ?? []) as { version: number }[];
    version = Math.max(0, ...versiones.map((v) => v.version)) + 1;
  } else {
    const { data: nueva, error } = await supabase
      .from("cotizaciones")
      .insert({ oportunidad_id: input.oportunidadId })
      .select("id, numero")
      .single();
    if (error || !nueva) return { error: error?.message ?? "No se pudo crear" };
    cotizacionId = nueva.id;
    numeroCot = nueva.numero as number;
  }

  // Con ítems del catálogo, el total se calcula solo; si no, vale el monto a mano
  const items = (input.items ?? []).filter(
    (i) => i.descripcion.trim() && i.cantidad > 0
  );
  const total = items.length
    ? items.reduce((s, i) => s + i.cantidad * i.precioUnit, 0)
    : input.monto;

  const { data: ver, error: errV } = await supabase
    .from("cotizacion_versiones")
    .insert({
      cotizacion_id: cotizacionId,
      version,
      total,
      moneda: input.moneda,
      forma_pago: input.forma_pago || null,
      vigencia_dias: input.vigenciaDias ?? null,
      archivo_path: input.archivoPath ?? null,
      condiciones: input.notas?.trim() || null,
      creado_por: user?.id ?? null,
    })
    .select("id")
    .single();
  if (errV || !ver) return { error: errV?.message ?? "No se pudo crear la versión" };

  if (items.length) {
    const { error: errI } = await supabase.from("cotizacion_items").insert(
      items.map((i) => ({
        version_id: ver.id,
        producto_id: i.productoId,
        descripcion: i.descripcion.trim(),
        cantidad: i.cantidad,
        precio_unit: i.precioUnit,
      }))
    );
    if (errI) return { error: errI.message };
  }

  const { error: errMonto } = await supabase
    .from("oportunidades")
    .update({ monto_estimado: total, moneda: input.moneda })
    .eq("id", input.oportunidadId);
  if (errMonto) return { error: `guardar monto: ${errMonto.message}` };

  const { data: actual } = await supabase
    .from("oportunidades")
    .select("etapa, cliente_id")
    .eq("id", input.oportunidadId)
    .single();
  if (actual)
    await supabase.from("actividades").insert({
      cliente_id: actual.cliente_id,
      oportunidad_id: input.oportunidadId,
      tipo: "cotizacion",
      contenido: `Cotización N° ${numeroCot ?? "?"}${version > 1 ? ` v${version}` : ""} armada${
        total != null ? ` · ${dinero(total, input.moneda)}` : ""
      }`,
      created_by: user?.id ?? null,
    });

  // Una venta ya cerrada (ganada/perdida) no vuelve a "cotizada": solo
  // queda registrada la nueva versión.
  if (actual && ["ganada", "perdida"].includes(actual.etapa)) {
    revalidatePath("/", "layout");
    return { ok: true };
  }
  return cambiarEtapa(input.oportunidadId, "cotizada");
}

export async function setObjecion(oportunidadId: string, objecion: string) {
  const supabase = await createClient();
  await supabase
    .from("oportunidades")
    .update({ objecion_principal: objecion || null })
    .eq("id", oportunidadId);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Nivel de interés (Muy interesado / Interesado / Solo preguntó). Queda en Movimientos. */
export async function setTemperatura(oportunidadId: string, temperatura: string) {
  const supabase = await createClient();
  const user = await usuarioActual();
  const { data: opp } = await supabase
    .from("oportunidades")
    .select("cliente_id, temperatura")
    .eq("id", oportunidadId)
    .single();
  if (!opp) return { error: "No se encontró el interés" };
  const { error } = await supabase
    .from("oportunidades")
    .update({ temperatura: temperatura || null })
    .eq("id", oportunidadId);
  if (error) return { error: error.message };
  const label = NIVELES_INTERES.find((n) => n.value === temperatura)?.label;
  if (label && opp.temperatura !== temperatura)
    await supabase.from("actividades").insert({
      cliente_id: opp.cliente_id,
      oportunidad_id: oportunidadId,
      tipo: "interes",
      contenido: `Nivel de interés: ${label}`,
      created_by: user?.id ?? null,
    });
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Los últimos movimientos de un interés (para desplegar una tarjeta del embudo). */
export async function ultimosMovimientos(oportunidadId: string, cantidad = 3) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("actividades")
    .select("id, contenido, created_at, usuario:usuarios(nombre)")
    .eq("oportunidad_id", oportunidadId)
    .order("created_at", { ascending: false })
    .limit(cantidad);
  return ((data ?? []) as unknown as { id: string; contenido: string | null; created_at: string; usuario: { nombre: string } | null }[]).map(
    (a) => ({ id: a.id, contenido: a.contenido ?? "", created_at: a.created_at, quien: a.usuario?.nombre ?? null })
  );
}

/** Cambia el producto (o el texto) de un interés abierto. Queda en Movimientos. */
export async function cambiarProductoInteres(
  oportunidadId: string,
  productoIds: string[],
  texto?: string
) {
  const ids = productoIds.filter(Boolean);
  const t = texto?.trim() || null;
  if (!ids.length && !t) return { error: "Elegí un producto o escribí qué le interesa" };
  const supabase = await createClient();
  const user = await usuarioActual();
  const { data: opp } = await supabase
    .from("oportunidades")
    .select("id, cliente_id")
    .eq("id", oportunidadId)
    .single();
  if (!opp) return { error: "No se encontró el interés" };
  const { data: prods } = ids.length
    ? await supabase.from("productos").select("id, nombre").in("id", ids)
    : { data: [] };
  const nombres = (prods ?? []).map((p) => p.nombre).join(", ");
  const { error } = await supabase
    .from("oportunidades")
    .update({ producto_id: ids[0] ?? null, productos_extra: ids.slice(1), mensaje_inicial: t })
    .eq("id", oportunidadId);
  if (error) return { error: error.message };
  await supabase.from("actividades").insert({
    cliente_id: opp.cliente_id,
    oportunidad_id: oportunidadId,
    tipo: "interes",
    contenido: `Ahora le interesa: ${[nombres, t].filter(Boolean).join(" — ")}`,
    created_by: user?.id ?? null,
  });
  revalidatePath("/", "layout");
  return { ok: true as const };
}
export async function iaRedactarMensaje(
  oportunidadId: string,
  objetivo: string
) {
  const supabase = await createClient();
  const user = await usuarioActual();

  // Contexto acotado: SOLO esta oportunidad (RLS filtra por el usuario)
  const [{ data: opp }, { data: actividades }] = await Promise.all([
    supabase
      .from("oportunidades")
      .select(
        "etapa, temperatura, origen, monto_estimado, moneda, mensaje_inicial, objecion_principal, diagnostico, created_at, cliente:clientes(nombre_comercial, rubro), producto:productos(nombre, precio_referencia, moneda, descripcion, destacados, garantia_meses)"
      )
      .eq("id", oportunidadId)
      .single(),
    supabase
      .from("actividades")
      .select("tipo, contenido, created_at")
      .eq("oportunidad_id", oportunidadId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  if (!opp) return { error: "Oportunidad no encontrada" };

  const contexto = JSON.stringify({
    cliente: opp.cliente,
    producto: opp.producto,
    etapa: opp.etapa,
    temperatura: opp.temperatura,
    origen: opp.origen,
    monto_cotizado: opp.monto_estimado
      ? `${opp.moneda} ${opp.monto_estimado}`
      : null,
    objecion: opp.objecion_principal,
    diagnostico: opp.diagnostico,
    consulta_inicial: opp.mensaje_inicial,
    dias_desde_alta: diasDesde(opp.created_at),
    ultimas_actividades: actividades,
  });

  const res = await consultarIA<{ mensaje: string; fuentes: string[] }>({
    supabase,
    usuarioId: user?.id ?? null,
    funcion: "mensaje_oportunidad",
    instrucciones: `Redactá UN mensaje de WhatsApp corto (3 a 6 líneas) para este cliente, con objetivo: ${objetivo}. Personalizado con su nombre, su rubro y lo que se habló. Terminá con una pregunta concreta que invite a responder. Sin saludos larguísimos ni formalidad excesiva.`,
    contexto,
    esquema: {
      type: "object",
      properties: {
        mensaje: { type: "string" },
        fuentes: { type: "array", items: { type: "string" } },
      },
      required: ["mensaje", "fuentes"],
      additionalProperties: false,
    },
  });
  return res.ok ? { ok: true, ...res.datos } : { error: res.error };
}
/** Agrega "le interesa X" a un contacto que ya existe. */
export async function crearInteres(input: {
  clienteId: string;
  productoIds?: string[];
  texto?: string;
  origen?: string;
  nivel?: string;
  enEspera?: boolean;
}) {
  const productoIds = (input.productoIds ?? []).filter(Boolean);
  const texto = input.texto?.trim() || null;
  if (!productoIds.length && !texto)
    return { error: "Elegí un producto o escribí qué le interesa" };
  const supabase = await createClient();
  const user = await usuarioActual();
  const nivel = ["caliente", "tibio", "frio"].includes(input.nivel ?? "")
    ? input.nivel
    : null;
  const { data: prods } = productoIds.length
    ? await supabase.from("productos").select("id, nombre").in("id", productoIds)
    : { data: [] };
  const nombres = (prods ?? []).map((p) => p.nombre).join(", ");
  const { data: nuevo, error } = await supabase
    .from("oportunidades")
    .insert({
      cliente_id: input.clienteId,
      producto_id: productoIds[0] ?? null,
      productos_extra: productoIds.slice(1),
      comercial_id: user?.id ?? null,
      origen: input.origen || "Otro",
      pedido: "general",
      etapa: input.enEspera ? "espera" : "nueva",
      temperatura: nivel,
      mensaje_inicial: texto,
    })
    .select("id")
    .single();
  if (error || !nuevo) return { error: error?.message ?? "No se pudo guardar el interés" };
  await supabase.from("actividades").insert({
    cliente_id: input.clienteId,
    oportunidad_id: nuevo.id,
    tipo: "interes",
    contenido: `Nuevo interés: ${[nombres, texto].filter(Boolean).join(" — ") || "un producto"}${
      nivel === "caliente" ? " (muy interesado)" : ""
    }${input.enEspera ? " — en lista de espera (sin stock)" : ""}`,
    created_by: user?.id ?? null,
  });
  revalidatePath("/", "layout");
  return { ok: true as const, id: nuevo.id as string };
}
// =====================================================================
// Nuevo interés: primero qué quiere, después quién (de la base o nuevo)
// =====================================================================

/**
 * La acción principal del equipo de ventas. Arranca por el interés
 * ("una licuadora") y recién después asigna a quién: un contacto de la
 * base, o uno nuevo con nombre y teléfono. Si el teléfono ya existe, se
 * asigna a ese contacto sin preguntar.
 */
export async function registrarInteres(input: {
  productoIds?: string[];
  interesTexto?: string;
  nivel?: string;
  enEspera?: boolean;
  /** Contacto elegido de la base. */
  clienteId?: string;
  /** O contacto nuevo: */
  nombre?: string;
  telefono?: string;
  email?: string;
  empresa?: string;
  esCliente?: boolean;
  origen?: string;
  rubro?: string;
  ciudad?: string;
  nota?: string;
  volverEl?: string;
}) {
  const productoIds = (input.productoIds ?? []).filter(Boolean);
  const interes = input.interesTexto?.trim() || null;
  if (!productoIds.length && !interes)
    return { error: "Elegí qué le interesa, o escribilo" };

  const supabase = await createClient();
  const user = await usuarioActual();

  let clienteId = input.clienteId;
  const telefono = normalizarTelefono(input.telefono ?? "");
  if (!clienteId && telefono.length >= 6) {
    const dup = await buscarClientePorTelefono(telefono);
    if (dup) clienteId = dup.id;
  }

  if (!clienteId) {
    const nombre = input.nombre?.trim() ?? "";
    const email = input.email?.trim().toLowerCase() || null;
    if (!nombre) return { error: "Falta el nombre de quien consulta" };
    if (telefono.length < 6 && !email)
      return { error: "Cargá un teléfono o un email para poder contactarlo" };
    const empresa = input.empresa?.trim();
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
        notas: empresa ? `Contacto: ${nombre}` : null,
      })
      .select("id")
      .single();
    if (error || !nuevo)
      return { error: error?.message ?? "No se pudo crear el contacto" };
    clienteId = nuevo.id as string;
    if (input.ciudad?.trim()) {
      await supabase.from("sucursales").insert({
        cliente_id: clienteId,
        nombre: "Principal",
        ciudad: input.ciudad.trim(),
        es_principal: true,
      });
    }
    await supabase.from("actividades").insert({
      cliente_id: clienteId,
      tipo: "nota",
      contenido: `${input.esCliente ? "Cliente" : "Contacto"} cargado desde un interés${
        input.origen ? ` (${input.origen})` : ""
      }`,
      created_by: user?.id ?? null,
    });
  }

  const r = await crearInteres({
    clienteId,
    productoIds,
    texto: interes ?? undefined,
    origen: input.origen,
    nivel: input.nivel,
    enEspera: input.enEspera,
  });
  if ("error" in r) return { error: r.error };

  if (input.nota?.trim() || input.volverEl) {
    const a = await anotarContacto(clienteId, input.nota ?? "", input.volverEl || null, {
      oportunidadId: r.id,
    });
    if ("error" in a) return { error: a.error };
  }

  revalidatePath("/", "layout");
  redirect(`/clientes/${clienteId}?aviso=interes`);
}
