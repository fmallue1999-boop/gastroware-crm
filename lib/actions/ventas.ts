"use server";

// Ventas: pedido directo y circuito después de vender (manual 1.1):
// informar → facturar → cobro o condición → preparar → despachar → entregar.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hoyISO, normalizarTelefono, sumarDias } from "@/lib/format";
import { PEDIDO_ESTADOS, RELEVAMIENTO_INSTALACION } from "@/lib/constants";
import { esGestor, factura as puedeFacturar } from "@/lib/puestos";
import { atrasoMaximo, diasPostventa } from "@/lib/ventas";
import type { PedidoEstado } from "@/lib/types";
import { avisar, puestoActual, regla, usuarioActual, usuariosDePuesto, type SupabaseServidor } from "./comun";
import { buscarClientePorTelefono } from "./contactos";
import { cambiarEtapa } from "./intereses";

/**
 * Pedido directo: un cliente pide algo (llamada, WhatsApp, mostrador) y se
 * carga como venta ya ganada, directo al tablero de Pedidos. Dispara el
 * circuito completo de ganada (cliente activo, equipo, recurrencia, tarea
 * de facturar) reutilizando cambiarEtapa.
 */
export async function crearPedidoDirecto(input: {
  /** Cliente como texto libre: nombre, empresa o teléfono, como se tenga.
   *  Si parece un teléfono ya cargado, se reutiliza ese cliente; si no, se
   *  crea uno mínimo que se completa después desde su ficha. */
  clienteTexto?: string;
  clienteId?: string;
  productoIds: string[];
  /** v1.16: unidades de cada producto (por defecto 1). */
  cantidades?: Record<string, number>;
  monto?: number | null;
  /** Pesos o dólares (por defecto, la moneda del producto). */
  moneda?: "ARS" | "USD";
  nota?: string;
  /** Fecha estimada de entrega (YYYY-MM-DD), opcional. */
  entregaEstimada?: string;
  /** A dónde volver después de cargar (por defecto, el tablero de ventas). */
  volverA?: string;
}) {
  if (input.productoIds.length === 0 && !input.nota?.trim())
    return { error: "Elegí el equipo o escribí qué se vendió" };

  const supabase = await createClient();
  const user = await usuarioActual();

  let clienteId = input.clienteId;
  if (!clienteId) {
    const texto = input.clienteTexto?.trim() ?? "";
    if (!texto) return { error: "Poné quién lo compró (nombre o teléfono)" };
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
          comercial_id: user?.id ?? null,
          notas: "Cargado rápido desde una venta — completar datos",
        })
        .select("id")
        .single();
      if (errCli || !nuevo)
        return { error: errCli?.message ?? "No se pudo crear el cliente" };
      clienteId = nuevo.id;
    }
  }
  input.clienteId = clienteId;
  const { data: opp, error } = await supabase
    .from("oportunidades")
    .insert({
      cliente_id: input.clienteId,
      producto_id: input.productoIds[0] ?? null,
      productos_extra: input.productoIds.slice(1),
      comercial_id: user?.id ?? null,
      origen: "Venta directa",
      monto_estimado: input.monto || null,
      moneda: input.moneda === "USD" ? "USD" : "ARS",
      mensaje_inicial: input.nota?.trim() || null,
      entrega_estimada: input.entregaEstimada || null,
    })
    .select("id")
    .single();
  if (error || !opp)
    return { error: error?.message ?? "No se pudo crear la venta" };

  // Cuántas unidades de cada uno: la base crea un equipo por unidad (con su garantía)
  const cantidadDe = (id: string) => Math.max(1, Math.min(999, Math.round(Number(input.cantidades?.[id]) || 1)));
  if (input.productoIds.length) {
    const { error: errItems } = await supabase
      .from("oportunidad_items")
      .insert(input.productoIds.map((id) => ({ oportunidad_id: opp.id, producto_id: id, cantidad: cantidadDe(id) })));
    if (errItems) return { error: `guardar cantidades: ${errItems.message}` };
    await supabase
      .from("oportunidades")
      .update({ cantidad: input.productoIds.reduce((s, id) => s + cantidadDe(id), 0) })
      .eq("id", opp.id);
  }

  // Reutiliza todo el circuito de "ganada": cliente activo, equipo con
  // garantía, recompra de consumibles y estado Vendido.
  const res = await cambiarEtapa(opp.id, "ganada");
  if (res && "error" in res && res.error) return { error: res.error };

  revalidatePath("/", "layout");
  redirect(input.volverA || "/pedidos");
}

/** Fecha estimada de entrega de un pedido (editable desde el circuito). */
export async function setEntregaEstimada(oportunidadId: string, fecha: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("oportunidades")
    .update({ entrega_estimada: fecha || null })
    .eq("id", oportunidadId);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}


// =====================================================================
// Circuito de la venta (manual 1.1, pasos 4 a 12)
// =====================================================================

const COLS_VENTA =
  "id, cliente_id, comercial_id, etapa, pedido_estado, producto_id, productos_extra, forma_pago, direccion_entrega, lleva_instalacion, relevamiento, remito_nro, nro_factura, monto_estimado, moneda, entregado_at, vendido_at, cliente:clientes(nombre_comercial), producto:productos(nombre, video_url)";

type VentaFila = {
  id: string;
  cliente_id: string;
  comercial_id: string | null;
  etapa: string;
  pedido_estado: PedidoEstado | null;
  producto_id: string | null;
  productos_extra?: unknown;
  forma_pago: string | null;
  direccion_entrega: string | null;
  lleva_instalacion: boolean;
  relevamiento: Record<string, string> | null;
  remito_nro: string | null;
  nro_factura: string | null;
  monto_estimado: number | null;
  moneda: string;
  entregado_at: string | null;
  vendido_at: string | null;
  cliente: { nombre_comercial: string } | null;
  producto: { nombre: string; video_url: string | null } | null;
};

/**
 * Unidades de cada producto de la venta (v1.16): el principal y los extra,
 * con la cantidad cargada (1 si no hay). Para descontar o devolver stock.
 */
async function unidadesVendidas(supabase: SupabaseServidor, v: { id: string; producto_id: string | null; productos_extra?: unknown }) {
  const ids = [v.producto_id, ...((Array.isArray(v.productos_extra) ? v.productos_extra : []) as string[])].filter(Boolean) as string[];
  if (!ids.length) return [];
  const { data } = await supabase.from("oportunidad_items").select("producto_id, cantidad").eq("oportunidad_id", v.id);
  const items = (data ?? []) as { producto_id: string; cantidad: number }[];
  return [...new Set(ids)].map((id) => ({
    productoId: id,
    cantidad: Math.max(1, Math.round(items.filter((i) => i.producto_id === id).reduce((s, i) => s + Number(i.cantidad), 0)) || 1),
  }));
}

async function cargarVenta(supabase: SupabaseServidor, id: string): Promise<VentaFila | null> {
  const { data } = await supabase.from("oportunidades").select(COLS_VENTA).eq("id", id).maybeSingle();
  return (data as unknown as VentaFila | null) ?? null;
}

async function movimiento(supabase: SupabaseServidor, v: VentaFila, contenido: string, userId?: string | null) {
  await supabase.from("actividades").insert({
    cliente_id: v.cliente_id,
    oportunidad_id: v.id,
    tipo: "pedido",
    contenido,
    created_by: userId ?? null,
  });
}

const nombreVenta = (v: VentaFila) =>
  `${v.producto?.nombre ?? "venta"} · ${v.cliente?.nombre_comercial ?? "cliente"}`;

/**
 * Paso 4: el vendedor informa la venta (forma de pago, dónde se entrega, a
 * qué razón social se factura y si lleva instalación, con el relevamiento
 * del lugar). Avisa a la administrativa para facturar.
 */
export async function informarVenta(
  oportunidadId: string,
  input: {
    formaPago: string;
    direccionEntrega: string;
    sucursalId?: string | null;
    llevaInstalacion: boolean;
    relevamiento?: Record<string, string>;
    entregaEstimada?: string | null;
    nota?: string;
  }
) {
  const formaPago = input.formaPago.trim();
  const direccion = input.direccionEntrega.trim();
  if (!formaPago) return { error: "Elegí la forma de pago" };
  if (!direccion) return { error: "Poné dónde se entrega (dirección o “retira en el local”)" };
  let relevamiento: Record<string, string> | null = null;
  if (input.llevaInstalacion) {
    relevamiento = {};
    for (const r of RELEVAMIENTO_INSTALACION) {
      const valor = input.relevamiento?.[r.key]?.trim() ?? "";
      if (!valor) return { error: `Falta el relevamiento: ${r.label}. Sin relevamiento no se programa la instalación.` };
      relevamiento[r.key] = valor;
    }
  }

  const supabase = await createClient();
  const user = await usuarioActual();
  let v = await cargarVenta(supabase, oportunidadId);
  if (!v) return { error: "No se encontró la venta" };
  if (v.etapa !== "ganada") {
    const r = await cambiarEtapa(oportunidadId, "ganada");
    if (r && "error" in r && r.error) return { error: r.error };
    v = await cargarVenta(supabase, oportunidadId);
    if (!v) return { error: "No se encontró la venta" };
  }
  if ((v.pedido_estado ?? "comprometido") !== "comprometido")
    return { error: "La venta ya está facturada: los cambios los hace administración" };

  const { error } = await supabase
    .from("oportunidades")
    .update({
      forma_pago: formaPago,
      direccion_entrega: direccion,
      sucursal_id: input.sucursalId || null,
      lleva_instalacion: input.llevaInstalacion,
      relevamiento,
      entrega_estimada: input.entregaEstimada || null,
      vendido_at: v.vendido_at ?? new Date().toISOString(),
    })
    .eq("id", oportunidadId);
  if (error) return { error: error.message };

  await movimiento(
    supabase,
    v,
    `Venta informada · pago: ${formaPago} · entrega: ${direccion}${input.llevaInstalacion ? " · con instalación (relevamiento cargado)" : ""}${
      input.nota?.trim() ? ` · ${input.nota.trim()}` : ""
    }`,
    user?.id
  );
  const administracion = await usuariosDePuesto(supabase, ["administrativa", "admin", "direccion"]);
  await avisar(
    supabase,
    administracion,
    { tipo: "venta_para_facturar", titulo: `Venta para facturar: ${nombreVenta(v)}`, url: "/pedidos" },
    user?.id
  );
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/**
 * Paso 5: administración factura (número de ZEUS, fecha, vencimiento y
 * monto). La factura queda en Cobranzas; la venta espera el cobro.
 */
export async function facturarVenta(
  oportunidadId: string,
  input: {
    numero: string;
    fecha?: string;
    vencimiento?: string | null;
    monto?: number | null;
    moneda?: string;
    serie?: string;
  }
) {
  const numero = input.numero.trim();
  if (!numero) return { error: "Falta el número de factura" };
  const supabase = await createClient();
  if (!puedeFacturar(await puestoActual(supabase))) return { error: "Factura administración" };
  const user = await usuarioActual();
  const v = await cargarVenta(supabase, oportunidadId);
  if (!v) return { error: "No se encontró la venta" };
  if (v.etapa !== "ganada") return { error: "Se factura una vez vendida" };
  if ((v.pedido_estado ?? "comprometido") !== "comprometido") return { error: "Esta venta ya está facturada" };
  if (!v.forma_pago) return { error: "Falta que el vendedor informe la venta (forma de pago y entrega)" };

  const serie = input.serie?.trim();
  if (serie) {
    const { data: equipo } = await supabase
      .from("equipos")
      .select("id, numero_serie")
      .eq("oportunidad_id", oportunidadId)
      .maybeSingle();
    if (equipo && !equipo.numero_serie) {
      const { error: errSerie } = await supabase.from("equipos").update({ numero_serie: serie }).eq("id", equipo.id);
      if (errSerie)
        return {
          error: errSerie.code === "23505" ? `El número de serie ${serie} ya está cargado en otro equipo` : errSerie.message,
        };
    }
  }

  const { data: opp } = await supabase.from("oportunidades").select("sucursal_id").eq("id", oportunidadId).single();
  const fecha = input.fecha && /^\d{4}-\d{2}-\d{2}$/.test(input.fecha) ? input.fecha : hoyISO();
  const { error: errF } = await supabase.from("facturas").insert({
    cliente_id: v.cliente_id,
    sucursal_id: opp?.sucursal_id ?? null,
    oportunidad_id: oportunidadId,
    tipo: "venta",
    numero,
    fecha,
    vencimiento: input.vencimiento || fecha,
    monto: input.monto ?? v.monto_estimado,
    moneda: input.moneda || v.moneda || "ARS",
    created_by: user?.id ?? null,
  });
  if (errF) return { error: `guardar la factura: ${errF.message}` };

  const { error } = await supabase
    .from("oportunidades")
    .update({ nro_factura: numero, pedido_estado: "facturado" })
    .eq("id", oportunidadId);
  if (error) return { error: error.message };

  await movimiento(
    supabase,
    v,
    `Venta facturada (${numero})${serie ? `, serie ${serie} anexada al equipo` : ""}. Falta el cobro para preparar.`,
    user?.id
  );
  await avisar(
    supabase,
    [v.comercial_id],
    { tipo: "venta_facturada", titulo: `Facturada: ${nombreVenta(v)}`, url: `/clientes/${v.cliente_id}` },
    user?.id
  );
  if (/cuenta corriente/i.test(v.forma_pago)) {
    const direccion = await usuariosDePuesto(supabase, ["admin", "direccion"]);
    await avisar(
      supabase,
      direccion,
      { tipo: "condicion_a_aprobar", titulo: `Condición de pago a aprobar: ${nombreVenta(v)}`, url: "/cobranzas" },
      user?.id
    );
  }
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** Paso 7: remito y prioridad del día para el depósito. */
export async function prepararVenta(oportunidadId: string, input: { remito: string; prioridad?: number | null }) {
  const supabase = await createClient();
  const rol = await puestoActual(supabase);
  if (!puedeFacturar(rol) && rol !== "servicio") return { error: "El remito lo hace administración" };
  const user = await usuarioActual();
  const v = await cargarVenta(supabase, oportunidadId);
  if (!v) return { error: "No se encontró la venta" };
  if (v.pedido_estado !== "preparar_envio") return { error: "La venta todavía no está para preparar (falta factura y cobro)" };
  const remito = input.remito.trim();
  if (!remito) return { error: "Poné el número de remito" };
  const { error } = await supabase
    .from("oportunidades")
    .update({ remito_nro: remito, prioridad_despacho: input.prioridad ?? null })
    .eq("id", oportunidadId);
  if (error) return { error: error.message };
  if (remito !== v.remito_nro) await movimiento(supabase, v, `Remito ${remito} para preparar`, user?.id);
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** Paso 9: despacho (transporte, seguimiento y videos del modelo al cliente). */
export async function despacharVenta(
  oportunidadId: string,
  input: { transporte: string; seguimiento?: string; videosEnviados: boolean; remito?: string }
) {
  const supabase = await createClient();
  const rol = await puestoActual(supabase);
  if (!puedeFacturar(rol) && !["tecnico", "servicio"].includes(rol)) return { error: "Despacha administración o depósito" };
  const user = await usuarioActual();
  const v = await cargarVenta(supabase, oportunidadId);
  if (!v) return { error: "No se encontró la venta" };
  if (v.pedido_estado !== "preparar_envio")
    return { error: "Nada se despacha sin factura y cobro acreditado (o condición aprobada)" };
  const remito = input.remito?.trim() || v.remito_nro;
  if (!remito) return { error: "Falta el número de remito" };
  const transporte = input.transporte.trim();
  if (!transporte) return { error: "Poné cómo sale (transporte, flete propio o retira el cliente)" };
  const ahora = new Date().toISOString();
  const { error } = await supabase
    .from("oportunidades")
    .update({
      pedido_estado: "despachado",
      despachado_at: ahora,
      remito_nro: remito,
      transporte,
      nro_seguimiento: input.seguimiento?.trim() || null,
      videos_enviados_at: input.videosEnviados ? ahora : null,
    })
    .eq("id", oportunidadId);
  if (error) return { error: error.message };
  await movimiento(
    supabase,
    v,
    `Despachado · ${transporte}${input.seguimiento?.trim() ? ` · seguimiento ${input.seguimiento.trim()}` : ""} · remito ${remito}${
      input.videosEnviados ? " · videos del modelo enviados" : ""
    }`,
    user?.id
  );
  await avisar(
    supabase,
    [v.comercial_id],
    { tipo: "venta_despachada", titulo: `Despachado: ${nombreVenta(v)}`, url: `/clientes/${v.cliente_id}` },
    user?.id
  );
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/**
 * Paso 10: entregado. Descuenta 1 del stock del producto y agenda la
 * postventa al vendedor (día 10; con instalación, también 2 y 30).
 */
export async function entregarVenta(oportunidadId: string) {
  const supabase = await createClient();
  const user = await usuarioActual();
  const v = await cargarVenta(supabase, oportunidadId);
  if (!v) return { error: "No se encontró la venta" };
  if (v.pedido_estado === "entregado") return { ok: true as const };
  if (v.pedido_estado !== "despachado") return { error: "Primero se despacha (con factura y cobro)" };
  const hoy = hoyISO();
  const { error } = await supabase
    .from("oportunidades")
    .update({ pedido_estado: "entregado", entregado_at: v.entregado_at ?? new Date().toISOString() })
    .eq("id", oportunidadId);
  if (error) return { error: error.message };

  let notaStock = "";
  const unidades = await unidadesVendidas(supabase, v);
  if (unidades.length) {
    const errores = await Promise.all(
      unidades.map((u) => supabase.rpc("fn_ajustar_stock", { p_producto_id: u.productoId, p_delta: -u.cantidad }).then((r) => r.error))
    );
    const total = unidades.reduce((s, u) => s + u.cantidad, 0);
    notaStock = errores.some(Boolean) ? " (no se pudo descontar todo el stock)" : ` · stock descontado (${total} ${total === 1 ? "unidad" : "unidades"})`;
  }

  const responsable = v.comercial_id ?? user?.id ?? null;
  const postventa = diasPostventa(v.lleva_instalacion);
  const { error: errT } = await supabase.from("tareas").insert(
    postventa.map((p) => ({
      cliente_id: v.cliente_id,
      oportunidad_id: v.id,
      usuario_id: responsable,
      tipo: "postventa",
      titulo: p.titulo,
      vence_el: sumarDias(p.dias, hoy),
      auto: true,
    }))
  );
  await movimiento(
    supabase,
    v,
    `Entregado${notaStock}. Postventa agendada: día ${postventa.map((p) => p.dias).join(", ")}${errT ? " (no se pudo agendar)" : ""}`,
    user?.id
  );
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/**
 * Corrección de dirección: vuelve la venta a un paso anterior (por ejemplo,
 * un despacho cargado por error). Si sale de Entregado, devuelve el stock.
 */
export async function corregirPasoVenta(oportunidadId: string, estado: PedidoEstado) {
  const supabase = await createClient();
  if (!esGestor(await puestoActual(supabase))) return { error: "Solo dirección corrige el paso de una venta" };
  const user = await usuarioActual();
  const v = await cargarVenta(supabase, oportunidadId);
  if (!v) return { error: "No se encontró la venta" };
  if (v.etapa !== "ganada") return { error: "La venta se sigue una vez vendida" };
  const update: Record<string, unknown> = { pedido_estado: estado };
  if (estado !== "entregado") update.entregado_at = null;
  const { error } = await supabase.from("oportunidades").update(update).eq("id", oportunidadId);
  if (error) return { error: error.message };
  if (v.pedido_estado === "entregado" && estado !== "entregado") {
    const unidades = await unidadesVendidas(supabase, v);
    await Promise.all(unidades.map((u) => supabase.rpc("fn_ajustar_stock", { p_producto_id: u.productoId, p_delta: u.cantidad })));
  }
  const label = PEDIDO_ESTADOS.find((p) => p.value === estado)?.label ?? estado;
  await movimiento(supabase, v, `Venta corregida por dirección: vuelve a ${label}`, user?.id);
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** Días de atraso del cliente (se muestra antes de liberar un despacho). */
export async function atrasoDeCliente(clienteId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("facturas")
    .select("vencimiento, cobro_estado")
    .eq("cliente_id", clienteId)
    .neq("cobro_estado", "cobrado");
  const dias = atrasoMaximo((data ?? []) as { vencimiento: string | null; cobro_estado: string }[], hoyISO());
  const limite = Number(await regla(supabase, "dias_atraso_frena_despacho")) || 30;
  return { dias, limite, frena: dias > limite };
}

/**
 * Eliminar una venta o un interés mal cargado (v1.17, solo dirección y
 * administración). Se borra la operación con sus cotizaciones; los equipos que
 * creó la venta se borran salvo que ya tengan un service; si estaba entregada
 * vuelve el stock; la factura se borra salvo que ya tenga un cobro. En la ficha
 * del cliente queda el registro de qué se eliminó y por qué.
 */
export async function eliminarOperacion(oportunidadId: string, motivo: string) {
  const texto = motivo.trim();
  if (!texto) return { error: "Contá por qué se elimina (ej: cargada dos veces, cliente equivocado)" };
  const supabase = await createClient();
  if (!esGestor(await puestoActual(supabase))) return { error: "Solo dirección puede eliminar una operación" };
  const user = await usuarioActual();
  const { data: opp } = await supabase
    .from("oportunidades")
    .select("id, cliente_id, etapa, pedido_estado, producto_id, productos_extra, monto_estimado, moneda, mensaje_inicial, producto:productos(nombre)")
    .eq("id", oportunidadId)
    .maybeSingle();
  if (!opp) return { error: "No se encontró la operación" };

  // La factura: si ya tiene un cobro, no se toca (primero se corrige en Cobranzas)
  const { data: facturas } = await supabase.from("facturas").select("id, numero, cobro_estado").eq("oportunidad_id", oportunidadId);
  const cobrada = ((facturas ?? []) as { numero: string | null; cobro_estado: string }[]).find((f) => f.cobro_estado === "cobrado");
  if (cobrada) return { error: `Tiene la factura${cobrada.numero ? ` N° ${cobrada.numero}` : ""} cobrada: primero corregí el cobro en Cobranzas` };

  // Stock: si ya se había entregado, vuelve
  if (opp.etapa === "ganada" && opp.pedido_estado === "entregado") {
    const unidades = await unidadesVendidas(supabase, opp);
    await Promise.all(unidades.map((u) => supabase.rpc("fn_ajustar_stock", { p_producto_id: u.productoId, p_delta: u.cantidad })));
  }

  // Equipos que creó la venta: se borran salvo los que ya tienen un service
  const { data: equipos } = await supabase.from("equipos").select("id").eq("oportunidad_id", oportunidadId);
  const idsEquipos = ((equipos ?? []) as { id: string }[]).map((e) => e.id);
  let conService = 0;
  if (idsEquipos.length) {
    const { data: ots } = await supabase.from("ordenes_trabajo").select("equipo_id").in("equipo_id", idsEquipos);
    const usados = new Set(((ots ?? []) as { equipo_id: string }[]).map((o) => o.equipo_id));
    conService = usados.size;
    const borrar = idsEquipos.filter((id) => !usados.has(id));
    if (borrar.length) {
      const { error: eEq } = await supabase.from("equipos").delete().in("id", borrar);
      if (eEq) return { error: `borrar equipos: ${eEq.message}` };
    }
  }
  if ((facturas ?? []).length) {
    const { error: eFac } = await supabase.from("facturas").delete().eq("oportunidad_id", oportunidadId);
    if (eFac) return { error: `borrar factura: ${eFac.message}` };
  }

  const que =
    (opp.producto as unknown as { nombre: string } | null)?.nombre ?? opp.mensaje_inicial ?? (opp.etapa === "ganada" ? "Venta" : "Interés");
  const tipo = opp.etapa === "ganada" ? "Venta" : "Interés";
  const { error } = await supabase.from("oportunidades").delete().eq("id", oportunidadId);
  if (error) return { error: error.message };
  await supabase.from("actividades").insert({
    cliente_id: opp.cliente_id,
    oportunidad_id: null,
    // No cuenta como contacto en los informes
    tipo: "cambio_etapa",
    contenido: [
      `${tipo} eliminada por dirección: ${que}`,
      opp.monto_estimado ? `${opp.moneda ?? ""} ${Number(opp.monto_estimado).toLocaleString("es-AR")}`.trim() : null,
      `Motivo: ${texto}`,
      conService ? `${conService} equipo${conService > 1 ? "s" : ""} con service quedaron en la ficha` : null,
    ]
      .filter(Boolean)
      .join(" · "),
    created_by: user?.id ?? null,
  });
  revalidatePath("/", "layout");
  return { ok: true as const, conService };
}
