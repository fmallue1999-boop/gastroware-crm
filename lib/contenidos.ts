/**
 * Calendario de contenidos (v1.10): cuentas, tipos, estados, sus colores
 * (en un solo lugar) y las cuentas de fechas del calendario. Funciones puras.
 *
 * Cuenta y estado son dos sistemas de color independientes: la cuenta es el
 * borde/fondo del ítem; el estado, una pastilla con punto y texto.
 */

export type Cuenta = "gastroware" | "zumex" | "colaboracion";
export type TipoContenido = "historia" | "feed";
export type EstadoContenido = "pendiente" | "aprobado" | "reedicion" | "cancelado";

export const CUENTAS: { value: Cuenta; label: string; borde: string; fondo: string; punto: string }[] = [
  { value: "gastroware", label: "GastroWare", borde: "border-l-cuenta-gastroware", fondo: "bg-cuenta-gastroware-soft", punto: "bg-cuenta-gastroware" },
  { value: "zumex", label: "ZUMEX", borde: "border-l-cuenta-zumex", fondo: "bg-cuenta-zumex-soft", punto: "bg-cuenta-zumex" },
  { value: "colaboracion", label: "Colaboración", borde: "border-l-cuenta-colaboracion", fondo: "bg-cuenta-colaboracion-soft", punto: "bg-cuenta-colaboracion" },
];

export const TIPOS: { value: TipoContenido; label: string; fila: string }[] = [
  { value: "historia", label: "Historia", fila: "HISTORIAS" },
  { value: "feed", label: "Feed", fila: "FEED" },
];

export const ESTADOS: { value: EstadoContenido; label: string; corto: string; pastilla: string; punto: string }[] = [
  { value: "pendiente", label: "Pendiente de aprobación", corto: "Pendiente", pastilla: "bg-estado-pendiente-soft text-estado-pendiente-texto", punto: "bg-estado-pendiente" },
  { value: "aprobado", label: "Aprobado", corto: "Aprobado", pastilla: "bg-estado-aprobado-soft text-estado-aprobado", punto: "bg-estado-aprobado" },
  { value: "reedicion", label: "Re-edición", corto: "Re-edición", pastilla: "bg-estado-reedicion-soft text-estado-reedicion", punto: "bg-estado-reedicion" },
  { value: "cancelado", label: "Cancelado", corto: "Cancelado", pastilla: "bg-estado-cancelado-soft text-estado-cancelado", punto: "bg-estado-cancelado" },
];

export const cuentaDe = (c: string) => CUENTAS.find((x) => x.value === c) ?? CUENTAS[0];
export const estadoDe = (e: string) => ESTADOS.find((x) => x.value === e) ?? ESTADOS[0];
export const tipoDe = (t: string) => TIPOS.find((x) => x.value === t) ?? TIPOS[0];

/** Filtro de cuenta: GastroWare y ZUMEX incluyen las colaboraciones. */
export const FILTROS_CUENTA = [
  { value: "todas", label: "Todas" },
  { value: "gastroware", label: "GastroWare + Colaboraciones" },
  { value: "zumex", label: "ZUMEX + Colaboraciones" },
] as const;
export type FiltroCuenta = (typeof FILTROS_CUENTA)[number]["value"];

export function cuentasDelFiltro(f: string | null | undefined): Cuenta[] | null {
  if (f === "gastroware") return ["gastroware", "colaboracion"];
  if (f === "zumex") return ["zumex", "colaboracion"];
  return null;
}

export const esEstado = (e: string | null | undefined): e is EstadoContenido => ESTADOS.some((x) => x.value === e);
export const esCuenta = (c: string | null | undefined): c is Cuenta => CUENTAS.some((x) => x.value === c);
export const esTipo = (t: string | null | undefined): t is TipoContenido => TIPOS.some((x) => x.value === t);

// ---------------------------------------------------------------------
// Fechas (todo como "AAAA-MM-DD", sin horas: no hay corrimientos)
// ---------------------------------------------------------------------
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
export const esFecha = (s: string | null | undefined): s is string => Boolean(s && FECHA.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)));

const aDate = (s: string) => new Date(`${s}T00:00:00Z`);
const aTexto = (d: Date) => d.toISOString().slice(0, 10);

export function sumarDiasA(fecha: string, dias: number): string {
  const d = aDate(fecha);
  d.setUTCDate(d.getUTCDate() + dias);
  return aTexto(d);
}

/** "15/10/2026" */
export const fechaDMY = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;

const DIAS_CORTOS = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export const diaSemanaCorto = (fecha: string) => DIAS_CORTOS[aDate(fecha).getUTCDay()];
export const nombreMes = (fecha: string) => `${MESES[Number(fecha.slice(5, 7)) - 1]} ${fecha.slice(0, 4)}`;

/** Lunes de la semana de esa fecha (la semana empieza el lunes). */
export function lunesDe(fecha: string): string {
  const dia = aDate(fecha).getUTCDay(); // 0 = domingo
  return sumarDiasA(fecha, dia === 0 ? -6 : 1 - dia);
}

export type Rango = { desde: string; hasta: string; dias: string[] };

/** Todos los días del mes de esa fecha. */
export function rangoMes(fecha: string): Rango {
  const desde = `${fecha.slice(0, 7)}-01`;
  const siguiente = aDate(desde);
  siguiente.setUTCMonth(siguiente.getUTCMonth() + 1);
  const hasta = sumarDiasA(aTexto(siguiente), -1);
  const dias: string[] = [];
  for (let d = desde; d <= hasta; d = sumarDiasA(d, 1)) dias.push(d);
  return { desde, hasta, dias };
}

/** Lunes a domingo de la semana de esa fecha. */
export function rangoSemana(fecha: string): Rango {
  const desde = lunesDe(fecha);
  const dias = Array.from({ length: 7 }, (_, i) => sumarDiasA(desde, i));
  return { desde, hasta: dias[6], dias };
}

/** Mes o semana anterior/siguiente. */
export function moverPeriodo(vista: "mes" | "semana", fecha: string, paso: 1 | -1): string {
  if (vista === "semana") return sumarDiasA(lunesDe(fecha), 7 * paso);
  const d = aDate(`${fecha.slice(0, 7)}-01`);
  d.setUTCMonth(d.getUTCMonth() + paso);
  return aTexto(d);
}

// ---------------------------------------------------------------------
// Orden
// ---------------------------------------------------------------------
const colador = new Intl.Collator("es", { numeric: true, sensitivity: "base" });

/** Orden natural por nombre de archivo: 02_x antes que 10_x. */
export const ordenNatural = <T extends { nombre: string }>(archivos: T[]): T[] => [...archivos].sort((a, b) => colador.compare(a.nombre, b.nombre));

const ORDEN_CUENTA: Record<string, number> = { gastroware: 0, zumex: 1, colaboracion: 2 };

/** Dentro de una celda: por cuenta, después por nombre y por fecha de carga (estable). */
export function ordenarEnCelda<T extends { cuenta: string; nombre: string; created_at: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) =>
      (ORDEN_CUENTA[a.cuenta] ?? 9) - (ORDEN_CUENTA[b.cuenta] ?? 9) ||
      colador.compare(a.nombre, b.nombre) ||
      a.created_at.localeCompare(b.created_at)
  );
}

export const esImagen = (mime: string | null | undefined) => (mime ?? "").startsWith("image/");
export const esVideo = (mime: string | null | undefined) => (mime ?? "").startsWith("video/");

/** Link del calendario/listado con los parámetros actuales cambiados (null borra). */
export function conParams(base: string, actuales: Record<string, string | null | undefined>, cambios: Record<string, string | null | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...actuales, ...cambios })) if (v != null && v !== "") p.set(k, v);
  const q = p.toString();
  return q ? `${base}?${q}` : base;
}
