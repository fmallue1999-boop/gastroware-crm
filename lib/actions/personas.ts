"use server";

// Personas (contactos) de un cliente, separadas de la empresa (migración
// 030): una empresa puede tener varias personas; cada actividad puede decir
// con quién se habló.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizarTelefono } from "@/lib/format";

export type EntradaPersona = {
  nombre: string;
  cargo?: string | null;
  telefono?: string | null;
  email?: string | null;
  esDecisor?: boolean;
};

function limpiar(e: EntradaPersona) {
  const nombre = e.nombre?.trim() ?? "";
  if (!nombre) return { error: "Poné el nombre de la persona" };
  if (nombre.length > 120) return { error: "El nombre es muy largo" };
  const telefono = e.telefono ? normalizarTelefono(e.telefono) : "";
  const email = e.email?.trim().toLowerCase() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "El email no es válido" };
  return {
    datos: {
      nombre,
      cargo: e.cargo?.trim().slice(0, 80) || null,
      telefono: telefono.length >= 6 ? telefono : null,
      email,
      es_decisor: Boolean(e.esDecisor),
    },
  };
}

export async function crearPersona(clienteId: string, e: EntradaPersona) {
  const r = limpiar(e);
  if ("error" in r) return { error: r.error };
  const supabase = await createClient();
  const { error } = await supabase.from("contactos").insert({ cliente_id: clienteId, ...r.datos });
  if (error) return { error: error.message };
  revalidatePath(`/clientes/${clienteId}`);
  return { ok: true as const };
}

export async function editarPersona(id: string, e: EntradaPersona) {
  const r = limpiar(e);
  if ("error" in r) return { error: r.error };
  const supabase = await createClient();
  const { data, error } = await supabase.from("contactos").update(r.datos).eq("id", id).select("cliente_id");
  if (error || !data?.length) return { error: error?.message ?? "No se pudo guardar" };
  revalidatePath(`/clientes/${data[0].cliente_id}`);
  return { ok: true as const };
}

/** Quitar una persona (queda guardada en el historial, no se borra). */
export async function quitarPersona(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contactos")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .select("cliente_id");
  if (error || !data?.length) return { error: error?.message ?? "No se pudo quitar" };
  revalidatePath(`/clientes/${data[0].cliente_id}`);
  return { ok: true as const };
}
