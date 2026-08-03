"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hoyISO, sumarDias, sumarMeses, normalizarTelefono } from "@/lib/format";
import { CADENCIA_COTIZACION } from "@/lib/constants";
import type { Cliente, Etapa } from "@/lib/types";

async function usuarioActual() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// ---------- Alta rápida ----------

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
    .maybeSingle();
  return data as Cliente | null;
}

export async function crearLead(input: {
  clienteId?: string;
  telefono: string;
  nombre_comercial: string;
  rubro: string;
  ciudad?: string;
  producto_id: string;
  origen: string;
  temperatura: string;
  mensaje_inicial?: string;
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
          ciudad: input.ciudad?.trim() || null,
          telefono: normalizarTelefono(input.telefono),
          vendedor_id: user?.id ?? null,
        })
        .select("id")
        .single();
      if (error || !nuevo) return { error: error?.message ?? "No se pudo crear el cliente" };
      clienteId = nuevo.id;
    }
  }

  const { data: opp, error: errOpp } = await supabase
    .from("oportunidades")
    .insert({
      cliente_id: clienteId,
      producto_id: input.producto_id || null,
      vendedor_id: user?.id ?? null,
      origen: input.origen,
      temperatura: input.temperatura || null,
      mensaje_inicial: input.mensaje_inicial?.trim() || null,
    })
    .select("id")
    .single();
  if (errOpp || !opp) return { error: errOpp?.message ?? "No se pudo crear la oportunidad" };

  await supabase.from("tareas").insert({
    cliente_id: clienteId,
    oportunidad_id: opp.id,
    vendedor_id: user?.id ?? null,
    tipo: "seguimiento",
    titulo: "Hacer diagnóstico: uso, volumen y equipo actual",
    vence_el: hoyISO(),
    auto: true,
  });

  await supabase.from("actividades").insert({
    cliente_id: clienteId,
    oportunidad_id: opp.id,
    tipo: "nota",
    contenido: `Lead creado (${input.origen})${input.mensaje_inicial ? `: ${input.mensaje_inicial}` : ""}`,
    created_by: user?.id ?? null,
  });

  revalidatePath("/", "layout");
  redirect(`/oportunidades/${opp.id}`);
}

// ---------- Tareas ----------

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

  // Recompra de consumible: actualizar el ciclo
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

  // Regla de oro: ¿la oportunidad quedó sin próxima acción?
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

export async function posponerTarea(tareaId: string, dias: number) {
  const supabase = await createClient();
  await supabase
    .from("tareas")
    .update({ vence_el: sumarDias(dias) })
    .eq("id", tareaId);
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
    vendedor_id: user?.id ?? null,
    tipo: input.tipo ?? "seguimiento",
    titulo: input.titulo,
    vence_el: sumarDias(input.dias),
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------- Oportunidades ----------

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
  await supabase.from("oportunidades").update(update).eq("id", oportunidadId);

  // Al avanzar a negociación o cerrar, cancelar la cadencia automática pendiente
  if (["negociacion", "ganada", "perdida"].includes(etapa)) {
    await supabase
      .from("tareas")
      .update({ cancelada: true })
      .eq("oportunidad_id", oportunidadId)
      .eq("auto", true)
      .is("completada_at", null);
  }

  // Cotizada: generar cadencia D+2 / D+5 / D+10 / D+20
  // (si se re-cotiza, la cadencia anterior pendiente se cancela y arranca de nuevo)
  if (etapa === "cotizada") {
    await supabase
      .from("tareas")
      .update({ cancelada: true })
      .eq("oportunidad_id", oportunidadId)
      .eq("auto", true)
      .is("completada_at", null);
    const { data: plantillas } = await supabase
      .from("plantillas")
      .select("id, uso")
      .in("uso", ["d2", "d5", "d10", "d20"]);
    await supabase.from("tareas").insert(
      CADENCIA_COTIZACION.map((c) => ({
        cliente_id: opp.cliente_id,
        oportunidad_id: oportunidadId,
        vendedor_id: opp.vendedor_id,
        tipo: "seguimiento",
        titulo: c.titulo,
        plantilla_id: plantillas?.find((p) => p.uso === c.uso)?.id ?? null,
        vence_el: sumarDias(c.dias),
        auto: true,
      }))
    );
  }

  if (etapa === "negociacion") {
    await supabase.from("tareas").insert({
      cliente_id: opp.cliente_id,
      oportunidad_id: oportunidadId,
      vendedor_id: opp.vendedor_id,
      tipo: "seguimiento",
      titulo: "Definir condición comercial y fecha de cierre",
      vence_el: sumarDias(2),
      auto: true,
    });
  }

  if (etapa === "ganada") {
    await supabase
      .from("clientes")
      .update({ estado: "cliente_activo" })
      .eq("id", opp.cliente_id);

    if (opp.producto_id) {
      const { data: prodVendido } = await supabase
        .from("productos")
        .select("garantia_meses")
        .eq("id", opp.producto_id)
        .single();
      await supabase.from("equipos_instalados").insert({
        cliente_id: opp.cliente_id,
        producto_id: opp.producto_id,
        origen: "vendido",
        garantia_hasta: prodVendido?.garantia_meses
          ? sumarMeses(prodVendido.garantia_meses)
          : null,
        cantidad: 1,
        fecha_compra: hoyISO(),
        oportunidad_id: oportunidadId,
      });
      // Si el producto tiene consumible asociado, activar la recurrencia
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

    await supabase.from("tareas").insert([
      {
        cliente_id: opp.cliente_id,
        oportunidad_id: oportunidadId,
        vendedor_id: opp.vendedor_id,
        tipo: "postventa",
        titulo: "Check-in de entrega e instalación",
        vence_el: sumarDias(7),
        auto: true,
      },
      {
        cliente_id: opp.cliente_id,
        oportunidad_id: oportunidadId,
        vendedor_id: opp.vendedor_id,
        tipo: "postventa",
        titulo: "Check-in de uso y satisfacción",
        vence_el: sumarDias(30),
        auto: true,
      },
    ]);
  }

  if (etapa === "perdida" && motivo === "No era el momento") {
    await supabase.from("tareas").insert({
      cliente_id: opp.cliente_id,
      oportunidad_id: oportunidadId,
      vendedor_id: opp.vendedor_id,
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
  if (opp.etapa === "nueva") update.etapa = "diagnostico";
  await supabase.from("oportunidades").update(update).eq("id", oportunidadId);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function registrarCotizacion(input: {
  oportunidadId: string;
  monto: number | null;
  moneda: string;
  forma_pago?: string;
  archivo_url?: string | null;
  notas?: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("cotizaciones").insert({
    oportunidad_id: input.oportunidadId,
    monto: input.monto,
    moneda: input.moneda,
    forma_pago: input.forma_pago || null,
    archivo_url: input.archivo_url ?? null,
    notas: input.notas?.trim() || null,
  });
  if (error) return { error: error.message };

  await supabase
    .from("oportunidades")
    .update({ monto_estimado: input.monto, moneda: input.moneda })
    .eq("id", input.oportunidadId);

  // Cotizar dispara la cadencia de seguimiento
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

// ---------- Cliente ----------

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

// ---------- Equipos instalados y recurrencias ----------

export async function agregarEquipo(input: {
  clienteId: string;
  productoId?: string | null;
  marcaModelo?: string | null;
  numeroSerie?: string | null;
  garantiaHasta?: string | null;
  fecha?: string | null;
  cantidad?: number;
}) {
  const supabase = await createClient();
  const user = await usuarioActual();

  const fecha = input.fecha || hoyISO();

  // Equipo ajeno (no está en nuestro catálogo)
  if (!input.productoId) {
    if (!input.marcaModelo?.trim())
      return { error: "Indicá la marca y modelo del equipo" };
    await supabase.from("equipos_instalados").insert({
      cliente_id: input.clienteId,
      producto_id: null,
      marca_modelo: input.marcaModelo.trim(),
      numero_serie: input.numeroSerie?.trim() || null,
      origen: "externo",
      garantia_hasta: input.garantiaHasta || null,
      cantidad: input.cantidad ?? 1,
      fecha_compra: input.fecha || null,
    });
    await supabase
      .from("clientes")
      .update({ estado: "cliente_activo" })
      .eq("id", input.clienteId)
      .eq("estado", "prospecto");
    await supabase.from("actividades").insert({
      cliente_id: input.clienteId,
      tipo: "nota",
      contenido: `Se cargó equipo externo: ${input.marcaModelo.trim()}${input.numeroSerie ? ` (serie ${input.numeroSerie.trim()})` : ""}`,
      created_by: user?.id ?? null,
    });
    revalidatePath("/", "layout");
    return { ok: true };
  }

  const { data: producto } = await supabase
    .from("productos")
    .select("*")
    .eq("id", input.productoId)
    .single();
  if (!producto) return { error: "Producto no encontrado" };

  if (producto.es_consumible) {
    // Consumible directo (ej. pastillas): activar o renovar el ciclo de recompra
    if (!producto.frecuencia_recompra_dias)
      return { error: "El consumible no tiene frecuencia configurada" };
    const { data: existente } = await supabase
      .from("recurrencias")
      .select("id")
      .eq("cliente_id", input.clienteId)
      .eq("producto_id", producto.id)
      .eq("activa", true)
      .maybeSingle();
    if (existente) {
      await supabase
        .from("recurrencias")
        .update({
          ultima_compra: fecha,
          proxima_alerta: sumarDias(producto.frecuencia_recompra_dias, fecha),
        })
        .eq("id", existente.id);
    } else {
      await supabase.from("recurrencias").insert({
        cliente_id: input.clienteId,
        producto_id: producto.id,
        frecuencia_dias: producto.frecuencia_recompra_dias,
        ultima_compra: fecha,
        proxima_alerta: sumarDias(producto.frecuencia_recompra_dias, fecha),
      });
    }
  } else {
    await supabase.from("equipos_instalados").insert({
      cliente_id: input.clienteId,
      producto_id: producto.id,
      numero_serie: input.numeroSerie?.trim() || null,
      origen: "vendido",
      garantia_hasta:
        input.garantiaHasta ||
        (producto.garantia_meses
          ? sumarMeses(producto.garantia_meses, fecha)
          : null),
      cantidad: input.cantidad ?? 1,
      fecha_compra: fecha,
    });
    // Si el equipo tiene consumible asociado, activar la recurrencia
    const { data: consumible } = await supabase
      .from("productos")
      .select("id, frecuencia_recompra_dias")
      .eq("consumible_de", producto.id)
      .maybeSingle();
    if (consumible?.frecuencia_recompra_dias) {
      const { data: yaActiva } = await supabase
        .from("recurrencias")
        .select("id")
        .eq("cliente_id", input.clienteId)
        .eq("producto_id", consumible.id)
        .eq("activa", true)
        .maybeSingle();
      if (!yaActiva) {
        await supabase.from("recurrencias").insert({
          cliente_id: input.clienteId,
          producto_id: consumible.id,
          frecuencia_dias: consumible.frecuencia_recompra_dias,
          ultima_compra: fecha,
          proxima_alerta: sumarDias(consumible.frecuencia_recompra_dias, fecha),
        });
      }
    }
    // Cliente con equipo instalado = cliente activo
    await supabase
      .from("clientes")
      .update({ estado: "cliente_activo" })
      .eq("id", input.clienteId)
      .eq("estado", "prospecto");
  }

  await supabase.from("actividades").insert({
    cliente_id: input.clienteId,
    tipo: "nota",
    contenido: `Se cargó ${producto.nombre} (${producto.es_consumible ? "ciclo de recompra" : "equipo instalado"})`,
    created_by: user?.id ?? null,
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------- Servicio técnico: órdenes de trabajo ----------

export async function listarEquiposCliente(clienteId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("equipos_instalados")
    .select("id, numero_serie, marca_modelo, producto:productos(nombre)")
    .eq("cliente_id", clienteId)
    .order("fecha_compra", { ascending: false });
  return (data ?? []).map((e) => {
    const prod = e.producto as unknown as { nombre: string } | null;
    return {
      id: e.id as string,
      etiqueta: `${prod?.nombre ?? e.marca_modelo ?? "Equipo"}${e.numero_serie ? ` · serie ${e.numero_serie}` : ""}`,
    };
  });
}

export async function crearOT(input: {
  clienteId: string;
  equipoId?: string | null;
  tipo: string;
  fechaProgramada?: string | null;
  tecnicoId?: string | null;
  problema?: string;
}) {
  const supabase = await createClient();
  const user = await usuarioActual();
  const esGarantia = input.tipo === "garantia";
  const { data: ot, error } = await supabase
    .from("ordenes_trabajo")
    .insert({
      cliente_id: input.clienteId,
      equipo_id: input.equipoId || null,
      tecnico_id: input.tecnicoId || user?.id || null,
      creado_por: user?.id ?? null,
      tipo: input.tipo,
      es_garantia: esGarantia,
      fecha_programada: input.fechaProgramada || null,
      problema: input.problema?.trim() || null,
    })
    .select("id, numero")
    .single();
  if (error || !ot) return { error: error?.message ?? "No se pudo crear" };

  await supabase.from("actividades").insert({
    cliente_id: input.clienteId,
    tipo: "nota",
    contenido: `Se abrió la orden de trabajo OT-${ot.numero}`,
    created_by: user?.id ?? null,
  });
  revalidatePath("/", "layout");
  redirect(`/servicio/${ot.id}`);
}

const CAMPOS_OT_EDITABLES = [
  "trabajo_realizado",
  "horas",
  "problema",
  "fecha_programada",
  "tecnico_id",
  "tipo",
  "es_garantia",
] as const;

export async function actualizarOT(
  otId: string,
  patch: Record<string, string | number | boolean | null>
) {
  const supabase = await createClient();
  const limpio: Record<string, unknown> = {};
  for (const k of CAMPOS_OT_EDITABLES) {
    if (k in patch) limpio[k] = patch[k];
  }
  if ("tipo" in limpio) limpio.es_garantia = limpio.tipo === "garantia";
  const { error } = await supabase
    .from("ordenes_trabajo")
    .update(limpio)
    .eq("id", otId);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function cambiarEstadoOT(
  otId: string,
  estado: string,
  nroFactura?: string
) {
  const supabase = await createClient();
  const { data: ot } = await supabase
    .from("ordenes_trabajo")
    .select("*")
    .eq("id", otId)
    .single();
  if (!ot) return { error: "Orden no encontrada" };

  const update: Record<string, unknown> = { estado };

  if (estado === "cerrada_tecnico") {
    if (!ot.trabajo_realizado?.trim())
      return { error: "Cargá el trabajo realizado antes de cerrar" };
    if (!ot.horas || ot.horas <= 0)
      return { error: "Cargá las horas trabajadas antes de cerrar" };
    update.cerrada_at = new Date().toISOString();
  }

  if (estado === "facturable") {
    const [{ data: items }, { data: cfg }] = await Promise.all([
      supabase.from("ot_items").select("*").eq("ot_id", otId),
      supabase.from("config").select("valor").eq("clave", "tarifa_hora").single(),
    ]);
    const tarifa = Number(cfg?.valor) || 0;
    const manoObra = ot.es_garantia ? 0 : (Number(ot.horas) || 0) * tarifa;
    const itemsTotal = (items ?? [])
      .filter((i) => i.refacturable)
      .reduce((s, i) => s + Number(i.cantidad) * Number(i.precio_unit), 0);
    update.total = Math.round((manoObra + itemsTotal) * 100) / 100;
  }

  if (estado === "facturada") {
    if (!nroFactura?.trim())
      return { error: "Cargá el número de factura de ZEUS" };
    update.nro_factura = nroFactura.trim();
    update.facturada_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("ordenes_trabajo")
    .update(update)
    .eq("id", otId);
  if (error) return { error: error.message };

  await supabase.from("actividades").insert({
    cliente_id: ot.cliente_id,
    tipo: "nota",
    contenido: `OT-${ot.numero}: ${estado.replace("_", " ")}${nroFactura ? ` (factura ${nroFactura})` : ""}`,
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function agregarItemOT(input: {
  otId: string;
  tipo: "refaccion" | "gasto";
  descripcion: string;
  productoId?: string | null;
  cantidad: number;
  precioUnit: number;
  refacturable: boolean;
  comprobanteUrl?: string | null;
}) {
  if (!input.descripcion.trim()) return { error: "Falta la descripción" };
  const supabase = await createClient();
  const { error } = await supabase.from("ot_items").insert({
    ot_id: input.otId,
    tipo: input.tipo,
    descripcion: input.descripcion.trim(),
    producto_id: input.productoId || null,
    cantidad: input.cantidad || 1,
    precio_unit: input.precioUnit || 0,
    refacturable: input.refacturable,
    comprobante_url: input.comprobanteUrl ?? null,
  });
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

export async function agregarFotoOT(otId: string, url: string) {
  const supabase = await createClient();
  await supabase.from("ot_fotos").insert({ ot_id: otId, url });
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
  const { data } = supabase.storage.from("servicio").getPublicUrl(path);
  await supabase
    .from("ordenes_trabajo")
    .update({ firma_url: data.publicUrl, firmante: firmante.trim() || null })
    .eq("id", otId);
  revalidatePath("/", "layout");
  return { ok: true };
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

// ---------- Buscador global ----------

export async function buscarClientes(q: string): Promise<Cliente[]> {
  const t = q.trim();
  if (t.length < 2) return [];
  const supabase = await createClient();
  const digitos = t.replace(/\D/g, "");
  const filtros = [`nombre_comercial.ilike.%${t}%`];
  if (digitos.length >= 4) filtros.push(`telefono.ilike.%${digitos}%`);

  const [porNombre, porSerie] = await Promise.all([
    supabase.from("clientes").select("*").or(filtros.join(",")).limit(10),
    supabase
      .from("equipos_instalados")
      .select("cliente:clientes(*)")
      .ilike("numero_serie", `%${t}%`)
      .limit(5),
  ]);

  const resultado = new Map<string, Cliente>();
  for (const c of (porNombre.data ?? []) as Cliente[]) resultado.set(c.id, c);
  for (const e of (porSerie.data ?? []) as unknown as { cliente: Cliente | null }[]) {
    if (e.cliente) resultado.set(e.cliente.id, e.cliente);
  }
  return Array.from(resultado.values()).slice(0, 10);
}

// ---------- Notificaciones push ----------

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
  if (error)
    return {
      error:
        "No se pudo guardar (¿falta correr supabase/migrations/002_push.sql?): " +
        error.message,
    };
  return { ok: true };
}

export async function borrarSuscripcionPush(endpoint: string) {
  const supabase = await createClient();
  await supabase.from("push_subs").delete().eq("endpoint", endpoint);
  return { ok: true };
}

// ---------- Biblioteca ----------

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

// ---------- Sesión ----------

export async function cerrarSesion() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
