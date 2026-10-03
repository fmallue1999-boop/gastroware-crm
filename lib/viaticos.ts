/**
 * Viáticos (v1.25): categorías, medios de pago, estados y cuentas.
 * Funciones puras.
 */

export const CATEGORIAS_GASTO = [
  { value: "combustible", label: "Combustible" },
  { value: "peaje", label: "Peaje" },
  { value: "estacionamiento", label: "Estacionamiento" },
  { value: "comida", label: "Comida" },
  { value: "hotel", label: "Hotel" },
  { value: "pasajes", label: "Pasajes" },
  { value: "taxi", label: "Taxi / remís" },
  { value: "otros", label: "Otros" },
] as const;
export type CategoriaGasto = (typeof CATEGORIAS_GASTO)[number]["value"];

export const MEDIOS_PAGO_GASTO = [
  { value: "propio", label: "Lo pagué yo", detalle: "Se te devuelve" },
  { value: "tarjeta_empresa", label: "Tarjeta de la empresa", detalle: "No se devuelve" },
  { value: "adelanto", label: "Con un adelanto", detalle: "No se devuelve" },
] as const;
export type MedioPagoGasto = (typeof MEDIOS_PAGO_GASTO)[number]["value"];

export const TIPOS_COMPROBANTE = ["Factura A", "Factura B", "Factura C", "Ticket", "Ticket factura", "Recibo", "Otro"] as const;

export type EstadoRendicion = "enviada" | "aprobada" | "cerrada" | "reintegrada";
export const ESTADOS_RENDICION: Record<EstadoRendicion, { label: string; clase: string; detalle: string }> = {
  enviada: { label: "Para aprobar", clase: "bg-violeta-soft text-violeta", detalle: "Dirección aprueba o rechaza cada gasto." },
  aprobada: { label: "Para reintegrar", clase: "bg-ambar-soft text-ambar", detalle: "Revisada: administración devuelve lo aprobado." },
  reintegrada: { label: "Reintegrada", clase: "bg-verde-soft text-verde", detalle: "Se devolvió lo aprobado." },
  cerrada: { label: "Cerrada", clase: "bg-crema-deep text-piedra", detalle: "Revisada: no había nada para devolver." },
};
export const estadoRendicion = (e: string | null | undefined): EstadoRendicion => (e && e in ESTADOS_RENDICION ? (e as EstadoRendicion) : "enviada");

export const nombreCategoria = (c: string) => CATEGORIAS_GASTO.find((x) => x.value === c)?.label ?? c;
export const nombreMedio = (m: string) => MEDIOS_PAGO_GASTO.find((x) => x.value === m)?.label ?? m;
export const esCategoria = (c: string): c is CategoriaGasto => CATEGORIAS_GASTO.some((x) => x.value === c);
export const esMedio = (m: string): m is MedioPagoGasto => MEDIOS_PAGO_GASTO.some((x) => x.value === m);

type GastoCuenta = { importe: number | string; moneda: string; medio_pago: string; decision?: string | null };

/** Total por moneda: { ARS: 12000, USD: 30 }. */
export function totalPorMoneda(gastos: GastoCuenta[]): Record<string, number> {
  const t: Record<string, number> = {};
  for (const g of gastos) t[g.moneda] = redondear((t[g.moneda] ?? 0) + Number(g.importe));
  return t;
}

/** Lo que se le devuelve a quien rindió: lo aprobado que pagó con su plata. */
export function aReintegrar(gastos: GastoCuenta[]): Record<string, number> {
  return totalPorMoneda(gastos.filter((g) => g.decision === "aprobado" && g.medio_pago === "propio"));
}

/** "$ 12.000 + USD 30" (o "$ 0" si no hay nada). */
export function textoTotales(t: Record<string, number>): string {
  const partes = Object.entries(t)
    .filter(([, v]) => v > 0)
    .sort(([a], [b]) => (a === "ARS" ? -1 : b === "ARS" ? 1 : a.localeCompare(b)))
    .map(([m, v]) => `${m === "USD" ? "USD " : "$ "}${v.toLocaleString("es-AR", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 })}`);
  return partes.length ? partes.join(" + ") : "$ 0";
}

export const hayAlgo = (t: Record<string, number>) => Object.values(t).some((v) => v > 0);

const redondear = (n: number) => Math.round(n * 100) / 100;

/**
 * Un importe escrito como sea ("$ 12.345,67", "12345.67", "12,345.67",
 * "1.500") → número; null si no se entiende o no es positivo.
 */
export function leerImporte(texto: string | number | null | undefined): number | null {
  if (typeof texto === "number") return Number.isFinite(texto) && texto > 0 ? redondear(texto) : null;
  if (!texto) return null;
  let s = String(texto).replace(/[^\d.,-]/g, "");
  if (!s || s.startsWith("-")) return null;
  const coma = s.lastIndexOf(",");
  const punto = s.lastIndexOf(".");
  if (coma >= 0 && punto >= 0) {
    // El último separador es el de los decimales
    s = coma > punto ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (coma >= 0) {
    // Solo comas: decimal si tiene 1 o 2 dígitos después ("12,5"), si no miles ("12,345")
    s = /,\d{1,2}$/.test(s) && (s.match(/,/g) ?? []).length === 1 ? s.replace(",", ".") : s.replace(/,/g, "");
  } else if (punto >= 0) {
    // Solo puntos: miles si hay varios o 3 dígitos después ("1.500"), si no decimal ("12.50")
    s = (s.match(/\./g) ?? []).length > 1 || /\.\d{3}$/.test(s) ? s.replace(/\./g, "") : s;
  }
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? redondear(n) : null;
}

/** Una fecha YYYY-MM-DD válida y no futura (con un día de margen), o null. */
export function leerFecha(texto: string | null | undefined, hoy: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((texto ?? "").trim());
  if (!m) return null;
  const d = new Date(`${m[0]}T12:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== m[0]) return null;
  const manana = new Date(`${hoy}T12:00:00Z`);
  manana.setUTCDate(manana.getUTCDate() + 1);
  return d <= manana && Number(m[1]) >= 2000 ? m[0] : null;
}

/** CUIT con guiones (20-12345678-3) si tiene 11 dígitos; si no, como vino. */
export function cuitConGuiones(texto: string | null | undefined): string | null {
  const t = (texto ?? "").trim();
  if (!t) return null;
  const d = t.replace(/\D/g, "");
  return d.length === 11 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}` : t;
}

/** Primer y último día del mes "YYYY-MM". */
export function rangoMes(mes: string): { desde: string; hasta: string } {
  const [a, m] = mes.split("-").map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return { desde: `${mes}-01`, hasta: `${mes}-${String(ultimo).padStart(2, "0")}` };
}

/** "octubre 2026". */
export function nombreMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, 15)).toLocaleDateString("es-AR", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** El mes anterior y el siguiente de "YYYY-MM". */
export function mesVecino(mes: string, delta: number): string {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Totales del mes por persona y categoría (para el resumen). */
export function resumenPorPersona<T extends GastoCuenta & { usuario_id: string; categoria: string }>(
  gastos: T[]
): { usuarioId: string; total: Record<string, number>; porCategoria: Record<string, Record<string, number>> }[] {
  const por = new Map<string, T[]>();
  for (const g of gastos) por.set(g.usuario_id, [...(por.get(g.usuario_id) ?? []), g]);
  return [...por.entries()].map(([usuarioId, lista]) => {
    const porCategoria: Record<string, Record<string, number>> = {};
    for (const c of new Set(lista.map((g) => g.categoria))) porCategoria[c] = totalPorMoneda(lista.filter((g) => g.categoria === c));
    return { usuarioId, total: totalPorMoneda(lista), porCategoria };
  });
}
