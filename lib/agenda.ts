/**
 * Tareas y agenda del equipo (migración 029): tareas sueltas, reuniones,
 * capacitaciones y recordatorios de pago. Funciones puras (sin base) para
 * las pantallas, las acciones y los avisos.
 */

export type TipoAgenda = "tarea" | "reunion" | "capacitacion" | "pago" | "otro";
export type Repite = "semanal" | "quincenal" | "mensual";
export type LinkAgenda = { url: string; texto?: string | null };

export const TIPOS_AGENDA: { value: TipoAgenda; label: string; ejemplo: string }[] = [
  { value: "tarea", label: "Tarea", ejemplo: "Ej: Mandar las fotos del stand" },
  { value: "reunion", label: "Reunión", ejemplo: "Ej: Reunión de Marketing" },
  { value: "capacitacion", label: "Capacitación", ejemplo: "Ej: Capacitación Rational" },
  { value: "pago", label: "Pago", ejemplo: "Ej: Pagar el alquiler de la oficina" },
  { value: "otro", label: "Otro", ejemplo: "Ej: Renovar el seguro del auto" },
];

export const nombreTipo = (t: string) => TIPOS_AGENDA.find((x) => x.value === t)?.label ?? "Tarea";

/** Reuniones y capacitaciones son eventos: pasan solas, no quedan "atrasadas". */
export const esEvento = (t: string) => t === "reunion" || t === "capacitacion";

/** Cómo se llama marcarla: "Hecha" o "Pagado". */
export const textoHecha = (t: string) => (t === "pago" ? "Pagado" : "Hecha");

export const REPETICIONES: { value: Repite | ""; label: string }[] = [
  { value: "", label: "No se repite" },
  { value: "semanal", label: "Cada semana" },
  { value: "quincenal", label: "Cada 2 semanas" },
  { value: "mensual", label: "Cada mes" },
];

export const AVISOS: { value: number; label: string }[] = [
  { value: 0, label: "El mismo día" },
  { value: 1, label: "1 día antes" },
  { value: 3, label: "3 días antes" },
  { value: 7, label: "1 semana antes" },
];

/** Aviso por defecto según el tipo: los pagos avisan 3 días antes. */
export const avisoPorDefecto = (t: string) => (t === "pago" ? 3 : 0);

/** Máximo de fechas que se crean de una vez al repetir. */
export const MAX_REPETICIONES = 60;

// ---------------------------------------------------------------------------
// Fechas (YYYY-MM-DD, sin zona: se opera en UTC a mediodía)
// ---------------------------------------------------------------------------
const aFecha = (iso: string) => new Date(iso + "T12:00:00Z");
const aISO = (d: Date) => d.toISOString().slice(0, 10);

export function masDias(iso: string, dias: number): string {
  const d = aFecha(iso);
  d.setUTCDate(d.getUTCDate() + dias);
  return aISO(d);
}

export function diasEntre(desde: string, hasta: string): number {
  return Math.round((aFecha(hasta).getTime() - aFecha(desde).getTime()) / 86_400_000);
}

/** Mismo día del mes, n meses después (31 → último día si el mes es más corto). */
export function masMeses(iso: string, meses: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const total = m - 1 + meses;
  const anio = y + Math.floor(total / 12);
  const mes = ((total % 12) + 12) % 12;
  const ultimo = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  return aISO(new Date(Date.UTC(anio, mes, Math.min(d, ultimo), 12)));
}

/** Fechas de una serie desde "fecha" hasta "hasta" (incluidas), con tope. */
export function fechasSerie(fecha: string, repite: Repite | "" | null | undefined, hasta?: string | null): string[] {
  if (!repite || !hasta || hasta <= fecha) return [fecha];
  const fechas: string[] = [];
  for (let i = 0; i < MAX_REPETICIONES; i++) {
    const f = repite === "mensual" ? masMeses(fecha, i) : masDias(fecha, i * (repite === "semanal" ? 7 : 14));
    if (f > hasta) break;
    fechas.push(f);
  }
  return fechas;
}

/** "Hasta" sugerido al elegir repetir: 3 meses las semanales, 1 año las mensuales. */
export const hastaSugerido = (fecha: string, repite: Repite | "") =>
  repite === "mensual" ? masMeses(fecha, 11) : repite ? masMeses(fecha, 3) : "";

// ---------------------------------------------------------------------------
// Textos
// ---------------------------------------------------------------------------
/** "09:30:00" → "9:30". */
export function horaCorta(h: string | null | undefined): string {
  if (!h) return "";
  const [hh, mm] = h.split(":");
  return `${Number(hh)}:${mm}`;
}

export function horario(hora: string | null | undefined, horaFin: string | null | undefined): string {
  if (!hora) return "";
  return horaFin ? `${horaCorta(hora)} a ${horaCorta(horaFin)}` : horaCorta(hora);
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "lunes 29 de septiembre". */
export function diaLargo(iso: string): string {
  const d = aFecha(iso);
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;
}

export const nombreMes = (iso: string) => `${MESES[aFecha(iso).getUTCMonth()]} ${iso.slice(0, 4)}`;

/** "Hoy", "Mañana", "Ayer" o "lunes 29 de septiembre". */
export function cuando(iso: string, hoy: string): string {
  const d = diasEntre(hoy, iso);
  if (d === 0) return "Hoy";
  if (d === 1) return "Mañana";
  if (d === -1) return "Ayer";
  return diaLargo(iso);
}

/** Texto del aviso: "Hoy", "En 3 días", "Mañana". */
export function textoFaltan(fecha: string, hoy: string): string {
  const d = diasEntre(hoy, fecha);
  if (d <= 0) return "Hoy";
  if (d === 1) return "Mañana";
  return `En ${d} días`;
}

// ---------------------------------------------------------------------------
// Estado para una persona
// ---------------------------------------------------------------------------
export type EstadoAgenda = "hecha" | "atrasada" | "hoy" | "aviso" | "proxima" | "pasada";

/**
 * hecha · atrasada (tarea o pago sin hacer de un día anterior) · hoy ·
 * aviso (todavía no es el día pero ya entró en los días de aviso) ·
 * proxima · pasada (reunión o capacitación de un día anterior).
 */
export function estadoAgenda(
  item: { fecha: string; tipo: string; aviso_dias?: number | null },
  hoy: string,
  hecha: boolean
): EstadoAgenda {
  if (hecha) return "hecha";
  if (item.fecha < hoy) return esEvento(item.tipo) ? "pasada" : "atrasada";
  if (item.fecha === hoy) return "hoy";
  if (item.aviso_dias && diasEntre(hoy, item.fecha) <= item.aviso_dias) return "aviso";
  return "proxima";
}

/** ¿Hoy toca mandar el aviso? (el día de aviso anticipado o el día mismo). */
export const tocaAvisar = (item: { fecha: string; aviso_dias?: number | null }, hoy: string) =>
  item.fecha === hoy || (Boolean(item.aviso_dias) && masDias(item.fecha, -(item.aviso_dias ?? 0)) === hoy);

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------
/** Deja solo links http(s) válidos; agrega https:// si falta. */
export function limpiarLinks(links: LinkAgenda[] | null | undefined): LinkAgenda[] {
  const salida: LinkAgenda[] = [];
  for (const l of links ?? []) {
    let url = (l.url ?? "").trim();
    if (!url) continue;
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    try {
      const u = new URL(url);
      if (u.protocol !== "http:" && u.protocol !== "https:") continue;
      salida.push({ url: u.toString(), texto: l.texto?.trim().slice(0, 80) || null });
    } catch {
      // link inválido: se descarta
    }
  }
  return salida.slice(0, 10);
}

/** Si "lugar" es un link (Meet, Zoom), se muestra como link. */
export const esLink = (s: string | null | undefined) => Boolean(s && /^https?:\/\//i.test(s.trim()));

type ParaCalendario = {
  titulo: string;
  fecha: string;
  hora?: string | null;
  hora_fin?: string | null;
  descripcion?: string | null;
  lugar?: string | null;
  links?: LinkAgenda[] | null;
};

const compacta = (fecha: string, hora: string) => `${fecha.replaceAll("-", "")}T${hora.slice(0, 5).replace(":", "")}00`;

function finPorDefecto(hora: string): string {
  const [h, m] = hora.split(":").map(Number);
  const total = Math.min(h * 60 + m + 60, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function detalleCalendario(a: ParaCalendario): string {
  return [a.descripcion ?? "", ...(a.links ?? []).map((l) => (l.texto ? `${l.texto}: ${l.url}` : l.url))].filter(Boolean).join("\n");
}

/** Link para agregarla a Google Calendar (con la hora de Argentina). */
export function linkGoogleCalendar(a: ParaCalendario): string {
  const fechas = a.hora
    ? `${compacta(a.fecha, a.hora)}/${compacta(a.fecha, a.hora_fin ?? finPorDefecto(a.hora))}`
    : `${a.fecha.replaceAll("-", "")}/${masDias(a.fecha, 1).replaceAll("-", "")}`;
  const p = new URLSearchParams({ action: "TEMPLATE", text: a.titulo, dates: fechas, ctz: "America/Argentina/Buenos_Aires" });
  const detalle = detalleCalendario(a);
  if (detalle) p.set("details", detalle);
  if (a.lugar) p.set("location", a.lugar);
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

const escaparIcs = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");

/** Archivo .ics (iPhone, Outlook) con aviso del celular. */
export function icsDe(a: ParaCalendario & { id: string; aviso_dias?: number | null }): string {
  const lineas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//GastroWare OS//Agenda//ES",
    "BEGIN:VEVENT",
    `UID:${a.id}@gastroware-os`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
  ];
  if (a.hora) {
    lineas.push(`DTSTART;TZID=America/Argentina/Buenos_Aires:${compacta(a.fecha, a.hora)}`);
    lineas.push(`DTEND;TZID=America/Argentina/Buenos_Aires:${compacta(a.fecha, a.hora_fin ?? finPorDefecto(a.hora))}`);
  } else {
    lineas.push(`DTSTART;VALUE=DATE:${a.fecha.replaceAll("-", "")}`);
    lineas.push(`DTEND;VALUE=DATE:${masDias(a.fecha, 1).replaceAll("-", "")}`);
  }
  lineas.push(`SUMMARY:${escaparIcs(a.titulo)}`);
  const detalle = detalleCalendario(a);
  if (detalle) lineas.push(`DESCRIPTION:${escaparIcs(detalle)}`);
  if (a.lugar) lineas.push(`LOCATION:${escaparIcs(a.lugar)}`);
  // Aviso del celular: 15 min antes si tiene hora; si no, a las 9 del día de aviso
  const d = a.aviso_dias ?? 0;
  const trigger = a.hora ? "-PT15M" : d > 0 ? `-PT${d * 24 - 9}H` : "PT9H";
  lineas.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escaparIcs(a.titulo)}`, `TRIGGER:${trigger}`, "END:VALARM");
  lineas.push("END:VEVENT", "END:VCALENDAR");
  return lineas.join("\r\n");
}

// ---------------------------------------------------------------------------
// Calendario del mes
// ---------------------------------------------------------------------------
/** Semanas (lunes a domingo) que cubren el mes de "iso". */
export function semanasDelMes(iso: string): string[][] {
  const primero = `${iso.slice(0, 7)}-01`;
  const dow = (aFecha(primero).getUTCDay() + 6) % 7; // lunes = 0
  let dia = masDias(primero, -dow);
  const ultimo = masMeses(primero, 1);
  const semanas: string[][] = [];
  while (dia < ultimo) {
    const semana: string[] = [];
    for (let i = 0; i < 7; i++) {
      semana.push(dia);
      dia = masDias(dia, 1);
    }
    semanas.push(semana);
  }
  return semanas;
}
