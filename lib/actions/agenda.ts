"use server";

// Tareas y agenda del equipo (migración 029): tareas sueltas, reuniones,
// capacitaciones y pagos, asignados a una o varias personas, con avisos en
// la campana y en el celular.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hoyISO } from "@/lib/format";
import {
  diaLargo,
  diasEntre,
  fechasSerie,
  horario,
  limpiarLinks,
  masDias,
  nombreTipo,
  TIPOS_AGENDA,
  type LinkAgenda,
  type Repite,
  type TipoAgenda,
} from "@/lib/agenda";
import { avisar, usuarioActual } from "./comun";

export type EntradaAgenda = {
  titulo: string;
  tipo: TipoAgenda;
  descripcion?: string | null;
  fecha: string;
  hora?: string | null;
  horaFin?: string | null;
  lugar?: string | null;
  links?: LinkAgenda[];
  monto?: number | null;
  moneda?: "ARS" | "USD";
  avisoDias?: number;
  personas: string[];
  repite?: Repite | "";
  hasta?: string | null;
};

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^\d{2}:\d{2}(:\d{2})?$/;

function validar(e: EntradaAgenda): string | null {
  if (!e.titulo?.trim()) return "Poné un título";
  if (e.titulo.trim().length > 200) return "El título es muy largo";
  if (!TIPOS_AGENDA.some((t) => t.value === e.tipo)) return "Elegí el tipo";
  if (!FECHA.test(e.fecha ?? "")) return "Elegí la fecha";
  if (e.hora && !HORA.test(e.hora)) return "La hora no es válida";
  if (e.horaFin && !HORA.test(e.horaFin)) return "La hora de fin no es válida";
  if (e.horaFin && !e.hora) return "Poné la hora de inicio";
  if (e.hora && e.horaFin && e.horaFin <= e.hora) return "La hora de fin tiene que ser después del inicio";
  if (!e.personas?.length) return "Elegí al menos una persona";
  if (e.personas.length > 60) return "Demasiadas personas";
  if (e.monto != null && (!Number.isFinite(e.monto) || e.monto < 0)) return "El monto no es válido";
  if (e.avisoDias != null && (e.avisoDias < 0 || e.avisoDias > 30)) return "El aviso va de 0 a 30 días antes";
  if (e.repite && e.hasta && !FECHA.test(e.hasta)) return "Elegí hasta cuándo se repite";
  return null;
}

/** Columnas comunes de la tarea (sin fecha ni serie). */
function datos(e: EntradaAgenda) {
  const esPago = e.tipo === "pago";
  return {
    titulo: e.titulo.trim(),
    tipo: e.tipo,
    descripcion: e.descripcion?.trim() || null,
    hora: e.hora || null,
    hora_fin: e.hora ? e.horaFin || null : null,
    lugar: e.lugar?.trim() || null,
    links: limpiarLinks(e.links),
    monto: esPago && e.monto != null ? e.monto : null,
    moneda: e.moneda === "USD" ? "USD" : "ARS",
    aviso_dias: Math.round(e.avisoDias ?? 0),
  };
}

/** "martes 6 de octubre · 10:00 a 11:00". */
const cuandoTexto = (fecha: string, hora?: string | null, horaFin?: string | null) =>
  [diaLargo(fecha), horario(hora, horaFin)].filter(Boolean).join(" · ");

async function nombreDe(supabase: Awaited<ReturnType<typeof createClient>>, id: string | undefined) {
  if (!id) return "Alguien del equipo";
  const { data } = await supabase.from("usuarios").select("nombre").eq("id", id).maybeSingle();
  return (data?.nombre as string | undefined) ?? "Alguien del equipo";
}

export async function crearAgenda(e: EntradaAgenda) {
  const error = validar(e);
  if (error) return { error };
  const supabase = await createClient();
  const user = await usuarioActual();
  if (!user) return { error: "Sesión vencida: volvé a entrar" };

  const fechas = fechasSerie(e.fecha, e.repite, e.hasta);
  const serie = fechas.length > 1 ? crypto.randomUUID() : null;
  const base = datos(e);
  const { data: creadas, error: errA } = await supabase
    .from("agenda")
    .insert(fechas.map((fecha) => ({ ...base, fecha, serie_id: serie, repite: serie ? e.repite : null, creada_por: user.id })))
    .select("id, fecha");
  if (errA || !creadas?.length) return { error: errA?.message ?? "No se pudo guardar" };

  const personas = [...new Set(e.personas)];
  const { error: errP } = await supabase
    .from("agenda_personas")
    .insert(creadas.flatMap((a) => personas.map((usuario_id) => ({ agenda_id: a.id, usuario_id }))));
  if (errP) {
    await supabase.from("agenda").delete().in("id", creadas.map((a) => a.id));
    return { error: errP.message };
  }

  const primera = creadas.sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
  const quien = await nombreDe(supabase, user.id);
  const repite = serie ? ` · se repite (${creadas.length} fechas)` : "";
  await avisar(
    supabase,
    personas,
    {
      tipo: "agenda",
      titulo: `${quien} te asignó: ${base.titulo}`,
      cuerpo: `${nombreTipo(e.tipo)} · ${cuandoTexto(primera.fecha, base.hora, base.hora_fin)}${repite}`,
      url: `/tareas/${primera.id}`,
    },
    user.id
  );
  revalidatePath("/", "layout");
  return { ok: true as const, id: primera.id, cantidad: creadas.length };
}

type FilaActual = { id: string; titulo: string; fecha: string; hora: string | null; hora_fin: string | null; serie_id: string | null; creada_por: string };

/** Filas afectadas: solo esta, o esta y las siguientes de la serie. */
async function filasDe(supabase: Awaited<ReturnType<typeof createClient>>, id: string, alcance: "esta" | "siguientes") {
  const { data: actual } = await supabase
    .from("agenda")
    .select("id, titulo, fecha, hora, hora_fin, serie_id, creada_por")
    .eq("id", id)
    .maybeSingle();
  if (!actual) return null;
  const a = actual as FilaActual;
  if (alcance === "esta" || !a.serie_id) return { actual: a, filas: [a] };
  const { data } = await supabase
    .from("agenda")
    .select("id, titulo, fecha, hora, hora_fin, serie_id, creada_por")
    .eq("serie_id", a.serie_id)
    .gte("fecha", a.fecha)
    .order("fecha");
  return { actual: a, filas: ((data ?? []) as FilaActual[]).length ? (data as FilaActual[]) : [a] };
}

export async function editarAgenda(id: string, e: EntradaAgenda, alcance: "esta" | "siguientes" = "esta") {
  const error = validar(e);
  if (error) return { error };
  const supabase = await createClient();
  const user = await usuarioActual();
  if (!user) return { error: "Sesión vencida: volvé a entrar" };
  const r = await filasDe(supabase, id, alcance);
  if (!r) return { error: "No se encontró" };
  const { actual, filas } = r;
  const base = datos(e);
  const corrimiento = diasEntre(actual.fecha, e.fecha);

  // Datos (y fecha corrida los mismos días en todas las elegidas)
  const resultados = await Promise.all(
    filas.map((f) =>
      supabase
        .from("agenda")
        .update({ ...base, fecha: corrimiento ? masDias(f.fecha, corrimiento) : f.fecha })
        .eq("id", f.id)
        .select("id")
    )
  );
  const fallo = resultados.find((x) => x.error || !x.data?.length);
  if (fallo) return { error: fallo.error?.message ?? "Esta la cambia quien la creó o dirección" };

  // Personas: agregadas y quitadas respecto de esta fecha
  const { data: antes } = await supabase.from("agenda_personas").select("usuario_id").eq("agenda_id", id);
  const previas = new Set(((antes ?? []) as { usuario_id: string }[]).map((p) => p.usuario_id));
  const nuevas = new Set(e.personas);
  const agregadas = [...nuevas].filter((u) => !previas.has(u));
  const quitadas = [...previas].filter((u) => !nuevas.has(u));
  const ids = filas.map((f) => f.id);
  if (agregadas.length) {
    const { error: errI } = await supabase
      .from("agenda_personas")
      .upsert(ids.flatMap((agenda_id) => agregadas.map((usuario_id) => ({ agenda_id, usuario_id }))), { onConflict: "agenda_id,usuario_id", ignoreDuplicates: true });
    if (errI) return { error: "Las personas las cambia quien la creó o dirección" };
  }
  if (quitadas.length) {
    const { error: errD } = await supabase.from("agenda_personas").delete().in("agenda_id", ids).in("usuario_id", quitadas);
    if (errD) return { error: "Las personas las cambia quien la creó o dirección" };
  }

  // Avisos
  const quien = await nombreDe(supabase, user.id);
  const nuevaFecha = corrimiento ? masDias(actual.fecha, corrimiento) : actual.fecha;
  const cuando = cuandoTexto(nuevaFecha, base.hora, base.hora_fin);
  const url = `/tareas/${id}`;
  if (agregadas.length)
    await avisar(supabase, agregadas, { tipo: "agenda", titulo: `${quien} te asignó: ${base.titulo}`, cuerpo: `${nombreTipo(e.tipo)} · ${cuando}`, url }, user.id);
  const cambioHorario = corrimiento !== 0 || (actual.hora ?? "").slice(0, 5) !== (base.hora ?? "").slice(0, 5);
  const siguen = [...nuevas].filter((u) => previas.has(u));
  if (cambioHorario && siguen.length)
    await avisar(supabase, siguen, { tipo: "agenda", titulo: `Cambió: ${base.titulo}`, cuerpo: `Ahora: ${cuando}${filas.length > 1 ? ` (y las siguientes)` : ""}`, url }, user.id);
  if (quitadas.length)
    await avisar(supabase, quitadas, { tipo: "agenda", titulo: `Ya no estás en: ${base.titulo}`, cuerpo: cuando, url: "/tareas" }, user.id);

  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** Mover solo de día (desde Mi día o la lista). */
export async function moverAgenda(id: string, fecha: string) {
  if (!FECHA.test(fecha)) return { error: "Elegí la fecha" };
  const supabase = await createClient();
  const user = await usuarioActual();
  const { data: a } = await supabase.from("agenda").select("id, titulo, fecha, hora, hora_fin").eq("id", id).maybeSingle();
  if (!a) return { error: "No se encontró" };
  const { data, error } = await supabase.from("agenda").update({ fecha }).eq("id", id).select("id");
  if (error || !data?.length) return { error: "Esta la mueve quien la creó o dirección" };
  const { data: personas } = await supabase.from("agenda_personas").select("usuario_id").eq("agenda_id", id);
  await avisar(
    supabase,
    ((personas ?? []) as { usuario_id: string }[]).map((p) => p.usuario_id),
    { tipo: "agenda", titulo: `Cambió de día: ${a.titulo}`, cuerpo: `Ahora: ${cuandoTexto(fecha, a.hora as string | null, a.hora_fin as string | null)}`, url: `/tareas/${id}` },
    user?.id
  );
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function borrarAgenda(id: string, alcance: "esta" | "siguientes" = "esta") {
  const supabase = await createClient();
  const user = await usuarioActual();
  const r = await filasDe(supabase, id, alcance);
  if (!r) return { error: "No se encontró" };
  const ids = r.filas.map((f) => f.id);
  const { data: personas } = await supabase.from("agenda_personas").select("usuario_id").in("agenda_id", ids);
  const { data, error } = await supabase.from("agenda").delete().in("id", ids).select("id");
  if (error || !data?.length) return { error: "La borra quien la creó o dirección" };
  // Se avisa solo si todavía no pasó
  if (r.actual.fecha >= hoyISO())
    await avisar(
      supabase,
      ((personas ?? []) as { usuario_id: string }[]).map((p) => p.usuario_id),
      {
        tipo: "agenda",
        titulo: `Se canceló: ${r.actual.titulo}`,
        cuerpo: `${cuandoTexto(r.actual.fecha, r.actual.hora, r.actual.hora_fin)}${ids.length > 1 ? " (y las siguientes)" : ""}`,
        url: "/tareas",
      },
      user?.id
    );
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** Marcar la mía como hecha (o pagada) o volverla a pendiente. */
export async function marcarAgenda(id: string, hecha: boolean) {
  const supabase = await createClient();
  const user = await usuarioActual();
  if (!user) return { error: "Sesión vencida: volvé a entrar" };
  const { data, error } = await supabase
    .from("agenda_personas")
    .update({ hecha_at: hecha ? new Date().toISOString() : null })
    .eq("agenda_id", id)
    .eq("usuario_id", user.id)
    .select("agenda_id");
  if (error || !data?.length) return { error: error?.message ?? "No la tenés asignada" };
  if (hecha) {
    const { data: a } = await supabase.from("agenda").select("titulo, tipo, creada_por").eq("id", id).maybeSingle();
    if (a && a.creada_por !== user.id) {
      const quien = await nombreDe(supabase, user.id);
      await avisar(
        supabase,
        [a.creada_por as string],
        { tipo: "agenda", titulo: `${quien} ${a.tipo === "pago" ? "marcó pagado" : "terminó"}: ${a.titulo}`, url: `/tareas/${id}` },
        user.id
      );
    }
  }
  revalidatePath("/", "layout");
  return { ok: true as const };
}
