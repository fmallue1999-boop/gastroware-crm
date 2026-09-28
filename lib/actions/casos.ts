"use server";

// Casos de postventa (manual 4.3): reclamo → primera respuesta → a distancia
// o derivado a servicio técnico (crea el trabajo) → cierre con causa y solución.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PRIORIDADES_CASO } from "@/lib/constants";
import { hoyISO } from "@/lib/format";
import { prioridadOT } from "@/lib/casos";
import { avisar, usuarioActual, usuariosDePuesto, type SupabaseServidor } from "./comun";

type CasoFila = {
  id: string;
  numero: number;
  cliente_id: string;
  sucursal_id: string | null;
  equipo_id: string | null;
  responsable_id: string | null;
  prioridad: string;
  descripcion: string;
  estado: string;
  primera_respuesta_at: string | null;
  ot_id: string | null;
  cliente: { nombre_comercial: string } | null;
};

async function cargarCaso(supabase: SupabaseServidor, id: string) {
  const { data } = await supabase
    .from("casos")
    .select("id, numero, cliente_id, sucursal_id, equipo_id, responsable_id, prioridad, descripcion, estado, primera_respuesta_at, ot_id, cliente:clientes(nombre_comercial)")
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as CasoFila | null) ?? null;
}

async function nota(supabase: SupabaseServidor, c: { cliente_id: string }, contenido: string, userId?: string | null) {
  await supabase.from("actividades").insert({ cliente_id: c.cliente_id, tipo: "caso", contenido, created_by: userId ?? null });
}

const labelPrioridad = (p: string) => PRIORIDADES_CASO.find((x) => x.value === p)?.label ?? p;

/**
 * Abre un caso. Responsable: el vendedor dueño de la cuenta (si no tiene,
 * quien lo abre si vende; si no, dirección). Un equipo parado avisa también
 * a servicio técnico.
 */
export async function abrirCaso(input: {
  clienteId: string;
  equipoId?: string | null;
  sucursalId?: string | null;
  prioridad: string;
  descripcion: string;
  volverA?: string;
}) {
  const descripcion = input.descripcion.trim();
  if (!input.clienteId) return { error: "Elegí el cliente" };
  if (!descripcion) return { error: "Contá qué pasa" };
  const prioridad = PRIORIDADES_CASO.some((p) => p.value === input.prioridad) ? input.prioridad : "anda_mal";
  const supabase = await createClient();
  const user = await usuarioActual();

  const [{ data: cli }, { data: yo }] = await Promise.all([
    supabase.from("clientes").select("nombre_comercial, comercial_id").eq("id", input.clienteId).maybeSingle(),
    supabase.from("usuarios").select("rol").eq("id", user?.id ?? "").maybeSingle(),
  ]);
  const { data: dueno } = cli?.comercial_id
    ? await supabase.from("usuarios").select("id, rol, activo").eq("id", cli.comercial_id).maybeSingle()
    : { data: null };
  let responsable: string | null = null;
  if (dueno?.activo && ["comercial", "direccion"].includes(dueno.rol as string)) responsable = dueno.id as string;
  else if (yo && ["comercial", "direccion"].includes(yo.rol as string)) responsable = user?.id ?? null;
  else responsable = (await usuariosDePuesto(supabase, ["direccion"]))[0] ?? null;

  const { data: caso, error } = await supabase
    .from("casos")
    .insert({
      cliente_id: input.clienteId,
      equipo_id: input.equipoId || null,
      sucursal_id: input.sucursalId || null,
      responsable_id: responsable,
      abierto_por: user?.id ?? null,
      prioridad,
      descripcion,
    })
    .select("id, numero")
    .single();
  if (error || !caso) return { error: error?.message ?? "No se pudo abrir el caso" };

  const nombre = (cli as { nombre_comercial?: string } | null)?.nombre_comercial ?? "cliente";
  await nota(supabase, { cliente_id: input.clienteId }, `Caso ${caso.numero} abierto (${labelPrioridad(prioridad)}): ${descripcion.slice(0, 160)}`, user?.id);
  await avisar(
    supabase,
    [responsable],
    {
      tipo: "caso_nuevo",
      titulo: `Caso ${caso.numero} · ${labelPrioridad(prioridad)} · ${nombre}: responder ${prioridad === "parado" ? "dentro de la hora" : "en 24 h hábiles"}`,
      url: "/casos",
    },
    user?.id
  );
  if (prioridad === "parado") {
    const servicio = await usuariosDePuesto(supabase, ["servicio", "admin"]);
    await avisar(supabase, servicio, { tipo: "caso_parado", titulo: `Equipo parado · ${nombre} (caso ${caso.numero})`, url: "/casos" }, user?.id);
  }
  revalidatePath("/", "layout");
  if (input.volverA) redirect(input.volverA);
  return { ok: true as const, id: caso.id as string };
}

/** Primera respuesta (o cualquier avance) del caso. */
export async function responderCaso(casoId: string, texto: string) {
  const contenido = texto.trim();
  if (!contenido) return { error: "Anotá qué le respondiste o qué se hizo" };
  const supabase = await createClient();
  const user = await usuarioActual();
  const c = await cargarCaso(supabase, casoId);
  if (!c) return { error: "No se encontró el caso" };
  if (!c.primera_respuesta_at) {
    const { error } = await supabase.from("casos").update({ primera_respuesta_at: new Date().toISOString() }).eq("id", casoId);
    if (error) return { error: error.message };
  }
  await nota(supabase, c, `Caso ${c.numero}: ${contenido}`, user?.id);
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/**
 * Excede lo que se resuelve a distancia: se deriva a servicio técnico. Crea
 * el trabajo técnico con la prioridad del caso (parado = urgente) y avisa a
 * quien asigna técnico o aliado.
 */
export async function derivarCaso(casoId: string, detalle?: string) {
  const supabase = await createClient();
  const user = await usuarioActual();
  const c = await cargarCaso(supabase, casoId);
  if (!c) return { error: "No se encontró el caso" };
  if (c.estado !== "abierto") return { error: "El caso ya fue derivado o cerrado" };
  let tipo = "correctivo";
  if (c.equipo_id) {
    const { data: eq } = await supabase.from("equipos").select("garantia_hasta").eq("id", c.equipo_id).maybeSingle();
    if (eq?.garantia_hasta && eq.garantia_hasta >= hoyISO()) tipo = "garantia";
  }
  const { data: ot, error } = await supabase
    .from("ordenes_trabajo")
    .insert({
      cliente_id: c.cliente_id,
      sucursal_id: c.sucursal_id,
      equipo_id: c.equipo_id,
      caso_id: c.id,
      creado_por: user?.id ?? null,
      estado: "solicitud_recibida",
      tipo,
      prioridad: prioridadOT(c.prioridad),
      cobertura: tipo === "garantia" ? "garantia" : "facturable",
      fecha_solicitada: hoyISO(),
      problema: `${c.descripcion}${detalle?.trim() ? `\n\nDesde el caso ${c.numero}: ${detalle.trim()}` : ""}`,
    })
    .select("id, numero")
    .single();
  if (error || !ot) return { error: error?.message ?? "No se pudo crear el trabajo técnico" };
  const ahora = new Date().toISOString();
  const { error: errC } = await supabase
    .from("casos")
    .update({ estado: "derivado", derivado_at: ahora, ot_id: ot.id, primera_respuesta_at: c.primera_respuesta_at ?? ahora })
    .eq("id", casoId);
  if (errC) return { error: errC.message };
  await nota(supabase, c, `Caso ${c.numero} derivado a servicio técnico (service ${ot.numero}${tipo === "garantia" ? ", en garantía" : ""})`, user?.id);
  const servicio = await usuariosDePuesto(supabase, ["servicio", "admin"]);
  await avisar(
    supabase,
    servicio,
    {
      tipo: "caso_derivado",
      titulo: `Service ${ot.numero} para asignar (${labelPrioridad(c.prioridad)}) · ${c.cliente?.nombre_comercial ?? "cliente"}`,
      url: `/servicio/${ot.id}`,
    },
    user?.id
  );
  revalidatePath("/", "layout");
  return { ok: true as const, otId: ot.id as string };
}

/** Cierre con causa y solución (manual: dentro de 5 días hábiles). */
export async function cerrarCaso(casoId: string, input: { causa: string; solucion: string }) {
  const causa = input.causa.trim();
  const solucion = input.solucion.trim();
  if (!causa || !solucion) return { error: "Para cerrar hace falta la causa y la solución" };
  const supabase = await createClient();
  const user = await usuarioActual();
  const c = await cargarCaso(supabase, casoId);
  if (!c) return { error: "No se encontró el caso" };
  const ahora = new Date().toISOString();
  const { error } = await supabase
    .from("casos")
    .update({ estado: "cerrado", cerrado_at: ahora, causa, solucion, primera_respuesta_at: c.primera_respuesta_at ?? ahora })
    .eq("id", casoId);
  if (error) return { error: error.message };
  await nota(supabase, c, `Caso ${c.numero} cerrado · causa: ${causa} · solución: ${solucion}`, user?.id);
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** Equipos de un cliente (para elegir de qué equipo es el caso). */
export async function equiposDeCliente(clienteId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("equipos")
    .select("id, numero_serie, marca_modelo_libre, producto:productos(nombre)")
    .eq("cliente_id", clienteId)
    .is("deleted_at", null)
    .limit(50);
  return ((data ?? []) as unknown as { id: string; numero_serie: string | null; marca_modelo_libre: string | null; producto: { nombre: string } | null }[]).map(
    (e) => ({
      id: e.id,
      nombre: [e.producto?.nombre ?? e.marca_modelo_libre ?? "Equipo", e.numero_serie ? `serie ${e.numero_serie}` : null].filter(Boolean).join(" · "),
    })
  );
}
