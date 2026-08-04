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
  producto_id: string;
  origen: string;
  temperatura: string;
  mensaje_inicial?: string;
  soloPrecio?: boolean;
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

  const { data: opp, error: errOpp } = await supabase
    .from("oportunidades")
    .insert({
      cliente_id: clienteId,
      producto_id: input.producto_id || null,
      comercial_id: user?.id ?? null,
      origen: input.origen,
      temperatura: input.temperatura || null,
      mensaje_inicial: input.mensaje_inicial?.trim() || null,
    })
    .select("id")
    .single();
  if (errOpp || !opp)
    return { error: errOpp?.message ?? "No se pudo crear la oportunidad" };

  await supabase.from("tareas").insert({
    cliente_id: clienteId,
    oportunidad_id: opp.id,
    usuario_id: user?.id ?? null,
    tipo: "seguimiento",
    titulo: input.soloPrecio
      ? "Responder precio CON el guión (ancla valor y repregunta)"
      : "Hacer diagnóstico: uso, volumen y equipo actual",
    vence_el: hoyISO(),
    auto: true,
  });

  await supabase.from("actividades").insert({
    cliente_id: clienteId,
    oportunidad_id: opp.id,
    tipo: "nota",
    contenido: `Lead creado (${input.origen})${input.soloPrecio ? " — pidió precio directo" : ""}${input.mensaje_inicial ? `: ${input.mensaje_inicial}` : ""}`,
    created_by: user?.id ?? null,
  });

  revalidatePath("/", "layout");
  redirect(`/oportunidades/${opp.id}${input.soloPrecio ? "?pidio=precio" : ""}`);
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
  const { error: errUpd } = await supabase
    .from("oportunidades")
    .update(update)
    .eq("id", oportunidadId);
  if (errUpd) return { error: errUpd.message };

  if (["negociacion", "ganada", "perdida"].includes(etapa)) {
    await supabase
      .from("tareas")
      .update({ cancelada: true })
      .eq("oportunidad_id", oportunidadId)
      .eq("auto", true)
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

  if (etapa === "negociacion") {
    await supabase.from("tareas").insert({
      cliente_id: opp.cliente_id,
      oportunidad_id: oportunidadId,
      usuario_id: opp.comercial_id,
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

    await supabase.from("tareas").insert([
      {
        cliente_id: opp.cliente_id,
        oportunidad_id: oportunidadId,
        usuario_id: opp.comercial_id,
        tipo: "postventa",
        titulo: "Check-in de entrega e instalación",
        vence_el: sumarDias(7),
        auto: true,
      },
      {
        cliente_id: opp.cliente_id,
        oportunidad_id: oportunidadId,
        usuario_id: opp.comercial_id,
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
  if (opp.etapa === "nueva") update.etapa = "diagnostico";
  await supabase.from("oportunidades").update(update).eq("id", oportunidadId);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Registra una cotización nueva (o una nueva versión de la última). */
export async function registrarCotizacion(input: {
  oportunidadId: string;
  monto: number | null;
  moneda: string;
  forma_pago?: string;
  archivoPath?: string | null;
  notas?: string;
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

  const { error: errV } = await supabase.from("cotizacion_versiones").insert({
    cotizacion_id: cotizacionId,
    version,
    total: input.monto,
    moneda: input.moneda,
    forma_pago: input.forma_pago || null,
    archivo_path: input.archivoPath ?? null,
    condiciones: input.notas?.trim() || null,
    creado_por: user?.id ?? null,
  });
  if (errV) return { error: errV.message };

  await supabase
    .from("oportunidades")
    .update({ monto_estimado: input.monto, moneda: input.moneda })
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
  respuestas: Record<string, boolean>
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
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
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
