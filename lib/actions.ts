"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { consultarIA } from "@/lib/core/ia";
import { enviarEmail } from "@/lib/core/email";
import { hoyISO, sumarDias, sumarMeses, normalizarTelefono, diasDesde, fechaCorta } from "@/lib/format";
import { CADENCIA_COTIZACION, PEDIDO_ESTADOS } from "@/lib/constants";
import type { Cliente, Etapa, PedidoEstado } from "@/lib/types";

async function usuarioActual() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

async function rolActual(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("fn_rol");
  return (data as string) ?? "comercial";
}

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
  rubro: string;
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
          rubro: input.rubro,
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

  const TITULO_PRIMERA_TAREA: Record<string, string> = {
    precio: "Responder precio CON el guión (ancla valor y repregunta)",
    info: "Mandar la ficha del producto y hacer 2 preguntas para calificar",
    general: "Hacer diagnóstico: uso, volumen y equipo actual",
  };
  await supabase.from("tareas").insert({
    cliente_id: clienteId,
    oportunidad_id: opp.id,
    usuario_id: user?.id ?? null,
    tipo: "seguimiento",
    titulo: TITULO_PRIMERA_TAREA[pedido],
    vence_el: hoyISO(),
    auto: true,
  });

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
  redirect(`/oportunidades/${opp.id}${pedido === "precio" ? "?pidio=precio" : ""}`);
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

export async function crearTarea(input: {
  clienteId: string;
  oportunidadId?: string | null;
  titulo: string;
  dias: number;
  tipo?: string;
}) {
  const supabase = await createClient();
  const user = await usuarioActual();
  await supabase.from("tareas").insert({
    cliente_id: input.clienteId,
    oportunidad_id: input.oportunidadId ?? null,
    usuario_id: user?.id ?? null,
    tipo: input.tipo ?? "seguimiento",
    titulo: input.titulo,
    vence_el: sumarDias(input.dias),
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

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

  const update: Record<string, unknown> = { etapa };
  if (etapa === "ganada" || etapa === "perdida")
    update.closed_at = new Date().toISOString();
  if (etapa === "perdida") update.motivo_perdida = motivo;
  // El circuito de pedido arranca al ganar; si se reabre o se pierde, se apaga
  update.pedido_estado = etapa === "ganada" ? "facturar" : null;
  const { error: errUpd } = await supabase
    .from("oportunidades")
    .update(update)
    .eq("id", oportunidadId);
  if (errUpd) return { error: errUpd.message };

  if (["ganada", "perdida"].includes(etapa)) {
    // Venta cerrada: no queda ninguna tarea colgada (ni las cargadas a mano)
    await supabase
      .from("tareas")
      .update({ cancelada: true })
      .eq("oportunidad_id", oportunidadId)
      .is("completada_at", null);
  }

  if (etapa === "cotizada") {
    const { data: plantillas } = await supabase
      .from("plantillas")
      .select("id, uso")
      .in("uso", ["d2", "d5", "d10", "d20"]);
    await supabase.from("tareas").insert(
      CADENCIA_COTIZACION.map((c) => ({
        cliente_id: opp.cliente_id,
        oportunidad_id: oportunidadId,
        usuario_id: opp.comercial_id,
        tipo: "seguimiento",
        titulo: c.titulo,
        plantilla_id: plantillas?.find((p) => p.uso === c.uso)?.id ?? null,
        vence_el: sumarDias(c.dias),
        auto: true,
      }))
    );
  }

  if (etapa === "ganada") {
    await supabase
      .from("clientes")
      .update({ estado: "cliente_activo" })
      .eq("id", opp.cliente_id);

    if (opp.producto_id) {
      const { data: prod } = await supabase
        .from("productos")
        .select("garantia_meses, modelo_id")
        .eq("id", opp.producto_id)
        .single();
      await supabase.from("equipos").insert({
        cliente_id: opp.cliente_id,
        producto_id: opp.producto_id,
        modelo_id: prod?.modelo_id ?? null,
        origen: "vendido",
        fecha_venta: hoyISO(),
        garantia_hasta: prod?.garantia_meses
          ? sumarMeses(prod.garantia_meses)
          : null,
        comercial_id: opp.comercial_id,
        oportunidad_id: oportunidadId,
      });
      const { data: consumible } = await supabase
        .from("productos")
        .select("id, frecuencia_recompra_dias")
        .eq("consumible_de", opp.producto_id)
        .maybeSingle();
      if (consumible?.frecuencia_recompra_dias) {
        await supabase.from("recurrencias").insert({
          cliente_id: opp.cliente_id,
          producto_id: consumible.id,
          frecuencia_dias: consumible.frecuencia_recompra_dias,
          proxima_alerta: sumarDias(consumible.frecuencia_recompra_dias),
        });
      }
    }

    // El circuito del pedido guía la post-venta; la primera parada es facturar
    await supabase.from("tareas").insert({
      cliente_id: opp.cliente_id,
      oportunidad_id: oportunidadId,
      usuario_id: opp.comercial_id,
      tipo: "postventa",
      titulo: "Emitir factura y coordinar el cobro",
      vence_el: hoyISO(),
      auto: true,
    });
  }

  if (etapa === "perdida" && motivo === "No era el momento") {
    await supabase.from("tareas").insert({
      cliente_id: opp.cliente_id,
      oportunidad_id: oportunidadId,
      usuario_id: opp.comercial_id,
      tipo: "reactivacion",
      titulo: "Reactivar: quedó para más adelante — enviar novedad o promo",
      vence_el: sumarDias(45),
      auto: true,
    });
  }

  await supabase.from("actividades").insert({
    cliente_id: opp.cliente_id,
    oportunidad_id: oportunidadId,
    tipo: "cambio_etapa",
    contenido: `Etapa → ${etapa}${motivo ? ` (${motivo})` : ""}`,
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

/**
 * Avanza el pedido de una venta ganada por su circuito:
 * facturar → pendiente de pago → preparando envío → para entregar →
 * entregado → finalizado. Al marcar entregado se agenda sola la tarea
 * de seguimiento a los 7 días.
 */
export async function avanzarPedido(
  oportunidadId: string,
  estado: PedidoEstado
) {
  const supabase = await createClient();
  const user = await usuarioActual();
  const { data: opp } = await supabase
    .from("oportunidades")
    .select("cliente_id, comercial_id, etapa, pedido_estado, entregado_at")
    .eq("id", oportunidadId)
    .single();
  if (!opp) return { error: "Oportunidad no encontrada" };
  if (opp.etapa !== "ganada")
    return { error: "El pedido se sigue una vez ganada la venta" };

  const update: Record<string, unknown> = { pedido_estado: estado };
  if (estado === "entregado" && !opp.entregado_at)
    update.entregado_at = new Date().toISOString();
  const { error } = await supabase
    .from("oportunidades")
    .update(update)
    .eq("id", oportunidadId);
  if (error) return { error: error.message };

  if (estado === "entregado" && !opp.entregado_at) {
    await supabase.from("tareas").insert({
      cliente_id: opp.cliente_id,
      oportunidad_id: oportunidadId,
      usuario_id: opp.comercial_id,
      tipo: "postventa",
      titulo: "Seguimiento post-entrega: ¿cómo va todo con el equipo?",
      vence_el: sumarDias(7),
      auto: true,
    });
  }

  const label =
    PEDIDO_ESTADOS.find((p) => p.value === estado)?.label ?? estado;
  await supabase.from("actividades").insert({
    cliente_id: opp.cliente_id,
    oportunidad_id: oportunidadId,
    tipo: "pedido",
    contenido: `Pedido → ${label}`,
    created_by: user?.id ?? null,
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Cierra el paso "Emitir factura" del pedido: guarda el número de factura
 * en la venta y, si la venta incluye un equipo, su número de serie (queda
 * anexado al equipo del cliente). Después pasa el pedido a pendiente de pago.
 */
export async function facturarPedido(
  oportunidadId: string,
  nroFactura: string,
  numeroSerie?: string
) {
  if (!nroFactura.trim()) return { error: "Falta el número de factura" };
  const supabase = await createClient();
  const user = await usuarioActual();
  const { data: opp } = await supabase
    .from("oportunidades")
    .select("cliente_id, etapa")
    .eq("id", oportunidadId)
    .single();
  if (!opp) return { error: "Oportunidad no encontrada" };
  if (opp.etapa !== "ganada")
    return { error: "El pedido se factura una vez ganada la venta" };

  const serie = numeroSerie?.trim();
  if (serie) {
    const { data: equipo } = await supabase
      .from("equipos")
      .select("id, numero_serie")
      .eq("oportunidad_id", oportunidadId)
      .maybeSingle();
    if (equipo && !equipo.numero_serie) {
      const { error: errSerie } = await supabase
        .from("equipos")
        .update({ numero_serie: serie })
        .eq("id", equipo.id);
      if (errSerie)
        return {
          error:
            errSerie.code === "23505"
              ? `El número de serie ${serie} ya está cargado en otro equipo`
              : errSerie.message,
        };
    }
  }

  const { error } = await supabase
    .from("oportunidades")
    .update({ nro_factura: nroFactura.trim(), pedido_estado: "pendiente_pago" })
    .eq("id", oportunidadId);
  if (error) return { error: error.message };

  await supabase.from("actividades").insert({
    cliente_id: opp.cliente_id,
    oportunidad_id: oportunidadId,
    tipo: "pedido",
    contenido: `Facturada (${nroFactura.trim()})${serie ? ` — serie ${serie} anexada al equipo` : ""} → Pendiente de pago`,
    created_by: user?.id ?? null,
  });

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
    .select("id, versiones:cotizacion_versiones(version)")
    .eq("oportunidad_id", input.oportunidadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let cotizacionId = existente?.id as string | undefined;
  let version = 1;
  if (cotizacionId) {
    const versiones = (existente?.versiones ?? []) as { version: number }[];
    version = Math.max(0, ...versiones.map((v) => v.version)) + 1;
  } else {
    const { data: nueva, error } = await supabase
      .from("cotizaciones")
      .insert({ oportunidad_id: input.oportunidadId })
      .select("id")
      .single();
    if (error || !nueva) return { error: error?.message ?? "No se pudo crear" };
    cotizacionId = nueva.id;
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

  await supabase
    .from("oportunidades")
    .update({ monto_estimado: total, moneda: input.moneda })
    .eq("id", input.oportunidadId);

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

export async function setTemperatura(oportunidadId: string, temperatura: string) {
  const supabase = await createClient();
  await supabase
    .from("oportunidades")
    .update({ temperatura: temperatura || null })
    .eq("id", oportunidadId);
  revalidatePath("/", "layout");
  return { ok: true };
}

// =====================================================================
// Equipos
// =====================================================================

export async function agregarEquipo(input: {
  clienteId: string;
  productoId?: string | null;
  marcaModelo?: string | null;
  numeroSerie?: string | null;
  sucursalId?: string | null;
  garantiaHasta?: string | null;
  fecha?: string | null;
}) {
  const supabase = await createClient();
  const user = await usuarioActual();
  const fecha = input.fecha || null;
  const serie = input.numeroSerie?.trim() || null;

  // Consumible directo: renueva o crea el ciclo de recompra
  if (input.productoId) {
    const { data: producto } = await supabase
      .from("productos")
      .select("*")
      .eq("id", input.productoId)
      .single();
    if (!producto) return { error: "Producto no encontrado" };

    if (producto.es_consumible) {
      if (!producto.frecuencia_recompra_dias)
        return { error: "El consumible no tiene frecuencia configurada" };
      const base = fecha || hoyISO();
      const { data: activa } = await supabase
        .from("recurrencias")
        .select("id")
        .eq("cliente_id", input.clienteId)
        .eq("producto_id", producto.id)
        .eq("activa", true)
        .maybeSingle();
      if (activa) {
        await supabase
          .from("recurrencias")
          .update({
            ultima_compra: base,
            proxima_alerta: sumarDias(producto.frecuencia_recompra_dias, base),
          })
          .eq("id", activa.id);
      } else {
        await supabase.from("recurrencias").insert({
          cliente_id: input.clienteId,
          producto_id: producto.id,
          frecuencia_dias: producto.frecuencia_recompra_dias,
          ultima_compra: base,
          proxima_alerta: sumarDias(producto.frecuencia_recompra_dias, base),
        });
      }
      revalidatePath("/", "layout");
      return { ok: true };
    }

    const { error } = await supabase.from("equipos").insert({
      cliente_id: input.clienteId,
      producto_id: producto.id,
      modelo_id: producto.modelo_id,
      numero_serie: serie,
      sucursal_id: input.sucursalId || null,
      origen: "vendido",
      fecha_venta: fecha,
      garantia_hasta:
        input.garantiaHasta ||
        (producto.garantia_meses && fecha
          ? sumarMeses(producto.garantia_meses, fecha)
          : null),
      comercial_id: user?.id ?? null,
    });
    if (error) {
      if (error.code === "23505")
        return { error: `El número de serie ${serie} ya existe en otro equipo` };
      return { error: error.message };
    }
  } else {
    if (!input.marcaModelo?.trim())
      return { error: "Indicá la marca y modelo del equipo" };
    const { error } = await supabase.from("equipos").insert({
      cliente_id: input.clienteId,
      marca_modelo_libre: input.marcaModelo.trim(),
      numero_serie: serie,
      sucursal_id: input.sucursalId || null,
      origen: "externo",
      fecha_venta: fecha,
      garantia_hasta: input.garantiaHasta || null,
    });
    if (error) {
      if (error.code === "23505")
        return { error: `El número de serie ${serie} ya existe en otro equipo` };
      return { error: error.message };
    }
  }

  await supabase
    .from("clientes")
    .update({ estado: "cliente_activo" })
    .eq("id", input.clienteId)
    .eq("estado", "prospecto");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function listarEquiposCliente(clienteId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("equipos")
    .select("id, numero_serie, marca_modelo_libre, producto:productos(nombre)")
    .eq("cliente_id", clienteId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  return (data ?? []).map((e) => {
    const prod = e.producto as unknown as { nombre: string } | null;
    return {
      id: e.id as string,
      etiqueta: `${prod?.nombre ?? e.marca_modelo_libre ?? "Equipo"}${e.numero_serie ? ` · serie ${e.numero_serie}` : ""}`,
    };
  });
}

const CAMPOS_EQUIPO_EDITABLES = [
  "numero_serie",
  "estado",
  "sucursal_id",
  "fecha_instalacion",
  "fecha_venta",
  "proximo_service",
  "observaciones",
] as const;

export async function actualizarEquipo(
  equipoId: string,
  patch: Record<string, string | null>
) {
  const limpio: Record<string, string | null> = {};
  for (const k of CAMPOS_EQUIPO_EDITABLES) if (k in patch) limpio[k] = patch[k] || null;
  const supabase = await createClient();
  const { error } = await supabase
    .from("equipos")
    .update(limpio)
    .eq("id", equipoId);
  if (error) {
    if (error.code === "23505")
      return { error: `Ese número de serie ya existe en otro equipo` };
    return { error: error.message };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function agregarFotoEquipo(equipoId: string, path: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("equipo_fotos")
    .insert({ equipo_id: equipoId, path });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function borrarFotoEquipo(fotoId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("equipo_fotos").delete().eq("id", fotoId);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

// =====================================================================
// Servicio técnico
// =====================================================================

export async function crearOT(input: {
  clienteId: string;
  equipoId?: string | null;
  sucursalId?: string | null;
  tipo: string;
  prioridad?: string;
  tipoProblema?: string;
  fechaProgramada?: string | null;
  tecnicoId?: string | null;
  problema?: string;
}) {
  const supabase = await createClient();
  const user = await usuarioActual();
  const cobertura = input.tipo === "garantia" ? "garantia" : "facturable";
  const estadoInicial = input.tecnicoId
    ? "asignado"
    : input.fechaProgramada
      ? "programado"
      : "solicitud_recibida";

  const { data: ot, error } = await supabase
    .from("ordenes_trabajo")
    .insert({
      cliente_id: input.clienteId,
      equipo_id: input.equipoId || null,
      sucursal_id: input.sucursalId || null,
      tecnico_id: input.tecnicoId || null,
      creado_por: user?.id ?? null,
      estado: estadoInicial,
      tipo: input.tipo,
      prioridad: input.prioridad || "normal",
      tipo_problema: input.tipoProblema?.trim() || null,
      cobertura,
      fecha_solicitada: hoyISO(),
      fecha_programada: input.fechaProgramada || null,
      problema: input.problema?.trim() || null,
    })
    .select("id, numero")
    .single();
  if (error || !ot) return { error: error?.message ?? "No se pudo crear" };

  // Checklists del modelo del equipo (o generales) → se copian a la OT
  if (input.equipoId) {
    const { data: eq } = await supabase
      .from("equipos")
      .select("modelo_id, producto:productos(modelo_id)")
      .eq("id", input.equipoId)
      .single();
    const modeloId =
      eq?.modelo_id ??
      (eq?.producto as unknown as { modelo_id: string | null } | null)?.modelo_id ??
      null;
    if (modeloId) {
      const { data: plantillasCk } = await supabase
        .from("checklist_plantillas")
        .select("id")
        .eq("modelo_id", modeloId);
      for (const p of plantillasCk ?? []) {
        await supabase
          .from("ot_checklists")
          .insert({ ot_id: ot.id, plantilla_id: p.id, respuestas: {} });
      }
    }
  }

  await supabase.from("actividades").insert({
    cliente_id: input.clienteId,
    tipo: "nota",
    contenido: `Se abrió la orden de trabajo OT-${ot.numero}`,
    created_by: user?.id ?? null,
  });

  if (input.tecnicoId && input.tecnicoId !== user?.id) {
    await supabase.from("notificaciones").insert({
      usuario_id: input.tecnicoId,
      tipo: "ot_asignada",
      titulo: `Te asignaron la OT-${ot.numero}`,
      url: `/servicio/${ot.id}`,
    });
  }

  revalidatePath("/", "layout");
  redirect(`/servicio/${ot.id}`);
}

const CAMPOS_OT_EDITABLES = [
  "diagnostico",
  "trabajo_realizado",
  "problema",
  "tipo_problema",
  "prioridad",
  "cobertura",
  "fecha_programada",
  "tecnico_id",
  "sucursal_id",
  "equipo_id",
  "tipo",
] as const;

export async function actualizarOT(
  otId: string,
  patch: Record<string, string | number | boolean | null>
) {
  const supabase = await createClient();
  const limpio: Record<string, unknown> = {};
  for (const k of CAMPOS_OT_EDITABLES) if (k in patch) limpio[k] = patch[k];
  const { error } = await supabase
    .from("ordenes_trabajo")
    .update(limpio)
    .eq("id", otId);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Transición de estado. La validación (transiciones permitidas, rol,
 * requisitos de cierre) la hace el trigger de la base — acá solo se
 * ejecutan los efectos colaterales de cada destino.
 */
export async function transicionarOT(
  otId: string,
  hacia: string,
  extra?: { observacion?: string; nroFactura?: string }
) {
  const supabase = await createClient();
  const { data: ot } = await supabase
    .from("ordenes_trabajo")
    .select("*")
    .eq("id", otId)
    .single();
  if (!ot) return { error: "Orden no encontrada" };

  const update: Record<string, unknown> = { estado: hacia };

  if (hacia === "devuelto_tecnico") {
    if (!extra?.observacion?.trim())
      return { error: "Indicá qué falta o qué hay que corregir" };
    update.observacion_admin = extra.observacion.trim();
  }

  if (hacia === "aprobado_facturar") {
    const [{ data: tiempos }, { data: items }, { data: cfg }] =
      await Promise.all([
        supabase.from("ot_tiempos").select("minutos").eq("ot_id", otId),
        supabase
          .from("ot_items")
          .select("cantidad, precio_unit, estado, aprobado_admin")
          .eq("ot_id", otId),
        supabase.from("config").select("valor").eq("clave", "tarifa_hora").single(),
      ]);
    const tarifa = Number(cfg?.valor) || 0;
    const minutos = (tiempos ?? []).reduce((s, t) => s + (t.minutos ?? 0), 0);
    const manoObra =
      ot.cobertura === "garantia" ? 0 : (minutos / 60) * tarifa;
    const itemsTotal = (items ?? [])
      .filter((i) => i.estado === "facturable" && i.aprobado_admin)
      .reduce((s, i) => s + Number(i.cantidad) * Number(i.precio_unit), 0);
    update.total = Math.round((manoObra + itemsTotal) * 100) / 100;
    const user = await usuarioActual();
    update.admin_id = user?.id ?? null;
  }

  if (hacia === "facturado") {
    if (!extra?.nroFactura?.trim())
      return { error: "Cargá el número de factura de ZEUS" };
    update.nro_factura = extra.nroFactura.trim();
    update.facturada_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("ordenes_trabajo")
    .update(update)
    .eq("id", otId);
  if (error) return { error: error.message };

  // Instalación terminada: estampar la fecha de instalación en el equipo
  if (
    hacia === "finalizado_tecnico" &&
    ot.tipo === "instalacion" &&
    ot.equipo_id
  ) {
    await supabase
      .from("equipos")
      .update({ fecha_instalacion: hoyISO() })
      .eq("id", ot.equipo_id)
      .is("fecha_instalacion", null);
  }

  // Registrar observación en el historial de estado si la hubo
  if (extra?.observacion?.trim()) {
    const { data: ultimo } = await supabase
      .from("status_history")
      .select("id")
      .eq("ot_id", otId)
      .eq("hacia", hacia)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (ultimo) {
      await supabase
        .from("status_history")
        .update({ observacion: extra.observacion.trim() })
        .eq("id", ultimo.id);
    }
  }

  // Notificaciones
  if (hacia === "devuelto_tecnico" && ot.tecnico_id) {
    await supabase.from("notificaciones").insert({
      usuario_id: ot.tecnico_id,
      tipo: "ot_devuelta",
      titulo: `OT-${ot.numero} devuelta: ${extra?.observacion?.slice(0, 80) ?? ""}`,
      url: `/servicio/${otId}`,
    });
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Cierre técnico: pasa a finalizado_tecnico y de inmediato a revisión admin. */
export async function finalizarOTTecnico(otId: string) {
  const r1 = await transicionarOT(otId, "finalizado_tecnico");
  if (r1 && "error" in r1 && r1.error) return r1;
  return transicionarOT(otId, "revision_admin");
}

// ---- Tiempos ----

export async function iniciarTiempo(otId: string) {
  const supabase = await createClient();
  const user = await usuarioActual();
  const { data: abierto } = await supabase
    .from("ot_tiempos")
    .select("id")
    .eq("ot_id", otId)
    .is("fin", null)
    .eq("manual", false)
    .maybeSingle();
  if (abierto) return { error: "Ya hay un cronómetro corriendo" };
  const { error } = await supabase.from("ot_tiempos").insert({
    ot_id: otId,
    tecnico_id: user?.id ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function detenerTiempo(otId: string) {
  const supabase = await createClient();
  const { data: abierto } = await supabase
    .from("ot_tiempos")
    .select("id, inicio")
    .eq("ot_id", otId)
    .is("fin", null)
    .eq("manual", false)
    .maybeSingle();
  if (!abierto) return { error: "No hay cronómetro corriendo" };
  const fin = new Date();
  const minutos = Math.max(
    1,
    Math.round((fin.getTime() - new Date(abierto.inicio).getTime()) / 60000)
  );
  await supabase
    .from("ot_tiempos")
    .update({ fin: fin.toISOString(), minutos })
    .eq("id", abierto.id);
  revalidatePath("/", "layout");
  return { ok: true, minutos };
}

export async function cargarTiempoManual(
  otId: string,
  minutos: number,
  justificacion: string
) {
  if (!minutos || minutos <= 0) return { error: "Minutos inválidos" };
  if (!justificacion.trim())
    return { error: "La carga manual requiere justificación" };
  const supabase = await createClient();
  const user = await usuarioActual();
  const ahora = new Date().toISOString();
  const { error } = await supabase.from("ot_tiempos").insert({
    ot_id: otId,
    tecnico_id: user?.id ?? null,
    inicio: ahora,
    fin: ahora,
    minutos: Math.round(minutos),
    manual: true,
    justificacion: justificacion.trim(),
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---- Ítems, fotos y firma ----

export async function agregarItemOT(input: {
  otId: string;
  tipo: "refaccion" | "gasto";
  descripcion: string;
  repuestoId?: string | null;
  cantidad: number;
  precioUnit: number;
  estado?: string;
  comprobantePath?: string | null;
}) {
  if (!input.descripcion.trim()) return { error: "Falta la descripción" };
  const supabase = await createClient();
  const { error } = await supabase.from("ot_items").insert({
    ot_id: input.otId,
    tipo: input.tipo,
    repuesto_id: input.repuestoId || null,
    descripcion: input.descripcion.trim(),
    cantidad: input.cantidad || 1,
    precio_unit: input.precioUnit || 0,
    estado: input.estado || "pendiente",
    comprobante_path: input.comprobantePath ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function revisarItemOT(
  itemId: string,
  patch: { estado?: string; precioUnit?: number; aprobado?: boolean }
) {
  const supabase = await createClient();
  const update: Record<string, unknown> = {};
  if (patch.estado) update.estado = patch.estado;
  if (patch.precioUnit != null) update.precio_unit = patch.precioUnit;
  if (patch.aprobado != null) update.aprobado_admin = patch.aprobado;
  const { error } = await supabase
    .from("ot_items")
    .update(update)
    .eq("id", itemId);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function borrarItemOT(itemId: string) {
  const supabase = await createClient();
  await supabase.from("ot_items").delete().eq("id", itemId);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function agregarFotoOT(
  otId: string,
  path: string,
  momento: "antes" | "despues" | "otro" = "otro"
) {
  const supabase = await createClient();
  await supabase.from("ot_fotos").insert({ ot_id: otId, path, momento });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function guardarFirmaOT(
  otId: string,
  dataUrl: string,
  firmante: string
) {
  const supabase = await createClient();
  const base64 = dataUrl.split(",")[1];
  if (!base64) return { error: "Firma vacía" };
  const buffer = Buffer.from(base64, "base64");
  const path = `firmas/${otId}-${Date.now()}.png`;
  const { error: errUp } = await supabase.storage
    .from("servicio")
    .upload(path, buffer, { contentType: "image/png" });
  if (errUp) return { error: "No se pudo guardar la firma: " + errUp.message };
  await supabase
    .from("ordenes_trabajo")
    .update({ firma_path: path, firmante: firmante.trim() || null })
    .eq("id", otId);
  revalidatePath("/", "layout");
  return { ok: true };
}

// =====================================================================
// Importación de clientes (Excel/CSV)
// =====================================================================

export type FilaImport = {
  nombre_comercial: string;
  razon_social?: string;
  cuit?: string;
  condicion_fiscal?: string;
  rubro?: string;
  telefono?: string;
  email?: string;
  ciudad?: string;
  provincia?: string;
  direccion?: string;
  notas?: string;
};

const soloDigitos = (s: string | undefined | null) => {
  let d = (s ?? "").replace(/\D/g, "");
  if (d.startsWith("549")) d = d.slice(3);
  else if (d.startsWith("54") && d.length > 10) d = d.slice(2);
  return d;
};

/**
 * Importa un lote de clientes (máx 200 por llamada; el cliente manda de a
 * tandas). Dedup contra la base y dentro del archivo por teléfono y CUIT.
 */
export async function importarClientes(
  filas: FilaImport[],
  opciones: { estado: "cliente_activo" | "prospecto" }
) {
  const rol = await rolActual();
  if (!["direccion", "admin"].includes(rol))
    return { error: "Solo dirección o administración pueden importar" };
  if (filas.length > 200) return { error: "Máximo 200 filas por tanda" };

  const supabase = await createClient();

  // Mapa de existentes para dedup (teléfonos y CUITs)
  const { data: existentes } = await supabase
    .from("clientes")
    .select("telefono, cuit")
    .is("deleted_at", null)
    .limit(10000);
  const telefonos = new Set(
    (existentes ?? []).map((c) => soloDigitos(c.telefono)).filter((d) => d.length >= 8)
  );
  const cuits = new Set(
    (existentes ?? []).map((c) => (c.cuit ?? "").replace(/\D/g, "")).filter(Boolean)
  );

  let creados = 0;
  let salteados = 0;
  const errores: string[] = [];

  for (const fila of filas) {
    const nombre = (fila.nombre_comercial ?? "").trim();
    if (!nombre) {
      salteados++;
      continue;
    }
    const tel = soloDigitos(fila.telefono);
    const cuit = (fila.cuit ?? "").replace(/\D/g, "");
    if ((tel.length >= 8 && telefonos.has(tel)) || (cuit && cuits.has(cuit))) {
      salteados++;
      continue;
    }

    const condicion = (fila.condicion_fiscal ?? "")
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z_]/g, "");
    const condicionValida = [
      "responsable_inscripto",
      "monotributo",
      "exento",
      "consumidor_final",
    ].includes(condicion)
      ? condicion
      : null;

    const { data: nuevo, error } = await supabase
      .from("clientes")
      .insert({
        nombre_comercial: nombre.slice(0, 120),
        razon_social: fila.razon_social?.trim() || null,
        cuit: cuit ? cuit.slice(0, 11) : null,
        condicion_fiscal: condicionValida,
        rubro: fila.rubro?.trim() || "Otro",
        telefono: fila.telefono?.trim() || null,
        email: fila.email?.trim() || null,
        estado: opciones.estado,
        notas: fila.notas?.trim() || null,
      })
      .select("id")
      .single();

    if (error || !nuevo) {
      errores.push(`${nombre}: ${error?.message ?? "error"}`);
      if (errores.length >= 10) break;
      continue;
    }
    if (tel.length >= 8) telefonos.add(tel);
    if (cuit) cuits.add(cuit);
    creados++;

    if (fila.ciudad?.trim() || fila.direccion?.trim() || fila.provincia?.trim()) {
      await supabase.from("sucursales").insert({
        cliente_id: nuevo.id,
        nombre: "Principal",
        direccion: fila.direccion?.trim() || null,
        ciudad: fila.ciudad?.trim() || null,
        provincia: fila.provincia?.trim() || null,
        es_principal: true,
      });
    }
  }

  revalidatePath("/", "layout");
  return { ok: true, creados, salteados, errores };
}

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

async function evaluarSegmento(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filtros: FiltrosSegmento
): Promise<ClienteSegmento[]> {
  let q = supabase
    .from("clientes")
    .select("id, nombre_comercial, telefono, email, sucursales(ciudad)")
    .is("deleted_at", null)
    .eq("no_contactar", false)
    .limit(20000);
  if (filtros.estados?.length) q = q.in("estado", filtros.estados);
  if (filtros.rubros?.length) q = q.in("rubro", filtros.rubros);

  const { data } = await q;
  type Fila = ClienteSegmento & { sucursales?: { ciudad: string | null }[] };
  let lista = (data ?? []) as Fila[];

  if (filtros.ciudad?.trim()) {
    const c = filtros.ciudad.trim().toLowerCase();
    lista = lista.filter((f) =>
      (f.sucursales ?? []).some((s) => (s.ciudad ?? "").toLowerCase().includes(c))
    );
  }

  if (filtros.marca?.trim()) {
    const m = filtros.marca.trim().toLowerCase();
    const { data: eqs } = await supabase
      .from("equipos")
      .select("cliente_id, marca_modelo_libre, producto:productos(marca, nombre), modelo:modelos(marca)")
      .is("deleted_at", null)
      .limit(10000);
    const con = new Set(
      (eqs ?? [])
        .filter((e) => {
          const marcas = [
            (e.producto as unknown as { marca: string | null } | null)?.marca,
            (e.producto as unknown as { nombre: string | null } | null)?.nombre,
            (e.modelo as unknown as { marca: string | null } | null)?.marca,
            e.marca_modelo_libre,
          ];
          return marcas.some((x) => (x ?? "").toLowerCase().includes(m));
        })
        .map((e) => e.cliente_id as string)
    );
    lista = lista.filter((f) => con.has(f.id));
  }

  if (filtros.garantiaDias) {
    const { data: eqs } = await supabase
      .from("equipos")
      .select("cliente_id, garantia_hasta")
      .is("deleted_at", null)
      .gte("garantia_hasta", hoyISO())
      .lte("garantia_hasta", sumarDias(filtros.garantiaDias))
      .limit(10000);
    const con = new Set((eqs ?? []).map((e) => e.cliente_id as string));
    lista = lista.filter((f) => con.has(f.id));
  }

  if (filtros.conRecurrencia) {
    const { data: recs } = await supabase
      .from("recurrencias")
      .select("cliente_id")
      .eq("activa", true)
      .limit(10000);
    const con = new Set((recs ?? []).map((r) => r.cliente_id as string));
    lista = lista.filter((f) => con.has(f.id));
  }

  if (filtros.dormidoMeses) {
    const corte = sumarDias(-30 * filtros.dormidoMeses);
    const { data: acts } = await supabase
      .from("actividades")
      .select("cliente_id")
      .gte("created_at", corte)
      .limit(20000);
    const activos = new Set((acts ?? []).map((a) => a.cliente_id as string));
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
  const secreto = process.env.CRON_SECRET ?? "";
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

// =====================================================================
// IA (borradores con vista previa; ver reglas en lib/core/ia.ts)
// =====================================================================

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

export async function iaInformeOT(otId: string) {
  const supabase = await createClient();
  const user = await usuarioActual();

  const [{ data: ot }, { data: items }, { data: tiempos }] = await Promise.all([
    supabase
      .from("ordenes_trabajo")
      .select(
        "numero, tipo, cobertura, problema, diagnostico, trabajo_realizado, equipo:equipos(numero_serie, marca_modelo_libre, producto:productos(nombre))"
      )
      .eq("id", otId)
      .single(),
    supabase.from("ot_items").select("descripcion, cantidad, estado").eq("ot_id", otId),
    supabase.from("ot_tiempos").select("minutos, justificacion").eq("ot_id", otId),
  ]);
  if (!ot) return { error: "Orden no encontrada" };
  if (!ot.diagnostico && !ot.trabajo_realizado && !ot.problema)
    return { error: "La orden todavía no tiene notas del técnico para redactar." };

  const contexto = JSON.stringify({
    orden: ot,
    repuestos_usados: items,
    tiempos,
  });

  const res = await consultarIA<{
    diagnostico: string;
    trabajo_realizado: string;
  }>({
    supabase,
    usuarioId: user?.id ?? null,
    funcion: "informe_ot",
    instrucciones: `Convertí las notas crudas del técnico en un informe profesional para el comprobante que ve el cliente: "diagnostico" (qué se encontró, 1-3 oraciones claras) y "trabajo_realizado" (qué se hizo, en orden, mencionando repuestos usados). Nada técnico-críptico: que el dueño del negocio lo entienda. No inventes trabajos ni repuestos que no estén en las notas.`,
    contexto,
    esquema: {
      type: "object",
      properties: {
        diagnostico: { type: "string" },
        trabajo_realizado: { type: "string" },
      },
      required: ["diagnostico", "trabajo_realizado"],
      additionalProperties: false,
    },
  });
  return res.ok ? { ok: true, ...res.datos } : { error: res.error };
}

// =====================================================================
// Checklists
// =====================================================================

export async function guardarChecklistPlantilla(input: {
  id?: string | null;
  nombre: string;
  modeloId: string | null;
  items: string[];
}) {
  const supabase = await createClient();
  const fila = {
    nombre: input.nombre.trim(),
    modelo_id: input.modeloId,
    items: input.items.map((i) => i.trim()).filter(Boolean),
  };
  if (!fila.nombre) return { error: "Falta el nombre" };
  if (fila.items.length === 0) return { error: "Cargá al menos un ítem" };
  const { error } = input.id
    ? await supabase.from("checklist_plantillas").update(fila).eq("id", input.id)
    : await supabase.from("checklist_plantillas").insert(fila);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function borrarChecklistPlantilla(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("checklist_plantillas")
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function responderChecklistOT(
  checklistId: string,
  respuestas: Record<string, import("./checklist").RespuestaChecklist>
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ot_checklists")
    .update({ respuestas })
    .eq("id", checklistId);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

// =====================================================================
// Buscador global
// =====================================================================

export async function buscarClientes(q: string): Promise<Cliente[]> {
  const t = q.trim();
  if (t.length < 2) return [];
  const supabase = await createClient();
  const digitos = t.replace(/\D/g, "");
  const filtros = [`nombre_comercial.ilike.%${t}%`, `razon_social.ilike.%${t}%`];
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
// Notificaciones internas
// =====================================================================

export async function marcarNotificacionLeida(id: string) {
  const supabase = await createClient();
  await supabase
    .from("notificaciones")
    .update({ leida_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function marcarTodasLeidas() {
  const supabase = await createClient();
  const user = await usuarioActual();
  if (!user) return { error: "Sin sesión" };
  await supabase
    .from("notificaciones")
    .update({ leida_at: new Date().toISOString() })
    .eq("usuario_id", user.id)
    .is("leida_at", null);
  revalidatePath("/", "layout");
  return { ok: true };
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

// =====================================================================
// Push
// =====================================================================

export async function guardarSuscripcionPush(sub: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}) {
  const supabase = await createClient();
  const user = await usuarioActual();
  if (!user) return { error: "Sin sesión" };
  const { error } = await supabase.from("push_subs").upsert(
    { usuario_id: user.id, endpoint: sub.endpoint, subscription: sub },
    { onConflict: "endpoint" }
  );
  if (error) return { error: error.message };
  return { ok: true };
}

export async function borrarSuscripcionPush(endpoint: string) {
  const supabase = await createClient();
  await supabase.from("push_subs").delete().eq("endpoint", endpoint);
  return { ok: true };
}

// =====================================================================
// Administración
// =====================================================================

/**
 * Crea una subida firmada al bucket público biblioteca. El navegador después
 * sube el archivo con el token (uploadToSignedUrl), sin depender de que la
 * sesión del navegador llegue al storage — evita falsos "row-level security".
 */
export async function crearSubidaBiblioteca(
  nombreArchivo: string,
  carpeta?: string
) {
  const rol = await rolActual();
  if (!["direccion", "admin", "marketing"].includes(rol))
    return { error: "Sin permiso para subir archivos" };
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/\s+/g, "");
  if (!serviceKey)
    return { error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor" };

  const { createClient: createAdmin } = await import("@supabase/supabase-js");
  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const limpio = nombreArchivo.replace(/[^\w.\-]/g, "_");
  const path = `${carpeta ? `${carpeta}/` : ""}${Date.now()}-${limpio}`;
  const { data, error } = await admin.storage
    .from("biblioteca")
    .createSignedUploadUrl(path);
  if (error || !data) return { error: error?.message ?? "No se pudo firmar" };
  return { ok: true as const, path: data.path, token: data.token };
}

export async function setConfigValor(clave: string, valor: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("config")
    .upsert({ clave, valor }, { onConflict: "clave" });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function crearMaterial(input: {
  nombre: string;
  tipo: string;
  producto_id?: string | null;
  url: string;
}) {
  if (!input.nombre.trim() || !input.url.trim())
    return { error: "Nombre y link son obligatorios" };
  const supabase = await createClient();
  const { error } = await supabase.from("materiales").insert({
    nombre: input.nombre.trim(),
    tipo: input.tipo,
    producto_id: input.producto_id || null,
    url: input.url.trim(),
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function borrarMaterial(id: string) {
  const supabase = await createClient();
  await supabase.from("materiales").delete().eq("id", id);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Alta de usuario (requiere SUPABASE_SERVICE_ROLE_KEY configurada). */
export async function crearUsuario(input: {
  email: string;
  nombre: string;
  rol: string;
  passwordInicial: string;
}) {
  const rol = await rolActual();
  if (!["direccion", "admin"].includes(rol))
    return { error: "Solo dirección o administración pueden crear usuarios" };
  if (rol === "admin" && ["direccion", "admin"].includes(input.rol))
    return { error: "Solo dirección puede crear usuarios de dirección o administración" };
  // Las claves nunca llevan espacios: si el copy/paste en Vercel metió un
  // salto de línea o espacio, lo limpiamos en vez de fallar con un header inválido
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/\s+/g, "");
  if (!serviceKey)
    return {
      error:
        "Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno (Vercel → Settings → Environment Variables)",
    };

  const { createClient: createAdmin } = await import("@supabase/supabase-js");
  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data, error } = await admin.auth.admin.createUser({
    email: input.email.trim(),
    password: input.passwordInicial,
    email_confirm: true,
    user_metadata: { nombre: input.nombre.trim() },
  });
  if (error || !data.user) return { error: error?.message ?? "No se pudo crear" };

  await admin
    .from("usuarios")
    .upsert({ id: data.user.id, nombre: input.nombre.trim(), rol: input.rol });

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function actualizarUsuario(
  usuarioId: string,
  patch: { nombre?: string; rol?: string; activo?: boolean }
) {
  const rol = await rolActual();
  if (!["direccion", "admin"].includes(rol))
    return { error: "Sin permiso" };
  if (patch.rol && rol !== "direccion")
    return { error: "Solo dirección puede cambiar roles" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("usuarios")
    .update(patch)
    .eq("id", usuarioId);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function guardarProducto(
  productoId: string | null,
  patch: {
    nombre?: string;
    precio_referencia?: number | null;
    moneda?: string;
    garantia_meses?: number | null;
    activo?: boolean;
    descripcion?: string | null;
    destacados?: string[];
    imagen_url?: string | null;
  }
) {
  const supabase = await createClient();
  if (productoId) {
    const { error } = await supabase
      .from("productos")
      .update(patch)
      .eq("id", productoId);
    if (error) return { error: error.message };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function crearProducto(input: {
  nombre: string;
  marca?: string;
  categoria: string;
  moneda: string;
  precio_referencia?: number | null;
  garantia_meses?: number | null;
}) {
  const rol = await rolActual();
  if (!["direccion", "admin"].includes(rol)) return { error: "Sin permiso" };
  if (!input.nombre.trim()) return { error: "Falta el nombre" };
  const supabase = await createClient();
  const { error } = await supabase.from("productos").insert({
    nombre: input.nombre.trim(),
    marca: input.marca?.trim() || null,
    categoria: input.categoria || "otro",
    moneda: input.moneda || "ARS",
    precio_referencia: input.precio_referencia ?? null,
    garantia_meses: input.garantia_meses ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function guardarPlantilla(
  plantillaId: string,
  contenido: string
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("plantillas")
    .update({ contenido })
    .eq("id", plantillaId);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function guardarRepuesto(input: {
  id?: string | null;
  codigo_interno?: string;
  descripcion: string;
  marca?: string;
  precio?: number | null;
  costo?: number | null;
  moneda?: string;
}) {
  const supabase = await createClient();
  const fila = {
    codigo_interno: input.codigo_interno?.trim() || null,
    descripcion: input.descripcion.trim(),
    marca: input.marca?.trim() || null,
    precio: input.precio ?? null,
    costo: input.costo ?? null,
    moneda: input.moneda || "ARS",
  };
  const { error } = input.id
    ? await supabase.from("repuestos").update(fila).eq("id", input.id)
    : await supabase.from("repuestos").insert(fila);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

// =====================================================================
// Sesión
// =====================================================================

export async function cerrarSesion() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
