"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hoyISO, sumarDias, normalizarTelefono } from "@/lib/format";
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
      await supabase.from("equipos_instalados").insert({
        cliente_id: opp.cliente_id,
        producto_id: opp.producto_id,
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

// ---------- Buscador global ----------

export async function buscarClientes(q: string): Promise<Cliente[]> {
  const t = q.trim();
  if (t.length < 2) return [];
  const supabase = await createClient();
  const digitos = t.replace(/\D/g, "");
  const filtros = [`nombre_comercial.ilike.%${t}%`];
  if (digitos.length >= 4) filtros.push(`telefono.ilike.%${digitos}%`);
  const { data } = await supabase
    .from("clientes")
    .select("*")
    .or(filtros.join(","))
    .limit(10);
  return (data ?? []) as Cliente[];
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
