"use server";

// Servicio técnico: órdenes de trabajo, tiempos, ítems, fotos, firma, checklists y service hecho.

import { revalidatePath } from "next/cache";
import { avisarAlCelular } from "@/lib/servidor/push";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { consultarIA } from "@/lib/core/ia";
import { exigirGestor } from "@/lib/auth";
import { hoyISO, normalizarTelefono, sumarMeses } from "@/lib/format";
import { controlaServicio, factura } from "@/lib/puestos";
import { conceptoFinal, cuentaOT, esCobroComo, motivoCompleto } from "@/lib/servicio-cobro";
import { avisar, puestoActual, usuarioActual, usuariosDePuesto, type SupabaseServidor } from "./comun";
import { buscarClientePorTelefono } from "./contactos";

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
    avisarAlCelular();
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
  "remito_nro",
  "tiempo_min",
  "acta_capacitado",
  "acta_garantia_desde",
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
  extra?: { observacion?: string; nroFactura?: string; vencimiento?: string | null }
) {
  const supabase = await createClient();
  const { data: ot } = await supabase
    .from("ordenes_trabajo")
    .select("*")
    .eq("id", otId)
    .single();
  if (!ot) return { error: "Orden no encontrada" };
  const rol = await puestoActual(supabase);

  // Fuera de garantía: el técnico no sale hasta que el presupuesto esté cobrado
  // (o dirección apruebe la condición). Servicio técnico y dirección pueden forzarlo.
  if (
    rol === "tecnico" &&
    ["en_camino", "en_proceso"].includes(hacia) &&
    ot.presupuesto_monto != null &&
    !ot.cobro_ok_at
  )
    return { error: "Este trabajo espera el cobro del presupuesto: todavía no se sale" };

  const update: Record<string, unknown> = { estado: hacia };

  if (hacia === "devuelto_tecnico") {
    if (!extra?.observacion?.trim())
      return { error: "Indicá qué falta o qué hay que corregir" };
    update.observacion_admin = extra.observacion.trim();
  }

  if (hacia === "aprobado_facturar") {
    update.total = (await cuentaDeOT(supabase, ot)).total;
    const user = await usuarioActual();
    update.admin_id = user?.id ?? null;
  }

  let concepto: string | null = null;
  if (hacia === "facturado") {
    if (!extra?.nroFactura?.trim())
      return { error: "Cargá el número de factura de ZEUS" };
    if (!(Number(ot.total) > 0)) return { error: "La orden no tiene nada para facturar: cerrala sin facturar" };
    const cuenta = await cuentaDeOT(supabase, ot);
    concepto = conceptoFinal(ot, cuenta.horas);
    update.nro_factura = extra.nroFactura.trim();
    update.facturada_at = new Date().toISOString();
    // El concepto queda fijo en la orden: es el que se facturó
    update.concepto_factura = concepto;
    // La factura del remito queda en Cobranzas (a la razón social del local)
    const user = await usuarioActual();
    const { error: errF } = await supabase.from("facturas").insert({
      cliente_id: ot.cliente_id,
      sucursal_id: ot.sucursal_id,
      ot_id: otId,
      tipo: "servicio",
      numero: extra.nroFactura.trim(),
      fecha: hoyISO(),
      vencimiento: extra.vencimiento || hoyISO(),
      monto: ot.total,
      moneda: "ARS",
      concepto,
      created_by: user?.id ?? null,
    });
    if (errF) return { error: `guardar la factura: ${errF.message}` };
  }

  const { error } = await supabase
    .from("ordenes_trabajo")
    .update(update)
    .eq("id", otId);
  if (error) return { error: error.message };

  // Instalación terminada: la garantía del equipo empieza el día del acta
  if (hacia === "finalizado_tecnico" && ot.tipo === "instalacion" && ot.equipo_id) {
    const desde = ot.acta_garantia_desde ?? hoyISO();
    const { data: eq } = await supabase
      .from("equipos")
      .select("fecha_instalacion, producto:productos(garantia_meses)")
      .eq("id", ot.equipo_id)
      .maybeSingle();
    const meses = (eq?.producto as unknown as { garantia_meses: number | null } | null)?.garantia_meses;
    if (eq && !eq.fecha_instalacion)
      await supabase
        .from("equipos")
        .update({ fecha_instalacion: desde, ...(meses ? { garantia_hasta: sumarMeses(meses, desde) } : {}) })
        .eq("id", ot.equipo_id);
  }

  // Trabajo terminado: avisar a quien controla el remito y al responsable del caso
  if (hacia === "finalizado_tecnico") {
    const user = await usuarioActual();
    const control = await usuariosDePuesto(supabase, ["servicio", "admin"]);
    await avisar(supabase, control, { tipo: "remito_para_controlar", titulo: `Remito para controlar: service ${ot.numero}`, url: `/servicio/${otId}` }, user?.id);
    if (ot.caso_id) {
      const { data: caso } = await supabase.from("casos").select("numero, responsable_id").eq("id", ot.caso_id).maybeSingle();
      if (caso)
        await avisar(
          supabase,
          [caso.responsable_id as string | null],
          { tipo: "caso_trabajo_hecho", titulo: `El técnico terminó el caso ${caso.numero}: confirmá con el cliente y cerralo`, url: "/casos" },
          user?.id
        );
    }
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
    avisarAlCelular();
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Cierre técnico: todo trabajo termina con remito (número, foto del remito
 * firmado o firma digital, foto del equipo funcionando); una instalación,
 * además, con el acta (persona capacitada). Pasa a revisión de servicio.
 */
export async function finalizarOTTecnico(otId: string) {
  const supabase = await createClient();
  const { data: ot } = await supabase
    .from("ordenes_trabajo")
    .select("tipo, remito_nro, trabajo_realizado, acta_capacitado, firma_path")
    .eq("id", otId)
    .maybeSingle();
  if (!ot) return { error: "Orden no encontrada" };
  const { data: fotos } = await supabase.from("ot_fotos").select("momento").eq("ot_id", otId);
  const momentos = new Set(((fotos ?? []) as { momento: string }[]).map((f) => f.momento));
  const falta: string[] = [];
  if (!ot.trabajo_realizado?.trim()) falta.push("qué se hizo");
  if (!ot.remito_nro?.trim()) falta.push("número de remito");
  if (!momentos.has("remito") && !ot.firma_path) falta.push("foto del remito firmado");
  if (!momentos.has("despues")) falta.push("foto del equipo funcionando");
  if (ot.tipo === "instalacion" && !ot.acta_capacitado?.trim()) falta.push("acta: a quién se capacitó");
  if (falta.length) return { error: `Para cerrar el trabajo falta: ${falta.join(", ")}` };
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
  // Revisar ítems (aprobar, cambiar precio o estado) es de gestores; la
  // base además bloquea al técnico con fn_protege_ot_items (025).
  const bloqueo = await exigirGestor();
  if (bloqueo) return bloqueo;
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
  momento: "antes" | "despues" | "otro" | "remito" | "acta" = "otro"
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ot_fotos")
    .insert({ ot_id: otId, path, momento });
  if (error) return { error: `registrar foto: ${error.message}` };
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
export async function responderChecklistOT(
  checklistId: string,
  respuestas: Record<string, import("@/lib/checklist").RespuestaChecklist>
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
/**
 * Carga un service YA HECHO en un solo paso (para el técnico que lo terminó
 * y quiere dejarlo asentado, tenga agenda o no). Crea la orden directamente
 * cerrada por el técnico y la deja en revisión para que administración la
 * apruebe y cobre. Sin firma ni cronómetro obligatorios.
 */
export async function cargarServiceHecho(input: {
  clienteId?: string;
  /** Cliente como texto libre (nombre o teléfono) si no se eligió uno. */
  clienteTexto?: string;
  equipoId?: string | null;
  /** Equipo como texto libre (marca/modelo) si no está cargado. */
  equipoTexto?: string;
  tipo: string;
  fecha: string;
  trabajo: string;
  horas?: number | null;
  items?: { descripcion: string; monto: number; tipo?: "refaccion" | "gasto" }[];
  cobertura?: "facturable" | "garantia" | "contrato";
  /** Foto del equipo funcionando (obligatoria). */
  fotoBase64?: string;
  /** Remito en papel: número y foto firmada (obligatorios, manual 4.3). */
  remitoNro?: string;
  remitoFotoBase64?: string;
  /** Instalación: a quién se capacitó (acta). */
  capacitado?: string;
}) {
  const trabajo = input.trabajo.trim();
  if (!trabajo) return { error: "Contá qué se hizo, aunque sea en una línea" };
  const falta: string[] = [];
  if (!input.remitoNro?.trim()) falta.push("el número de remito");
  if (!input.remitoFotoBase64) falta.push("la foto del remito firmado");
  if (!input.fotoBase64) falta.push("la foto del equipo funcionando");
  if (!(input.horas && input.horas > 0)) falta.push("el tiempo");
  if (input.tipo === "instalacion" && !input.capacitado?.trim()) falta.push("a quién capacitaste");
  if (falta.length) return { error: `Todo trabajo termina con remito. Falta ${falta.join(", ")}.` };
  const tipo = ["correctivo", "preventivo", "instalacion", "garantia"].includes(input.tipo)
    ? input.tipo
    : "correctivo";
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(input.fecha) ? input.fecha : hoyISO();

  const supabase = await createClient();
  const user = await usuarioActual();

  // Cliente: elegido, o por texto (teléfono conocido → se engancha; si no, se crea)
  let clienteId = input.clienteId;
  if (!clienteId) {
    const texto = input.clienteTexto?.trim() ?? "";
    if (!texto) return { error: "Poné de quién es el service (nombre o teléfono)" };
    const digitos = normalizarTelefono(texto);
    if (digitos.length >= 8) {
      const existente = await buscarClientePorTelefono(digitos);
      if (existente) clienteId = existente.id;
    }
    if (!clienteId) {
      const { data: nuevo, error: errCli } = await supabase
        .from("clientes")
        .insert({
          nombre_comercial: /^[\d\s+\-().]+$/.test(texto) ? `Cliente ${texto}` : texto,
          telefono: digitos.length >= 8 ? digitos : null,
          rubro: "Otro",
          estado: "cliente_activo",
          comercial_id: user?.id ?? null,
          notas: "Cargado rápido desde un service — completar datos",
        })
        .select("id")
        .single();
      if (errCli || !nuevo)
        return { error: errCli?.message ?? "No se pudo crear el cliente" };
      clienteId = nuevo.id;
    }
  }

  // Equipo: elegido, o por texto (queda cargado como equipo de otra marca)
  let equipoId = input.equipoId || null;
  if (!equipoId && input.equipoTexto?.trim()) {
    const { data: eq } = await supabase
      .from("equipos")
      .insert({
        cliente_id: clienteId,
        marca_modelo_libre: input.equipoTexto.trim(),
        origen: "externo",
      })
      .select("id")
      .single();
    equipoId = eq?.id ?? null;
  }

  const cobertura =
    input.cobertura ?? (tipo === "garantia" ? "garantia" : "facturable");
  const cerrada =
    fecha === hoyISO() ? new Date().toISOString() : `${fecha}T15:00:00.000Z`;

  const { data: ot, error } = await supabase
    .from("ordenes_trabajo")
    .insert({
      cliente_id: clienteId,
      equipo_id: equipoId,
      tecnico_id: user?.id ?? null,
      creado_por: user?.id ?? null,
      estado: "finalizado_tecnico",
      tipo,
      prioridad: "normal",
      cobertura,
      fecha_solicitada: fecha,
      fecha_programada: fecha,
      trabajo_realizado: trabajo,
      cerrada_tecnico_at: cerrada,
      remito_nro: input.remitoNro!.trim(),
      tiempo_min: Math.round((input.horas ?? 0) * 60),
      acta_capacitado: tipo === "instalacion" ? input.capacitado?.trim() || null : null,
      acta_garantia_desde: tipo === "instalacion" ? fecha : null,
    })
    .select("id, numero")
    .single();
  if (error || !ot) return { error: error?.message ?? "No se pudo guardar el service" };

  if (input.horas && input.horas > 0) {
    await supabase.from("ot_tiempos").insert({
      ot_id: ot.id,
      tecnico_id: user?.id ?? null,
      inicio: cerrada,
      fin: cerrada,
      minutos: Math.round(input.horas * 60),
      manual: true,
      justificacion: "Cargado al terminar el service",
    });
  }

  const items = (input.items ?? []).filter((i) => i.descripcion.trim());
  if (items.length) {
    await supabase.from("ot_items").insert(
      items.map((i) => ({
        ot_id: ot.id,
        tipo: i.tipo ?? "refaccion",
        descripcion: i.descripcion.trim(),
        cantidad: 1,
        precio_unit: Number(i.monto) || 0,
        estado: cobertura === "garantia" ? "garantia" : "facturable",
        aprobado_admin: false,
      }))
    );
  }

  // Fotos: equipo funcionando y remito firmado
  const fotos = [
    { b64: input.fotoBase64, momento: "despues", nombre: "equipo" },
    { b64: input.remitoFotoBase64, momento: "remito", nombre: "remito" },
  ].filter((f) => f.b64);
  if (fotos.length) {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/\s+/g, "");
    if (serviceKey) {
      const { createClient: createAdmin } = await import("@supabase/supabase-js");
      const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      for (const f of fotos) {
        const path = `fotos/${ot.id}/${Date.now()}-${f.nombre}.jpg`;
        const { error: errFoto } = await admin.storage
          .from("servicio")
          .upload(path, Buffer.from(f.b64!, "base64"), { contentType: "image/jpeg" });
        if (!errFoto) await supabase.from("ot_fotos").insert({ ot_id: ot.id, momento: f.momento, path });
      }
    }
  }

  // Instalación: la garantía del equipo empieza el día del acta
  if (tipo === "instalacion" && equipoId) {
    const { data: eq } = await supabase
      .from("equipos")
      .select("fecha_instalacion, producto:productos(garantia_meses)")
      .eq("id", equipoId)
      .maybeSingle();
    const meses = (eq?.producto as unknown as { garantia_meses: number | null } | null)?.garantia_meses;
    if (eq && !eq.fecha_instalacion)
      await supabase
        .from("equipos")
        .update({ fecha_instalacion: fecha, ...(meses ? { garantia_hasta: sumarMeses(meses, fecha) } : {}) })
        .eq("id", equipoId);
  }

  // Queda en revisión para que administración apruebe y cobre
  const rev = await transicionarOT(ot.id, "revision_admin");
  if (rev && "error" in rev && rev.error)
    return { error: `pasar a revisión: ${rev.error}` };

  await supabase
    .from("clientes")
    .update({ estado: "cliente_activo" })
    .eq("id", clienteId)
    .eq("estado", "prospecto");

  const TIPO_TEXTO: Record<string, string> = {
    correctivo: "Reparación",
    preventivo: "Mantenimiento",
    instalacion: "Instalación",
    garantia: "Garantía",
  };
  await supabase.from("actividades").insert({
    cliente_id: clienteId,
    tipo: "service",
    contenido: `${TIPO_TEXTO[tipo]} hecha (service ${ot.numero}): ${trabajo.slice(0, 140)}`,
    created_by: user?.id ?? null,
  });

  revalidatePath("/", "layout");
  redirect(`/clientes/${clienteId}`);
}

// =====================================================================
// Servicio técnico por puestos (manual 4.3)
// =====================================================================

/**
 * Asigna el trabajo: técnico propio (Mar del Plata y zona) o técnico aliado
 * (fuera de zona), con fecha. Lo hace dirección de administración o el
 * responsable de servicio técnico.
 */
export async function asignarOT(otId: string, input: { tecnicoId?: string | null; aliadoId?: string | null; fecha?: string | null }) {
  const supabase = await createClient();
  if (!controlaServicio(await puestoActual(supabase))) return { error: "Asigna servicio técnico o dirección de administración" };
  if (!input.tecnicoId && !input.aliadoId) return { error: "Elegí el técnico o el aliado" };
  const user = await usuarioActual();
  const { data: ot } = await supabase.from("ordenes_trabajo").select("id, numero, estado, cliente_id").eq("id", otId).maybeSingle();
  if (!ot) return { error: "Orden no encontrada" };
  const destino = input.tecnicoId ? "asignado" : "programado";
  const campos = {
    tecnico_id: input.tecnicoId || null,
    aliado_id: input.tecnicoId ? null : input.aliadoId || null,
    fecha_programada: input.fecha || null,
  };
  // Camino de estados permitido hasta asignado/programado
  if (ot.estado === "pendiente_revision") {
    const { error } = await supabase.from("ordenes_trabajo").update({ estado: "pendiente_asignacion" }).eq("id", otId);
    if (error) return { error: error.message };
  }
  const puedeMover = ["solicitud_recibida", "pendiente_revision", "pendiente_asignacion", "asignado", "programado"].includes(ot.estado);
  const { error } = await supabase
    .from("ordenes_trabajo")
    .update(puedeMover && ot.estado !== destino ? { ...campos, estado: destino } : campos)
    .eq("id", otId);
  if (error) return { error: error.message };

  let quien = "";
  if (input.aliadoId) {
    const { data: a } = await supabase.from("tecnicos_aliados").select("nombre").eq("id", input.aliadoId).maybeSingle();
    quien = `aliado ${a?.nombre ?? ""}`.trim();
  } else {
    const { data: t } = await supabase.from("usuarios").select("nombre").eq("id", input.tecnicoId!).maybeSingle();
    quien = t?.nombre ?? "técnico";
    await avisar(
      supabase,
      [input.tecnicoId],
      { tipo: "ot_asignada", titulo: `Te asignaron el service ${ot.numero}${input.fecha ? ` para el ${input.fecha.split("-").reverse().join("/")}` : ""}`, url: `/servicio/${otId}` },
      user?.id
    );
  }
  await supabase.from("actividades").insert({
    cliente_id: ot.cliente_id,
    tipo: "service",
    contenido: `Service ${ot.numero} asignado a ${quien}${input.fecha ? ` para el ${input.fecha.split("-").reverse().join("/")}` : ""}`,
    created_by: user?.id ?? null,
  });
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/**
 * Fuera de garantía: presupuesto → aprobación del cliente → factura y
 * cobro ANTES de ir o despachar el repuesto (el cobro lo registra
 * Cobranzas y marca el trabajo como cobrado).
 */
export async function guardarPresupuestoOT(otId: string, input: { monto: number | null; moneda?: string; aprobado?: boolean }) {
  const supabase = await createClient();
  const rol = await puestoActual(supabase);
  if (!controlaServicio(rol) && !["administrativa", "tecnico"].includes(rol)) return { error: "Sin permiso" };
  const user = await usuarioActual();
  const { data: ot } = await supabase.from("ordenes_trabajo").select("numero, cliente_id, presupuesto_aprobado_at").eq("id", otId).maybeSingle();
  if (!ot) return { error: "Orden no encontrada" };
  if (input.monto == null || !(input.monto > 0)) return { error: "Poné el monto del presupuesto" };
  const aprobadoAt = input.aprobado ? ot.presupuesto_aprobado_at ?? new Date().toISOString() : null;
  const { error } = await supabase
    .from("ordenes_trabajo")
    .update({ presupuesto_monto: input.monto, presupuesto_moneda: input.moneda || "ARS", presupuesto_aprobado_at: aprobadoAt })
    .eq("id", otId);
  if (error) return { error: error.message };
  await supabase.from("actividades").insert({
    cliente_id: ot.cliente_id,
    tipo: "service",
    contenido: `Service ${ot.numero}: presupuesto ${input.moneda === "USD" ? "USD " : "$"}${input.monto}${input.aprobado ? " aprobado por el cliente: falta facturar y cobrar antes de ir" : ""}`,
    created_by: user?.id ?? null,
  });
  if (input.aprobado) {
    const administracion = await usuariosDePuesto(supabase, ["administrativa", "admin"]);
    await avisar(
      supabase,
      administracion,
      { tipo: "presupuesto_a_cobrar", titulo: `Presupuesto aprobado del service ${ot.numero}: facturar y cobrar antes de ir`, url: `/servicio/${otId}` },
      user?.id
    );
  }
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** Reclamo a fábrica de un trabajo en garantía: se sigue hasta el cierre. */
export async function guardarReclamoGarantia(otId: string, estado: string, nota?: string) {
  const ESTADOS = ["a_presentar", "presentado", "repuesto_recibido", "cerrado", "rechazado"];
  if (!ESTADOS.includes(estado)) return { error: "Estado inválido" };
  const supabase = await createClient();
  if (!controlaServicio(await puestoActual(supabase))) return { error: "Las garantías las sigue servicio técnico" };
  const user = await usuarioActual();
  const { data: ot } = await supabase.from("ordenes_trabajo").select("numero, cliente_id").eq("id", otId).maybeSingle();
  if (!ot) return { error: "Orden no encontrada" };
  const { error } = await supabase
    .from("ordenes_trabajo")
    .update({ garantia_reclamo: estado, garantia_reclamo_nota: nota?.trim() || null })
    .eq("id", otId);
  if (error) return { error: error.message };
  const TXT: Record<string, string> = {
    a_presentar: "a presentar a fábrica",
    presentado: "presentado a fábrica",
    repuesto_recibido: "repuesto recibido de fábrica",
    cerrado: "cerrado",
    rechazado: "rechazado por fábrica",
  };
  await supabase.from("actividades").insert({
    cliente_id: ot.cliente_id,
    tipo: "service",
    contenido: `Service ${ot.numero}: reclamo de garantía ${TXT[estado]}${nota?.trim() ? ` · ${nota.trim()}` : ""}`,
    created_by: user?.id ?? null,
  });
  revalidatePath("/", "layout");
  return { ok: true as const };
}

// =====================================================================
// Corregir la orden, horas a cobrar y concepto de facturación (v1.27)
// =====================================================================

/** Lo que entra en la cuenta de la orden: horas a cobrar × tarifa + ítems facturables aprobados. */
async function cuentaDeOT(
  supabase: SupabaseServidor,
  ot: { id: string; cobertura: string; horas_cobrar?: number | null; cobro_como?: string | null; sin_cargo?: boolean | null }
) {
  const [{ data: tiempos }, { data: items }, { data: cfg }] = await Promise.all([
    supabase.from("ot_tiempos").select("minutos").eq("ot_id", ot.id),
    supabase.from("ot_items").select("cantidad, precio_unit, estado, aprobado_admin").eq("ot_id", ot.id),
    supabase.from("config").select("valor").eq("clave", "tarifa_hora").maybeSingle(),
  ]);
  const minutos = (tiempos ?? []).reduce((s, t) => s + (t.minutos ?? 0), 0);
  return cuentaOT(ot, minutos, Number(cfg?.valor) || 0, (items ?? []) as { cantidad: number; precio_unit: number; estado: string; aprobado_admin: boolean }[]);
}

const CERRADAS = ["facturado", "cerrado", "cancelado"];

/** Si ya estaba aprobada para facturar, el total se recalcula con lo corregido. */
async function recalcularTotal(supabase: SupabaseServidor, otId: string) {
  const { data: ot } = await supabase.from("ordenes_trabajo").select("id, estado, cobertura, horas_cobrar, cobro_como, sin_cargo").eq("id", otId).maybeSingle();
  if (ot?.estado !== "aprobado_facturar") return;
  const { total } = await cuentaDeOT(supabase, ot as { id: string; cobertura: string; horas_cobrar: number | null; cobro_como: string | null; sin_cargo: boolean });
  await supabase.from("ordenes_trabajo").update({ total }).eq("id", otId);
}

const CAMPOS_CORREGIBLES = ["tipo", "cobertura", "prioridad", "problema", "diagnostico", "trabajo_realizado", "remito_nro", "fecha_programada", "tecnico_id"] as const;
const NOMBRE_CAMPO: Record<string, string> = {
  tipo: "tipo",
  cobertura: "cobertura",
  prioridad: "prioridad",
  problema: "problema",
  diagnostico: "diagnóstico",
  trabajo_realizado: "trabajo realizado",
  remito_nro: "remito",
  fecha_programada: "fecha",
  tecnico_id: "técnico",
};

/**
 * Dirección, dirección de administración y servicio técnico corrigen la
 * orden en cualquier momento antes de facturarla (también lo que cargó el
 * técnico como "service hecho"). Queda anotado en el historial.
 */
export async function corregirOT(otId: string, patch: Partial<Record<(typeof CAMPOS_CORREGIBLES)[number], string | null>>) {
  const supabase = await createClient();
  const rol = await puestoActual(supabase);
  if (!controlaServicio(rol)) return { error: "Las órdenes las corrigen dirección o servicio técnico" };
  const { data: ot } = await supabase.from("ordenes_trabajo").select("*").eq("id", otId).maybeSingle();
  if (!ot) return { error: "Orden no encontrada" };
  if (CERRADAS.includes(ot.estado)) return { error: "La orden ya está facturada o cerrada" };

  const cambios: Record<string, string | null> = {};
  for (const k of CAMPOS_CORREGIBLES) {
    if (!(k in patch)) continue;
    const v = typeof patch[k] === "string" ? patch[k]!.trim() || null : null;
    if ((ot[k] ?? null) !== v) cambios[k] = v;
  }
  if (cambios.tipo && !["correctivo", "preventivo", "instalacion", "garantia"].includes(cambios.tipo)) return { error: "Tipo no válido" };
  if ("tipo" in cambios && !cambios.tipo) delete cambios.tipo;
  if (cambios.cobertura && !["facturable", "garantia", "contrato"].includes(cambios.cobertura)) return { error: "Cobertura no válida" };
  if ("cobertura" in cambios && !cambios.cobertura) delete cambios.cobertura;
  if (cambios.prioridad && !["baja", "normal", "alta", "urgente"].includes(cambios.prioridad)) return { error: "Prioridad no válida" };
  if ("prioridad" in cambios && !cambios.prioridad) delete cambios.prioridad;
  if (cambios.fecha_programada && !/^\d{4}-\d{2}-\d{2}$/.test(cambios.fecha_programada)) return { error: "Fecha no válida" };
  if (!Object.keys(cambios).length) return { ok: true as const, sinCambios: true };

  const { error } = await supabase.from("ordenes_trabajo").update(cambios).eq("id", otId);
  if (error) return { error: error.message };
  await recalcularTotal(supabase, otId);

  const user = await usuarioActual();
  const { data: yo } = await supabase.from("usuarios").select("nombre").eq("id", user?.id ?? "").maybeSingle();
  await supabase.from("actividades").insert({
    cliente_id: ot.cliente_id,
    tipo: "service",
    contenido: `Service ${ot.numero} corregido por ${yo?.nombre ?? "dirección"}: ${Object.keys(cambios).map((k) => NOMBRE_CAMPO[k] ?? k).join(", ")}`,
    created_by: user?.id ?? null,
  });
  if (cambios.tecnico_id && cambios.tecnico_id !== user?.id)
    await avisar(supabase, [cambios.tecnico_id], { tipo: "ot_asignada", titulo: `Te asignaron el service ${ot.numero}`, url: `/servicio/${otId}` }, user?.id);
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/**
 * Las horas que se cobran (también en garantía: ej. la movilidad), cómo se
 * cobran y el concepto de la factura. Lo cargan dirección, servicio técnico
 * y administración antes de facturar.
 */
export async function guardarCobroOT(otId: string, input: { horas: number | null; cobroComo: string | null; concepto: string | null }) {
  const supabase = await createClient();
  const rol = await puestoActual(supabase);
  if (!controlaServicio(rol) && !factura(rol)) return { error: "El cobro lo definen dirección, servicio técnico o administración" };
  const { data: ot } = await supabase.from("ordenes_trabajo").select("estado").eq("id", otId).maybeSingle();
  if (!ot) return { error: "Orden no encontrada" };
  if (CERRADAS.includes(ot.estado)) return { error: "La orden ya está facturada o cerrada" };
  if (input.horas !== null && (!Number.isFinite(input.horas) || input.horas < 0 || input.horas > 200)) return { error: "Las horas tienen que estar entre 0 y 200" };
  if (input.cobroComo && !esCobroComo(input.cobroComo)) return { error: "Elegí cómo se cobra" };
  const { error } = await supabase
    .from("ordenes_trabajo")
    .update({
      horas_cobrar: input.horas === null ? null : Math.round(input.horas * 100) / 100,
      cobro_como: input.cobroComo || null,
      concepto_factura: input.concepto?.trim().slice(0, 200) || null,
    })
    .eq("id", otId);
  if (error) return { error: error.message };
  await recalcularTotal(supabase, otId);
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** La IA propone el concepto de la factura a partir de lo que hizo el técnico ("ST 123 - Cambio de luz por garantía (Movilidad)"). */
export async function iaConceptoOT(otId: string, cobroComo: string | null, horas: number) {
  const supabase = await createClient();
  const user = await usuarioActual();
  const { data: ot } = await supabase
    .from("ordenes_trabajo")
    .select("numero, tipo, cobertura, problema, diagnostico, trabajo_realizado, equipo:equipos(marca_modelo_libre, producto:productos(nombre))")
    .eq("id", otId)
    .maybeSingle();
  if (!ot) return { error: "Orden no encontrada" };
  if (!ot.trabajo_realizado && !ot.diagnostico && !ot.problema) return { error: "La orden todavía no dice qué se hizo" };
  const { data: items } = await supabase.from("ot_items").select("descripcion, estado").eq("ot_id", otId);
  const cobro = horas > 0 && esCobroComo(cobroComo) ? cobroComo : null;
  const res = await consultarIA<{ que: string }>({
    supabase,
    usuarioId: user?.id ?? null,
    funcion: "concepto_ot",
    maxTokens: 300,
    instrucciones: `Escribí en 2 a 6 palabras QUÉ SE HIZO en este service, como renglón de factura en español rioplatense, con sustantivo y sin verbos conjugados: por ejemplo "Cambio de luz", "Reemplazo de resistencia", "Mantenimiento preventivo", "Instalación y puesta en marcha", "Limpieza de cuchillas". Sin número de orden, sin "por garantía", sin horas ni montos, sin punto final. No inventes nada que no esté en las notas.`,
    contexto: JSON.stringify({ orden: ot, repuestos: items }),
    esquema: { type: "object", properties: { que: { type: "string" } }, required: ["que"], additionalProperties: false },
  });
  if (!res.ok) return { error: res.error };
  const que = res.datos.que.trim().replace(/[.\s]+$/, "").slice(0, 60);
  if (!que) return { error: "La IA no propuso nada" };
  const porGarantia = ot.cobertura === "garantia" ? " por garantía" : ot.cobertura === "contrato" ? " por contrato" : "";
  const nombres: Record<string, string> = { mano_de_obra: "Mano de obra", movilidad: "Movilidad", visita: "Visita técnica", diagnostico: "Diagnóstico" };
  const como = cobro ? ` (${nombres[cobro]})` : horas > 0 && ot.cobertura !== "facturable" ? " (Mano de obra)" : "";
  return { ok: true as const, concepto: `ST ${ot.numero} - ${que.charAt(0).toUpperCase() + que.slice(1)}${porGarantia}${como}` };
}

// =====================================================================
// Lo que autoriza dirección: no cobrar y dar de baja (v1.28)
// =====================================================================

const TERMINADA = ["finalizado_tecnico", "revision_admin", "aprobado_facturar"];

/** Deja el motivo en el historial de estados (el renglón lo crea la base) y en los movimientos del cliente. */
async function dejarConstancia(supabase: SupabaseServidor, ot: { id: string; cliente_id: string; numero: number }, hacia: string | null, texto: string) {
  const user = await usuarioActual();
  if (hacia) {
    const { data: ultimo } = await supabase.from("status_history").select("id").eq("ot_id", ot.id).eq("hacia", hacia).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (ultimo) await supabase.from("status_history").update({ observacion: texto }).eq("id", ultimo.id);
  }
  await supabase.from("actividades").insert({ cliente_id: ot.cliente_id, tipo: "service", contenido: `Service ${ot.numero}: ${texto}`, created_by: user?.id ?? null });
}

async function nombreDe(supabase: SupabaseServidor, id: string | undefined) {
  const { data } = await supabase.from("usuarios").select("nombre").eq("id", id ?? "").maybeSingle();
  return (data?.nombre as string | undefined) ?? "dirección";
}

/**
 * Dirección autoriza no cobrar la orden, con el motivo. Queda en $0; si el
 * trabajo ya está terminado, se puede cerrar en el mismo paso.
 */
export async function noCobrarOT(otId: string, motivo: string, detalle: string | null, cerrar: boolean) {
  const supabase = await createClient();
  if ((await puestoActual(supabase)) !== "direccion") return { error: "No cobrar una orden lo autoriza dirección" };
  const texto = motivoCompleto(motivo, detalle);
  if (!texto) return { error: motivo === "Otro" ? "Contá el motivo" : "Elegí el motivo" };
  const { data: ot } = await supabase.from("ordenes_trabajo").select("id, numero, cliente_id, estado").eq("id", otId).maybeSingle();
  if (!ot) return { error: "Orden no encontrada" };
  if (["facturado", "cerrado", "cancelado"].includes(ot.estado)) return { error: "La orden ya está facturada, cerrada o dada de baja" };
  const cierra = cerrar && TERMINADA.includes(ot.estado);
  const { error } = await supabase
    .from("ordenes_trabajo")
    .update({ sin_cargo: true, sin_cargo_motivo: texto, total: 0, ...(cierra ? { estado: "cerrado" } : {}) })
    .eq("id", otId);
  if (error) return { error: error.message };
  const user = await usuarioActual();
  await dejarConstancia(supabase, ot, cierra ? "cerrado" : null, `sin cargo, autorizado por ${await nombreDe(supabase, user?.id)}. Motivo: ${texto}${cierra ? " (cerrada sin facturar)" : ""}`);
  revalidatePath("/", "layout");
  return { ok: true as const, cerrada: cierra };
}

/** Dirección vuelve atrás el "no cobrar" (antes de cerrar la orden). */
export async function volverACobrarOT(otId: string) {
  const supabase = await createClient();
  if ((await puestoActual(supabase)) !== "direccion") return { error: "Eso lo decide dirección" };
  const { data: ot } = await supabase.from("ordenes_trabajo").select("id, numero, cliente_id, estado").eq("id", otId).maybeSingle();
  if (!ot) return { error: "Orden no encontrada" };
  if (["facturado", "cerrado", "cancelado"].includes(ot.estado)) return { error: "La orden ya está cerrada" };
  // Antes de aprobarla el total se calcula solo; aprobada, se recalcula abajo
  const { error } = await supabase
    .from("ordenes_trabajo")
    .update({ sin_cargo: false, sin_cargo_motivo: null, ...(ot.estado !== "aprobado_facturar" ? { total: null } : {}) })
    .eq("id", otId);
  if (error) return { error: error.message };
  await recalcularTotal(supabase, otId);
  const user = await usuarioActual();
  await dejarConstancia(supabase, ot, null, `se vuelve a cobrar (${await nombreDe(supabase, user?.id)})`);
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** Dirección da de baja (anula) la orden, con el motivo, en cualquier estado antes de facturarla. */
export async function darDeBajaOT(otId: string, motivo: string, detalle: string | null) {
  const supabase = await createClient();
  if ((await puestoActual(supabase)) !== "direccion") return { error: "Dar de baja una orden lo decide dirección" };
  const texto = motivoCompleto(motivo, detalle);
  if (!texto) return { error: motivo === "Otro" ? "Contá el motivo" : "Elegí el motivo" };
  const { data: ot } = await supabase.from("ordenes_trabajo").select("id, numero, cliente_id, estado, tecnico_id").eq("id", otId).maybeSingle();
  if (!ot) return { error: "Orden no encontrada" };
  if (["facturado", "cerrado", "cancelado"].includes(ot.estado)) return { error: "La orden ya está facturada, cerrada o dada de baja" };
  const { error } = await supabase.from("ordenes_trabajo").update({ estado: "cancelado", baja_motivo: texto }).eq("id", otId);
  if (error) return { error: error.message };
  const user = await usuarioActual();
  await dejarConstancia(supabase, ot, "cancelado", `dada de baja por ${await nombreDe(supabase, user?.id)}. Motivo: ${texto}`);
  if (ot.tecnico_id)
    await avisar(supabase, [ot.tecnico_id as string], { tipo: "ot_baja", titulo: `Se dio de baja el service ${ot.numero}: ${texto}`, url: `/servicio/${otId}` }, user?.id);
  revalidatePath("/", "layout");
  return { ok: true as const };
}
