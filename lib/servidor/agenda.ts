import { esEvento, estadoAgenda, masDias, type LinkAgenda } from "@/lib/agenda";
import type { SupabaseServidor } from "@/lib/actions/comun";

/**
 * Lectura de la agenda del equipo (migración 029) con la sesión del
 * usuario: RLS deja ver lo que uno creó, lo que tiene asignado y, a
 * dirección, todo.
 */

export type PersonaAgenda = { id: string; nombre: string; hecha_at: string | null };
export type ItemAgenda = {
  id: string;
  titulo: string;
  tipo: string;
  descripcion: string | null;
  fecha: string;
  hora: string | null;
  hora_fin: string | null;
  lugar: string | null;
  links: LinkAgenda[];
  monto: number | null;
  moneda: string;
  aviso_dias: number;
  serie_id: string | null;
  repite: string | null;
  creada_por: string;
  creador: string;
  personas: PersonaAgenda[];
  /** La tengo asignada yo. */
  mia: boolean;
  hechaYo: boolean;
  /** Puede cambiar fecha, título, etc. (quien la creó, dirección o la única persona que la tiene). */
  puedeEditar: boolean;
  /** Puede cambiar las personas y borrarla (quien la creó o dirección). */
  puedeGestionar: boolean;
};

const COLS =
  "id, titulo, tipo, descripcion, fecha, hora, hora_fin, lugar, links, monto, moneda, aviso_dias, serie_id, repite, creada_por, personas:agenda_personas(usuario_id, hecha_at)";

type Fila = Omit<ItemAgenda, "creador" | "personas" | "mia" | "hechaYo" | "puedeEditar" | "puedeGestionar" | "links"> & {
  links: LinkAgenda[] | null;
  personas: { usuario_id: string; hecha_at: string | null }[] | null;
};

export type Quien = { yo: string; gestor: boolean };

/** Nombres de los usuarios (para mostrar quiénes la tienen). */
export async function nombresUsuarios(supabase: SupabaseServidor): Promise<Map<string, string>> {
  const { data } = await supabase.from("usuarios").select("id, nombre");
  return new Map(((data ?? []) as { id: string; nombre: string }[]).map((u) => [u.id, u.nombre]));
}

function armar(f: Fila, q: Quien, nombres: Map<string, string>): ItemAgenda {
  const personas = (f.personas ?? [])
    .map((p) => ({ id: p.usuario_id, nombre: nombres.get(p.usuario_id) ?? "Alguien del equipo", hecha_at: p.hecha_at }))
    .sort((a, b) => (a.id === q.yo ? -1 : b.id === q.yo ? 1 : a.nombre.localeCompare(b.nombre)));
  const yo = personas.find((p) => p.id === q.yo);
  const gestiona = q.gestor || f.creada_por === q.yo;
  return {
    ...f,
    monto: f.monto == null ? null : Number(f.monto),
    links: f.links ?? [],
    creador: nombres.get(f.creada_por) ?? "Alguien del equipo",
    personas,
    mia: Boolean(yo),
    hechaYo: Boolean(yo?.hecha_at),
    puedeEditar: gestiona || (Boolean(yo) && personas.length === 1),
    puedeGestionar: gestiona,
  };
}

const ordenar = (a: ItemAgenda, b: ItemAgenda) =>
  a.fecha.localeCompare(b.fecha) || (a.hora ?? "").localeCompare(b.hora ?? "") || a.titulo.localeCompare(b.titulo);

export type Alcance = "mia" | "asigne" | "equipo";

/**
 * mia: lo que tengo asignado · asigne: lo que creé (para seguir lo que
 * delegué) · equipo: todo lo que puedo ver (dirección ve todo), con filtro
 * opcional por persona.
 */
export async function cargarAgenda(
  supabase: SupabaseServidor,
  q: Quien,
  opciones: { desde: string; hasta: string; alcance: Alcance; persona?: string | null; nombres?: Map<string, string> }
): Promise<ItemAgenda[]> {
  const nombres = opciones.nombres ?? (await nombresUsuarios(supabase));
  let filas: Fila[] = [];
  if (opciones.alcance === "mia") {
    const { data } = await supabase
      .from("agenda_personas")
      .select(`agenda:agenda!inner(${COLS})`)
      .eq("usuario_id", q.yo)
      .gte("agenda.fecha", opciones.desde)
      .lte("agenda.fecha", opciones.hasta)
      .limit(1000);
    filas = ((data ?? []) as unknown as { agenda: Fila }[]).map((d) => d.agenda);
  } else {
    let consulta = supabase.from("agenda").select(COLS).gte("fecha", opciones.desde).lte("fecha", opciones.hasta).limit(2000);
    if (opciones.alcance === "asigne") consulta = consulta.eq("creada_por", q.yo);
    const { data } = await consulta;
    filas = (data ?? []) as unknown as Fila[];
  }
  let items = filas.map((f) => armar(f, q, nombres));
  if (opciones.persona) items = items.filter((i) => i.personas.some((p) => p.id === opciones.persona));
  return items.sort(ordenar);
}

/** Tareas y pagos míos sin hacer de días anteriores (hasta 4 meses atrás). */
export async function atrasadasMias(
  supabase: SupabaseServidor,
  q: Quien,
  hoy: string,
  nombres?: Map<string, string>
): Promise<ItemAgenda[]> {
  const n = nombres ?? (await nombresUsuarios(supabase));
  const { data } = await supabase
    .from("agenda_personas")
    .select(`agenda:agenda!inner(${COLS})`)
    .eq("usuario_id", q.yo)
    .is("hecha_at", null)
    .lt("agenda.fecha", hoy)
    .gte("agenda.fecha", masDias(hoy, -120))
    .in("agenda.tipo", ["tarea", "pago", "otro"])
    .limit(200);
  return ((data ?? []) as unknown as { agenda: Fila }[]).map((d) => armar(d.agenda, q, n)).sort(ordenar);
}

/**
 * Para Mi día: lo atrasado, lo de hoy y lo que ya entró en sus días de
 * aviso (por ejemplo, un pago que vence en 3 días).
 */
export async function agendaDeMiDia(supabase: SupabaseServidor, q: Quien, hoy: string): Promise<ItemAgenda[]> {
  const nombres = await nombresUsuarios(supabase);
  const [atrasadas, proximas] = await Promise.all([
    atrasadasMias(supabase, q, hoy, nombres),
    cargarAgenda(supabase, q, { desde: hoy, hasta: masDias(hoy, 30), alcance: "mia", nombres }),
  ]);
  const deHoy = proximas.filter((i) => {
    if (i.fecha === hoy) return true;
    return estadoAgenda(i, hoy, i.hechaYo) === "aviso";
  });
  return [...atrasadas, ...deHoy];
}

/** Cuántas cosas de la agenda tengo para hoy (para el número de Mi día). */
export async function contarAgendaHoy(supabase: SupabaseServidor, yo: string, hoy: string): Promise<number> {
  const { data, error } = await supabase
    .from("agenda_personas")
    .select("agenda:agenda!inner(fecha, tipo)")
    .eq("usuario_id", yo)
    .is("hecha_at", null)
    .lte("agenda.fecha", hoy)
    .gte("agenda.fecha", masDias(hoy, -120))
    .limit(300);
  if (error) return 0;
  return ((data ?? []) as unknown as { agenda: { fecha: string; tipo: string } }[]).filter(
    (d) => d.agenda.fecha === hoy || !esEvento(d.agenda.tipo)
  ).length;
}

/** Una tarea con todo su detalle (null si no existe o no la puedo ver). */
export async function unaDeAgenda(supabase: SupabaseServidor, q: Quien, id: string): Promise<(ItemAgenda & { siguientes: number }) | null> {
  const { data } = await supabase.from("agenda").select(COLS).eq("id", id).maybeSingle();
  if (!data) return null;
  const fila = data as unknown as Fila;
  let siguientes = 0;
  if (fila.serie_id) {
    const { count } = await supabase
      .from("agenda")
      .select("id", { count: "exact", head: true })
      .eq("serie_id", fila.serie_id)
      .gt("fecha", fila.fecha);
    siguientes = count ?? 0;
  }
  return { ...armar(fila, q, await nombresUsuarios(supabase)), siguientes };
}
