"use server";

// Equipos del cliente: alta, edición y fotos.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hoyISO, sumarDias, sumarMeses } from "@/lib/format";
import { usuarioActual } from "./comun";

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
    .select("id, numero_serie, marca_modelo_libre, sucursal_id, producto:productos(nombre)")
    .eq("cliente_id", clienteId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  return (data ?? []).map((e) => {
    const prod = e.producto as unknown as { nombre: string } | null;
    return {
      id: e.id as string,
      etiqueta: `${prod?.nombre ?? e.marca_modelo_libre ?? "Equipo"}${e.numero_serie ? ` · serie ${e.numero_serie}` : ""}`,
      /** Dónde está instalado (v1.14.1: el service va ahí por defecto). */
      sucursalId: (e.sucursal_id as string | null) ?? null,
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
