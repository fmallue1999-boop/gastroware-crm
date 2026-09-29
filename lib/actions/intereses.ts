"use server";

// Intereses (consultas abiertas): etapas, cotizaciones, nivel, alta de interés.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { consultarIA } from "@/lib/core/ia";
import { dinero, normalizarTelefono, diasDesde, hoyISO, sumarDias } from "@/lib/format";
import { sugerenciaSinRespuesta } from "@/lib/cadencia";
import { evaluarFueraDeLista, type PrecioLista } from "@/lib/propuestas";
import { NIVELES_INTERES, RUBROS } from "@/lib/constants";
import type { Etapa } from "@/lib/types";
import { avisar, puestoActual, regla, usuarioActual, usuariosDePuesto } from "./comun";
import { camposDeRuta, rutearConsulta } from "@/lib/servidor/ruteo";
import { anotarContacto, buscarDuplicados } from "./contactos";

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
  /** Plazo, financiación o bonificación fuera de lo normal: la aprueba dirección. */
  condicionEspecial?: boolean;
  /** Descuento especial pedido para la operación (% sobre el total) y su motivo. */
  descuentoPct?: number | null;
  descuentoMotivo?: string | null;
  /** v1.8: IVA que se suma en el PDF (10,5 / 21; 0 = no se discrimina), entrega y tipo de cambio. */
  ivaPct?: number | null;
  plazoEntrega?: string | null;
  condicionEntrega?: string | null;
  tipoCambio?: number | null;
}) {
  if (input.ivaPct != null && !(input.ivaPct >= 0 && input.ivaPct <= 27)) return { error: "El IVA no es válido" };
  if (input.tipoCambio != null && !(input.tipoCambio > 0)) return { error: "El tipo de cambio tiene que ser mayor a cero" };
  const descuento = input.descuentoPct && input.descuentoPct > 0 ? Math.min(99, input.descuentoPct) : 0;
  if (descuento && !input.descuentoMotivo?.trim()) return { error: "Contá por qué pide el descuento especial" };
  const supabase = await createClient();
  const user = await usuarioActual();
  const rol = await puestoActual(supabase);

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
  const subtotal = items.length
    ? items.reduce((s, i) => s + i.cantidad * i.precioUnit, 0)
    : input.monto;
  const total = subtotal != null && descuento ? Math.round(subtotal * (1 - descuento / 100) * 100) / 100 : subtotal;

  // Fuera de lista → esperando aprobación de dirección (dirección no se aprueba a sí misma)
  const idsLista = items.map((i) => i.productoId).filter(Boolean) as string[];
  const { data: lista } = idsLista.length
    ? await supabase.from("productos").select("id, nombre, precio_referencia, moneda, precio_ars, precio_usd, codigo, detalle_tecnico").in("id", idsLista)
    : { data: [] };
  const pctLibre = Number((await regla(supabase, "descuento_libre_pct")) ?? "0") || 0;
  // Cada línea se compara con la lista al precio que queda después del descuento especial
  const efectivos = items.map((i) => ({ ...i, precioUnit: i.precioUnit * (1 - descuento / 100) }));
  const fuera = evaluarFueraDeLista(efectivos, (lista ?? []) as PrecioLista[], input.moneda, pctLibre, !!input.condicionEspecial);
  if (descuento > pctLibre) {
    fuera.requiere = true;
    fuera.motivos.unshift(`Descuento especial ${descuento}%: ${input.descuentoMotivo?.trim()}`);
  }
  const aprobacion = fuera.requiere && rol !== "direccion" ? "pendiente" : "no_requiere";

  const { data: ver, error: errV } = await supabase
    .from("cotizacion_versiones")
    .insert({
      cotizacion_id: cotizacionId,
      version,
      total,
      subtotal: descuento ? subtotal : null,
      descuento_pct: descuento || null,
      descuento_motivo: descuento ? input.descuentoMotivo?.trim() || null : null,
      moneda: input.moneda,
      forma_pago: input.forma_pago || null,
      vigencia_dias: input.vigenciaDias ?? null,
      archivo_path: input.archivoPath ?? null,
      condiciones: input.notas?.trim() || null,
      iva_pct: input.ivaPct ?? null,
      plazo_entrega: input.plazoEntrega?.trim() || null,
      condicion_entrega: input.condicionEntrega?.trim() || null,
      tipo_cambio: input.moneda === "USD" ? input.tipoCambio ?? null : null,
      creado_por: user?.id ?? null,
      aprobacion,
      aprobacion_motivo: fuera.requiere ? fuera.motivos.join(" · ") : null,
    })
    .select("id")
    .single();
  if (errV || !ver) return { error: errV?.message ?? "No se pudo crear la versión" };

  if (items.length) {
    // Código y detalle técnico del catálogo, como estaban al cotizar
    const delCatalogo = new Map(((lista ?? []) as { id: string; codigo?: string | null; detalle_tecnico?: string | null }[]).map((p) => [p.id, p]));
    const { error: errI } = await supabase.from("cotizacion_items").insert(
      items.map((i) => ({
        version_id: ver.id,
        producto_id: i.productoId,
        codigo: (i.productoId && delCatalogo.get(i.productoId)?.codigo) || null,
        detalle: (i.productoId && delCatalogo.get(i.productoId)?.detalle_tecnico) || null,
        descripcion: i.descripcion.trim(),
        cantidad: i.cantidad,
        precio_unit: i.precioUnit,
        descuento_pct: descuento || 0,
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
        total != null ? ` · ${dinero(total, input.moneda)}${input.ivaPct ? " + IVA" : ""}` : ""
      }${aprobacion === "pendiente" ? ` · fuera de lista, esperando aprobación de dirección (${fuera.motivos.join("; ")})` : ""}`,
      created_by: user?.id ?? null,
    });
  if (actual && aprobacion === "pendiente") {
    const direccion = await usuariosDePuesto(supabase, ["direccion"]);
    await avisar(
      supabase,
      direccion,
      {
        tipo: "propuesta_a_aprobar",
        titulo: `Propuesta para aprobar: N° ${numeroCot ?? "?"}${total != null ? ` · ${dinero(total, input.moneda)}` : ""}`,
        cuerpo: fuera.motivos.join(" · "),
        url: "/aprobaciones",
      },
      user?.id
    );
  }

  // Lo que necesita el formulario para ofrecer el PDF al toque
  const hecha = { ok: true as const, cotizacionId: cotizacionId as string, numero: numeroCot, version, pendiente: aprobacion === "pendiente" };
  // Una venta ya cerrada (ganada/perdida) no vuelve a "cotizada": solo
  // queda registrada la nueva versión.
  if (actual && ["ganada", "perdida"].includes(actual.etapa)) {
    revalidatePath("/", "layout");
    return hecha;
  }
  const etapa = await cambiarEtapa(input.oportunidadId, "cotizada");
  if (etapa && "error" in etapa && etapa.error) return { error: etapa.error };
  return hecha;
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
  /** Lugar de entrega: decide el territorio y el vendedor (manual 1.1 paso 2). */
  zonaEntrega?: string | null;
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
    ? await supabase.from("productos").select("id, nombre, moneda").in("id", productoIds)
    : { data: [] };
  const nombres = (prods ?? []).map((p) => p.nombre).join(", ");
  const monedaProducto = (prods ?? []).find((p) => p.id === productoIds[0])?.moneda === "USD" ? "USD" : "ARS";
  const ruta = await rutearConsulta(supabase, { zona: input.zonaEntrega, creadorId: user?.id ?? null });
  const { data: nuevo, error } = await supabase
    .from("oportunidades")
    .insert({
      cliente_id: input.clienteId,
      producto_id: productoIds[0] ?? null,
      productos_extra: productoIds.slice(1),
      ...camposDeRuta(ruta, hoyISO(), !!input.enEspera),
      origen: input.origen || "Otro",
      pedido: "general",
      etapa: input.enEspera ? "espera" : "nueva",
      temperatura: nivel,
      mensaje_inicial: texto,
      moneda: monedaProducto,
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
    }${input.enEspera ? " — en lista de espera (sin stock)" : ""}${
      ruta.zona ? ` · se entrega en ${ruta.zona}` : ""
    }${ruta.derivada && ruta.responsableNombre ? ` · asignada a ${ruta.responsableNombre}` : ""}${
      !ruta.comercialId ? " · sin asignar: falta dónde se entrega" : ""
    }`,
    created_by: user?.id ?? null,
  });
  if (ruta.comercialId)
    await supabase.from("clientes").update({ comercial_id: ruta.comercialId }).eq("id", input.clienteId).is("comercial_id", null);
  if (ruta.derivada)
    await avisar(
      supabase,
      [ruta.comercialId],
      {
        tipo: "consulta_asignada",
        titulo: `Consulta nueva de tu territorio: ${[nombres, texto].filter(Boolean).join(" — ") || "un producto"}. Primer contacto dentro de la hora.`,
        url: `/clientes/${input.clienteId}?interes=${nuevo.id}`,
      },
      user?.id
    );
  revalidatePath("/", "layout");
  return { ok: true as const, id: nuevo.id as string, responsable: ruta.responsableNombre, derivada: ruta.derivada };
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
  provincia?: string;
  nota?: string;
  volverEl?: string;
  zonaEntrega?: string | null;
  /** Ya se avisó de posibles duplicados y se eligió cargarlo igual. */
  crearIgual?: boolean;
}) {
  const productoIds = (input.productoIds ?? []).filter(Boolean);
  const interes = input.interesTexto?.trim() || null;
  if (!productoIds.length && !interes)
    return { error: "Elegí qué le interesa, o escribilo" };

  const supabase = await createClient();
  const user = await usuarioActual();

  let clienteId = input.clienteId;
  const telefono = normalizarTelefono(input.telefono ?? "");
  // Posibles duplicados: se avisa y la persona elige (no se une solo)
  if (!clienteId && !input.crearIgual) {
    const duplicados = await buscarDuplicados(telefono, input.email);
    if (duplicados.length) return { duplicados };
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
        // Con lugar de entrega, el dueño lo pone el ruteo (vendedor del territorio)
        comercial_id: input.zonaEntrega ? null : user?.id ?? null,
      })
      .select("id")
      .single();
    if (error || !nuevo)
      return { error: error?.message ?? "No se pudo crear el contacto" };
    clienteId = nuevo.id as string;
    // La persona, separada de la empresa
    await supabase.from("contactos").insert({
      cliente_id: clienteId,
      nombre,
      telefono: telefono.length >= 6 ? telefono : null,
      email,
      es_decisor: true,
    });
    if (input.ciudad?.trim() || input.provincia?.trim()) {
      await supabase.from("sucursales").insert({
        cliente_id: clienteId,
        nombre: "Principal",
        ciudad: input.ciudad?.trim() || null,
        provincia: input.provincia?.trim() || null,
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
    zonaEntrega: input.zonaEntrega,
  });
  if ("error" in r) return { error: r.error };

  if (input.nota?.trim() || input.volverEl) {
    const a = await anotarContacto(clienteId, input.nota ?? "", input.volverEl || null, {
      oportunidadId: r.id,
    });
    if ("error" in a) return { error: a.error };
  }

  revalidatePath("/", "layout");
  redirect(`/clientes/${clienteId}?aviso=${r.derivada ? "asignada" : "interes"}`);
}

// =====================================================================
// Asignación por territorio y calificación (manual 1.1 pasos 2 y 3)
// =====================================================================

type ConsultaFila = {
  id: string;
  cliente_id: string;
  comercial_id: string | null;
  territorio: string | null;
  zona_entrega: string | null;
  etapa: string;
  cliente: { nombre_comercial: string } | null;
};

async function cargarConsulta(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  const { data } = await supabase
    .from("oportunidades")
    .select("id, cliente_id, comercial_id, territorio, zona_entrega, etapa, cliente:clientes(nombre_comercial)")
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as ConsultaFila | null) ?? null;
}

async function aplicarAsignacion(
  supabase: Awaited<ReturnType<typeof createClient>>,
  c: ConsultaFila,
  zona: string,
  motivo: string,
  userId: string | null
) {
  const ruta = await rutearConsulta(supabase, { zona, creadorId: null });
  if (!ruta.territorio) return { error: "Elegí un lugar de entrega de la lista" };
  const campos = camposDeRuta({ ...ruta, derivada: true }, hoyISO(), c.etapa === "espera");
  const { error } = await supabase.from("oportunidades").update(campos).eq("id", c.id);
  if (error) return { error: error.message };
  // El contacto sigue a la consulta si no tenía dueño o era del vendedor anterior
  if (ruta.comercialId)
    await supabase
      .from("clientes")
      .update({ comercial_id: ruta.comercialId })
      .eq("id", c.cliente_id)
      .or(c.comercial_id ? `comercial_id.is.null,comercial_id.eq.${c.comercial_id}` : "comercial_id.is.null");
  await supabase.from("actividades").insert({
    cliente_id: c.cliente_id,
    oportunidad_id: c.id,
    tipo: "interes",
    contenido: `${motivo}: se entrega en ${zona} · asignada a ${ruta.responsableNombre ?? "dirección"}`,
    created_by: userId,
  });
  await avisar(
    supabase,
    [ruta.comercialId],
    {
      tipo: "consulta_asignada",
      titulo: `Consulta de tu territorio: ${c.cliente?.nombre_comercial ?? "contacto"}. Primer contacto dentro de la hora.`,
      url: `/clientes/${c.cliente_id}?interes=${c.id}`,
    },
    userId
  );
  revalidatePath("/", "layout");
  return { ok: true as const, responsable: ruta.responsableNombre };
}

/** La administrativa (o quien ve todo) carga dónde se entrega y el CRM asigna. */
export async function asignarConsulta(oportunidadId: string, zona: string) {
  const supabase = await createClient();
  const user = await usuarioActual();
  const c = await cargarConsulta(supabase, oportunidadId);
  if (!c) return { error: "No se encontró la consulta" };
  return aplicarAsignacion(supabase, c, zona, c.comercial_id ? "Reasignada por lugar de entrega" : "Consulta asignada", user?.id ?? null);
}

/** "No es de mi territorio": la consulta pasa al otro territorio (con la zona correcta). */
export async function noEsDeMiTerritorio(oportunidadId: string, zonaCorrecta: string) {
  const supabase = await createClient();
  const user = await usuarioActual();
  const c = await cargarConsulta(supabase, oportunidadId);
  if (!c) return { error: "No se encontró la consulta" };
  const ruta = await rutearConsulta(supabase, { zona: zonaCorrecta, creadorId: null });
  if (ruta.comercialId && ruta.comercialId === c.comercial_id)
    return { error: "Esa zona es de tu territorio: la consulta es tuya" };
  return aplicarAsignacion(supabase, c, zonaCorrecta, "No era de su territorio", user?.id ?? null);
}

/** Calificación: rubro va en el contacto; acá lugar de entrega, cantidad, plazo y quién decide. */
export async function guardarCalificacion(
  oportunidadId: string,
  datos: { cantidad?: number | null; plazo?: string | null; decisor?: string | null }
) {
  const supabase = await createClient();
  const user = await usuarioActual();
  const c = await cargarConsulta(supabase, oportunidadId);
  if (!c) return { error: "No se encontró la consulta" };
  const update = {
    cantidad: datos.cantidad && datos.cantidad > 0 ? Math.round(datos.cantidad) : null,
    plazo_compra: datos.plazo?.trim() || null,
    decisor: datos.decisor?.trim() || null,
  };
  const { error } = await supabase.from("oportunidades").update(update).eq("id", oportunidadId);
  if (error) return { error: error.message };
  const partes = [
    update.cantidad ? `cantidad ${update.cantidad}` : null,
    update.plazo_compra ? `compra ${update.plazo_compra}` : null,
    update.decisor ? `decide ${update.decisor}` : null,
  ].filter(Boolean);
  if (partes.length)
    await supabase.from("actividades").insert({
      cliente_id: c.cliente_id,
      oportunidad_id: oportunidadId,
      tipo: "interes",
      contenido: `Calificación: ${partes.join(" · ")}`,
      created_by: user?.id ?? null,
    });
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** Deja el próximo contacto sugerido por la cadencia (sin contar como contacto). */
export async function agendarProximo(oportunidadId: string, fecha: string, nota: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: "Fecha inválida" };
  const supabase = await createClient();
  const user = await usuarioActual();
  const c = await cargarConsulta(supabase, oportunidadId);
  if (!c) return { error: "No se encontró el interés" };
  const { error } = await supabase
    .from("oportunidades")
    .update({ proximo_contacto: fecha, proximo_nota: nota.slice(0, 80) })
    .eq("id", oportunidadId);
  if (error) return { error: error.message };
  await supabase.from("actividades").insert({
    cliente_id: c.cliente_id,
    oportunidad_id: oportunidadId,
    tipo: "interes",
    contenido: `Próximo contacto: ${fecha.split("-").reverse().join("/")} · ${nota}`,
    created_by: user?.id ?? null,
  });
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/**
 * "No respondió": queda el intento y el CRM propone el siguiente según el
 * manual (dos reintentos en 48 h; al tercero, en espera 14 días).
 */
export async function noRespondio(oportunidadId: string) {
  const supabase = await createClient();
  const user = await usuarioActual();
  const c = await cargarConsulta(supabase, oportunidadId);
  if (!c) return { error: "No se encontró el interés" };
  const { count } = await supabase
    .from("actividades")
    .select("id", { count: "exact", head: true })
    .eq("oportunidad_id", oportunidadId)
    .like("contenido", "Intento sin respuesta%");
  const previos = count ?? 0;
  const s = sugerenciaSinRespuesta(previos);
  const fecha = sumarDias(s.dias, hoyISO());
  await supabase.from("actividades").insert({
    cliente_id: c.cliente_id,
    oportunidad_id: oportunidadId,
    tipo: "nota",
    contenido: `Intento sin respuesta (${previos + 1}°). ${s.nota} el ${fecha.split("-").reverse().join("/")}`,
    medio: "llamada",
    resultado: "no_respondio",
    created_by: user?.id ?? null,
  });
  const { error } = await supabase
    .from("oportunidades")
    .update({ proximo_contacto: fecha, proximo_nota: s.nota.slice(0, 80), proxima_accion: "llamar" })
    .eq("id", oportunidadId);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true as const, fecha, nota: s.nota };
}
