"use server";

// Repuestos (migración 032): solicitud → validación técnica (si hace falta)
// → cotización → confirmación → pedido (circuito de la venta). Puede venir de
// un caso o de un service sin volver a cargar cliente ni equipo.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { dinero, fechaCorta, hoyISO, normalizarTelefono, sumarDias } from "@/lib/format";
import { ACCIONES } from "@/lib/actividad";
import { textoDisponibilidad, totalRepuesto } from "@/lib/repuestos";
import { avisar, usuarioActual } from "./comun";
import { buscarDuplicados } from "./contactos";
import { cambiarEtapa } from "./intereses";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const DISP = ["en_stock", "a_pedir", "sin_disponibilidad"];

async function subirFoto(oportunidadId: string, base64: string): Promise<string | null> {
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/\s+/g, "");
  if (!clave || base64.length > 8_000_000) return null;
  const { createClient: admin } = await import("@supabase/supabase-js");
  const db = admin(process.env.NEXT_PUBLIC_SUPABASE_URL!, clave, { auth: { autoRefreshToken: false, persistSession: false } });
  const path = `repuestos/${oportunidadId}/${Date.now()}.jpg`;
  const { error } = await db.storage.from("servicio").upload(path, Buffer.from(base64, "base64"), { contentType: "image/jpeg" });
  return error ? null : path;
}

export async function crearSolicitudRepuesto(input: {
  clienteId?: string | null;
  /** Cliente nuevo mínimo (si no está en la base). */
  clienteNuevo?: { nombre: string; telefono?: string; empresa?: string } | null;
  crearIgual?: boolean;
  sucursalId?: string | null;
  equipoId?: string | null;
  modeloTexto?: string | null;
  numeroSerie?: string | null;
  repuestoId?: string | null;
  /** Producto del catálogo general que es un repuesto (opcional). */
  productoId?: string | null;
  descripcion: string;
  codigo?: string | null;
  fotoBase64?: string | null;
  cantidad: number;
  requiereValidacion: boolean;
  validadorId?: string | null;
  precioUnitario?: number | null;
  moneda?: "ARS" | "USD";
  disponibilidad?: string | null;
  plazoDias?: number | null;
  comercialId?: string | null;
  casoId?: string | null;
  otId?: string | null;
  proximo?: { fecha: string; accion?: string | null } | null;
}) {
  const descripcion = input.descripcion?.trim() ?? "";
  if (!descripcion) return { error: "Describí qué repuesto necesita" };
  if (!(input.cantidad > 0)) return { error: "La cantidad tiene que ser mayor a 0" };
  if (input.proximo?.fecha && (!FECHA.test(input.proximo.fecha) || input.proximo.fecha < hoyISO())) return { error: "El próximo paso tiene que ser de hoy en adelante" };
  const supabase = await createClient();
  const user = await usuarioActual();
  if (!user) return { error: "Sesión vencida: volvé a entrar" };

  // Cliente: el elegido o uno nuevo mínimo (con aviso de duplicados)
  let clienteId = input.clienteId ?? null;
  if (!clienteId) {
    const n = input.clienteNuevo;
    if (!n?.nombre?.trim()) return { error: "Elegí el cliente o cargá uno nuevo" };
    const tel = normalizarTelefono(n.telefono ?? "");
    if (!input.crearIgual) {
      const duplicados = await buscarDuplicados(tel, null);
      if (duplicados.length) return { duplicados };
    }
    const { data: nuevo, error } = await supabase
      .from("clientes")
      .insert({ nombre_comercial: n.empresa?.trim() || n.nombre.trim(), telefono: tel.length >= 6 ? tel : null, rubro: "Otro", comercial_id: user.id })
      .select("id")
      .single();
    if (error || !nuevo) return { error: error?.message ?? "No se pudo crear el cliente" };
    clienteId = nuevo.id as string;
    await supabase.from("contactos").insert({ cliente_id: clienteId, nombre: n.nombre.trim(), telefono: tel.length >= 6 ? tel : null, es_decisor: true });
  }
  const { data: cliente } = await supabase.from("clientes").select("comercial_id, nombre_comercial").eq("id", clienteId).maybeSingle();
  if (!cliente) return { error: "No se encontró el cliente" };

  const comercialId = input.comercialId || (cliente.comercial_id as string | null) || user.id;
  const total = totalRepuesto(input.precioUnitario ?? null, input.cantidad);
  const accion = input.proximo?.accion && ACCIONES.some((a) => a.value === input.proximo!.accion) ? input.proximo.accion : null;
  const { data: opp, error } = await supabase
    .from("oportunidades")
    .insert({
      cliente_id: clienteId,
      sucursal_id: input.sucursalId || null,
      linea: "repuestos",
      producto_id: input.productoId || null,
      comercial_id: comercialId,
      origen: input.casoId ? "Caso" : input.otId ? "Service" : "Repuesto",
      pedido: "precio",
      etapa: "nueva",
      primer_contacto_at: new Date().toISOString(),
      mensaje_inicial: descripcion.slice(0, 200),
      monto_estimado: total,
      moneda: input.moneda === "USD" ? "USD" : "ARS",
      proximo_contacto: input.proximo?.fecha || null,
      proxima_accion: input.proximo?.fecha ? accion : null,
    })
    .select("id")
    .single();
  if (error || !opp) return { error: error?.message ?? "No se pudo crear la solicitud" };

  const foto = input.fotoBase64 ? await subirFoto(opp.id, input.fotoBase64) : null;
  const requiere = input.requiereValidacion;
  const { error: errS } = await supabase.from("solicitudes_repuesto").insert({
    oportunidad_id: opp.id,
    cliente_id: clienteId,
    equipo_id: input.equipoId || null,
    modelo_texto: input.modeloTexto?.trim() || null,
    numero_serie: input.numeroSerie?.trim() || null,
    repuesto_id: input.repuestoId || null,
    descripcion,
    codigo: input.codigo?.trim() || null,
    foto_path: foto,
    cantidad: input.cantidad,
    validacion: requiere ? "pendiente" : "no_requiere",
    validador_id: requiere ? input.validadorId || null : null,
    disponibilidad: input.disponibilidad && DISP.includes(input.disponibilidad) ? input.disponibilidad : null,
    plazo_dias: input.plazoDias ?? null,
    precio_unitario: input.precioUnitario ?? null,
    moneda: input.moneda === "USD" ? "USD" : "ARS",
    caso_id: input.casoId || null,
    ot_id: input.otId || null,
  });
  if (errS) {
    await supabase.from("oportunidades").update({ deleted_at: new Date().toISOString() }).eq("id", opp.id);
    return { error: errS.message };
  }

  await supabase.from("actividades").insert({
    cliente_id: clienteId,
    oportunidad_id: opp.id,
    tipo: "nota",
    contenido: `Solicitud de repuesto: ${input.cantidad > 1 ? `${input.cantidad} × ` : ""}${descripcion}${input.modeloTexto ? ` (${input.modeloTexto.trim()})` : ""}${requiere ? " — falta validación técnica" : ""}`,
    created_by: user.id,
  });
  if (requiere && input.validadorId)
    await avisar(supabase, [input.validadorId], { tipo: "repuesto_validar", titulo: `Repuesto para validar: ${descripcion.slice(0, 80)}`, cuerpo: cliente.nombre_comercial as string, url: "/repuestos?ver=validar" }, user.id);
  if (comercialId !== user.id)
    await avisar(supabase, [comercialId], { tipo: "repuesto", titulo: `Solicitud de repuesto: ${cliente.nombre_comercial}`, cuerpo: descripcion.slice(0, 120), url: `/clientes/${clienteId}` }, user.id);

  revalidatePath("/", "layout");
  return { ok: true as const, oportunidadId: opp.id as string, clienteId };
}

async function solicitud(supabase: Awaited<ReturnType<typeof createClient>>, oportunidadId: string) {
  const { data } = await supabase
    .from("solicitudes_repuesto")
    .select("oportunidad_id, cliente_id, descripcion, cantidad, validador_id, opp:oportunidades(comercial_id, etapa)")
    .eq("oportunidad_id", oportunidadId)
    .maybeSingle();
  return data as unknown as { oportunidad_id: string; cliente_id: string; descripcion: string; cantidad: number; validador_id: string | null; opp: { comercial_id: string | null; etapa: string } | null } | null;
}

/** Servicio técnico valida (o no pudo identificar) la pieza. */
export async function validarRepuesto(
  oportunidadId: string,
  input: { resultado: "validada" | "no_se_pudo"; repuestoId?: string | null; codigo?: string | null; descripcion?: string | null; nota?: string | null; disponibilidad?: string | null; plazoDias?: number | null }
) {
  const supabase = await createClient();
  const user = await usuarioActual();
  const s = await solicitud(supabase, oportunidadId);
  if (!s) return { error: "No se encontró la solicitud" };
  if (input.resultado === "no_se_pudo" && !input.nota?.trim()) return { error: "Contá por qué no se pudo identificar" };
  const cambios: Record<string, unknown> = {
    validacion: input.resultado,
    validado_por: user?.id ?? null,
    validado_at: new Date().toISOString(),
    validacion_nota: input.nota?.trim() || null,
  };
  if (input.repuestoId) cambios.repuesto_id = input.repuestoId;
  if (input.codigo?.trim()) cambios.codigo = input.codigo.trim();
  if (input.descripcion?.trim()) cambios.descripcion = input.descripcion.trim();
  if (input.disponibilidad && DISP.includes(input.disponibilidad)) cambios.disponibilidad = input.disponibilidad;
  if (input.plazoDias != null) cambios.plazo_dias = input.plazoDias;
  const { data, error } = await supabase.from("solicitudes_repuesto").update(cambios).eq("oportunidad_id", oportunidadId).select("oportunidad_id");
  if (error || !data?.length) return { error: error?.message ?? "No la podés validar" };
  await supabase.from("actividades").insert({
    cliente_id: s.cliente_id,
    oportunidad_id: oportunidadId,
    tipo: "nota",
    contenido: `Repuesto ${input.resultado === "validada" ? "validado por servicio técnico" : "no se pudo identificar"}: ${input.descripcion?.trim() || s.descripcion}${input.codigo?.trim() ? ` (código ${input.codigo.trim()})` : ""}${input.nota?.trim() ? ` — ${input.nota.trim()}` : ""}`,
    created_by: user?.id ?? null,
  });
  await avisar(
    supabase,
    [s.opp?.comercial_id],
    {
      tipo: "repuesto",
      titulo: input.resultado === "validada" ? `Repuesto validado: ya se puede cotizar` : `Repuesto: no se pudo identificar`,
      cuerpo: s.descripcion.slice(0, 120),
      url: "/repuestos",
    },
    user?.id
  );
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** Pedir la validación a alguien (o cambiar quién valida). */
export async function pedirValidacionRepuesto(oportunidadId: string, validadorId: string) {
  const supabase = await createClient();
  const user = await usuarioActual();
  const s = await solicitud(supabase, oportunidadId);
  if (!s) return { error: "No se encontró la solicitud" };
  const { error } = await supabase.from("solicitudes_repuesto").update({ validacion: "pendiente", validador_id: validadorId }).eq("oportunidad_id", oportunidadId);
  if (error) return { error: error.message };
  await avisar(supabase, [validadorId], { tipo: "repuesto_validar", titulo: `Repuesto para validar: ${s.descripcion.slice(0, 80)}`, url: "/repuestos?ver=validar" }, user?.id);
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** La pieza ya está identificada: no hace falta validación técnica. */
export async function saltearValidacionRepuesto(oportunidadId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("solicitudes_repuesto").update({ validacion: "no_requiere" }).eq("oportunidad_id", oportunidadId);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** Cotizar: precio, disponibilidad y plazo. Queda "Cotización enviada" con el próximo contacto. */
export async function cotizarRepuesto(
  oportunidadId: string,
  input: { precioUnitario: number; moneda: "ARS" | "USD"; disponibilidad?: string | null; plazoDias?: number | null; volverEl?: string | null }
) {
  if (!(input.precioUnitario >= 0)) return { error: "Poné el precio" };
  if (input.volverEl && (!FECHA.test(input.volverEl) || input.volverEl < hoyISO())) return { error: "El próximo contacto tiene que ser de hoy en adelante" };
  const supabase = await createClient();
  const user = await usuarioActual();
  const s = await solicitud(supabase, oportunidadId);
  if (!s) return { error: "No se encontró la solicitud" };
  const moneda = input.moneda === "USD" ? "USD" : "ARS";
  const { error } = await supabase
    .from("solicitudes_repuesto")
    .update({
      precio_unitario: input.precioUnitario,
      moneda,
      disponibilidad: input.disponibilidad && DISP.includes(input.disponibilidad) ? input.disponibilidad : null,
      plazo_dias: input.plazoDias ?? null,
    })
    .eq("oportunidad_id", oportunidadId);
  if (error) return { error: error.message };
  const total = totalRepuesto(input.precioUnitario, Number(s.cantidad)) ?? 0;
  const volver = input.volverEl || sumarDias(3);
  const { error: e2 } = await supabase
    .from("oportunidades")
    .update({ etapa: "cotizada", monto_estimado: total, moneda, proximo_contacto: volver, proxima_accion: "llamar", proximo_nota: "Confirmar la cotización del repuesto" })
    .eq("id", oportunidadId);
  if (e2) return { error: e2.message };
  await supabase.from("actividades").insert({
    cliente_id: s.cliente_id,
    oportunidad_id: oportunidadId,
    tipo: "cotizacion",
    contenido: `Cotización de repuesto: ${dinero(total, moneda)}${textoDisponibilidad(input.disponibilidad, input.plazoDias) ? ` (${textoDisponibilidad(input.disponibilidad, input.plazoDias)})` : ""} · volver a contactar el ${fechaCorta(volver)}`,
    created_by: user?.id ?? null,
  });
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** El cliente confirmó: se gana y sigue el circuito de la venta (facturar, cobrar, preparar, entregar). */
export async function confirmarRepuesto(oportunidadId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_ganar_venta", { p_oportunidad_id: oportunidadId });
  if (error) return { error: `cerrar la venta: ${error.message}` };
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** No se dio: queda el motivo y se cierra su seguimiento (sin tocar otras operaciones del cliente). */
export async function perderRepuesto(oportunidadId: string, motivo: string) {
  if (!motivo.trim()) return { error: "Elegí el motivo" };
  return cambiarEtapa(oportunidadId, "perdida", motivo);
}

/** Cotización pasada al cliente: queda esperando su confirmación. */
export async function esperandoRepuesto(oportunidadId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("oportunidades").update({ etapa: "seguimiento" }).eq("id", oportunidadId).eq("etapa", "cotizada");
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** Equipos y sucursales de un cliente (para el formulario). */
export async function equiposYSucursalesDe(clienteId: string) {
  const supabase = await createClient();
  const [{ data: equipos }, { data: sucursales }] = await Promise.all([
    supabase
      .from("equipos")
      .select("id, numero_serie, marca_modelo_libre, producto:productos(nombre, es_consumible, categoria)")
      .eq("cliente_id", clienteId)
      .is("deleted_at", null),
    supabase.from("sucursales").select("id, nombre, ciudad").eq("cliente_id", clienteId).is("deleted_at", null),
  ]);
  return {
    equipos: ((equipos ?? []) as unknown as { id: string; numero_serie: string | null; marca_modelo_libre: string | null; producto: { nombre: string; es_consumible: boolean; categoria: string } | null }[])
      .filter((e) => !e.producto?.es_consumible && e.producto?.categoria !== "repuesto")
      .map((e) => ({ id: e.id, nombre: e.producto?.nombre ?? e.marca_modelo_libre ?? "Equipo", serie: e.numero_serie })),
    sucursales: (sucursales ?? []) as { id: string; nombre: string; ciudad: string | null }[],
  };
}
