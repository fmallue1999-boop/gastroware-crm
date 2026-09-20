"use server";

// Ventas: pedido directo y circuito vendido → preparar → facturar → entregado.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { exigirGestor } from "@/lib/auth";
import { normalizarTelefono } from "@/lib/format";
import { PEDIDO_ESTADOS } from "@/lib/constants";
import type { Cliente, PedidoEstado } from "@/lib/types";
import { usuarioActual } from "./comun";
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
  monto?: number | null;
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
      mensaje_inicial: input.nota?.trim() || null,
      entrega_estimada: input.entregaEstimada || null,
    })
    .select("id")
    .single();
  if (error || !opp)
    return { error: error?.message ?? "No se pudo crear la venta" };

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

/**
 * Avanza la venta por su circuito: vendido → preparar → facturar →
 * (facturado, a entregar) → entregado. No agenda nada solo.
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

  const label =
    PEDIDO_ESTADOS.find((p) => p.value === estado)?.label ?? estado;
  await supabase.from("actividades").insert({
    cliente_id: opp.cliente_id,
    oportunidad_id: oportunidadId,
    tipo: "pedido",
    contenido: `Venta: ${label}`,
    created_by: user?.id ?? null,
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Cierra el paso "Facturar" de la venta: guarda el número de factura y, si
 * la venta incluye un equipo, su número de serie (queda anexado al equipo
 * del cliente). Después queda "facturada, a entregar".
 */
export async function facturarPedido(
  oportunidadId: string,
  nroFactura: string,
  numeroSerie?: string
) {
  if (!nroFactura.trim()) return { error: "Falta el número de factura" };
  // Facturar es de dirección/administración (la base lo refuerza con
  // fn_protege_facturacion desde la migración 025).
  const bloqueo = await exigirGestor();
  if (bloqueo) return bloqueo;
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
    .update({ nro_factura: nroFactura.trim(), pedido_estado: "para_entregar" })
    .eq("id", oportunidadId);
  if (error) return { error: error.message };

  await supabase.from("actividades").insert({
    cliente_id: opp.cliente_id,
    oportunidad_id: oportunidadId,
    tipo: "pedido",
    contenido: `Venta facturada (${nroFactura.trim()})${serie ? `, serie ${serie} anexada al equipo` : ""}. Falta entregar.`,
    created_by: user?.id ?? null,
  });

  revalidatePath("/", "layout");
  return { ok: true };
}
