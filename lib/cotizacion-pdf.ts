/**
 * Cotización en PDF (v1.8): número de comprobante, totales con IVA, días en
 * letras, leyenda del dólar y nombre del archivo. Funciones puras.
 *
 * El total guardado de cada versión es el neto (sin IVA), como siempre; el
 * IVA (iva_pct) se suma en el PDF. 0 o vacío = no se discrimina IVA.
 */

/** Datos del membrete y de la cotización (config), editables en Administración → Marca. */
export const CAMPOS_COTIZACION = [
  { clave: "empresa_razon_social", label: "Razón social" },
  { clave: "empresa_condicion_iva", label: "Condición frente al IVA" },
  { clave: "empresa_cuit", label: "C.U.I.T." },
  { clave: "empresa_iibb", label: "Ingresos Brutos" },
  { clave: "empresa_inicio_actividades", label: "Inicio de actividades" },
  { clave: "empresa_telefono", label: "Teléfono" },
  { clave: "empresa_email", label: "E-mail" },
  { clave: "empresa_direccion", label: "Dirección" },
  { clave: "empresa_localidad", label: "Localidad" },
  { clave: "cotizacion_punto_venta", label: "Punto de venta" },
  { clave: "cotizacion_leyenda_usd", label: "Nota de las cotizaciones en dólares" },
] as const;
export type ClaveCotizacion = (typeof CAMPOS_COTIZACION)[number]["clave"];

export const OPCIONES_IVA = [
  { value: 10.5, label: "IVA 10,5%" },
  { value: 21, label: "IVA 21%" },
  { value: 0, label: "Sin discriminar IVA" },
] as const;

/** "0007 - 00000315": punto de venta (4) y número (8). */
export function numeroComprobante(puntoVenta: string | null | undefined, numero: number | null | undefined): string {
  const pv = (puntoVenta ?? "").replace(/\D/g, "").padStart(4, "0").slice(-4);
  return `${pv} - ${String(numero ?? 0).padStart(8, "0")}`;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export type TotalesCotizacion = {
  subtotal: number;
  descuentoPct: number;
  descuento: number;
  neto: number;
  ivaPct: number;
  iva: number;
  total: number;
};

/**
 * Subtotal de las líneas, descuento especial, neto gravado, IVA y total.
 * Sin líneas (cotización con monto a mano) el neto es el total guardado.
 */
export function calcularTotales(
  items: { cantidad: number; precio_unit: number }[],
  version: { total: number | null; subtotal?: number | null; descuento_pct?: number | null; iva_pct?: number | null }
): TotalesCotizacion {
  const descuentoPct = Number(version.descuento_pct ?? 0) || 0;
  const subtotal = items.length
    ? r2(items.reduce((s, i) => s + Number(i.cantidad) * Number(i.precio_unit), 0))
    : r2(Number(version.subtotal ?? version.total ?? 0));
  const neto = version.total != null ? r2(Number(version.total)) : r2(subtotal * (1 - descuentoPct / 100));
  const descuento = descuentoPct ? r2(Math.max(0, subtotal - neto)) : 0;
  const ivaPct = Number(version.iva_pct ?? 0) || 0;
  const iva = r2((neto * ivaPct) / 100);
  return { subtotal, descuentoPct, descuento, neto, ivaPct, iva, total: r2(neto + iva) };
}

/** Importe con dos decimales: "US$ 12.927,39" / "$ 1.405,00". */
export function montoPdf(n: number, moneda: string, conEspacio = true): string {
  const cifra = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  return `${moneda === "USD" ? "US$" : "$"}${conEspacio ? " " : ""}${cifra}`;
}

/** Porcentaje a la argentina: 10.5 → "10,5". */
export const porcentaje = (n: number) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n);

const UNIDADES = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve"];
const DECENAS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const CENTENAS = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];

/** Número en letras (0 a 999), para "7 (siete) días". */
export function enLetras(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 999) return String(n);
  if (n < 30) return UNIDADES[n];
  if (n < 100) return DECENAS[Math.floor(n / 10)] + (n % 10 ? ` y ${UNIDADES[n % 10]}` : "");
  if (n === 100) return "cien";
  return CENTENAS[Math.floor(n / 100)] + (n % 100 ? ` ${enLetras(n % 100)}` : "");
}

/** "7 (siete) días" / "1 (un) día". */
export function diasEnLetras(dias: number): string {
  const letras = enLetras(dias).replace(/veintiuno$/, "veintiún").replace(/uno$/, "un");
  return `${dias} (${letras}) ${dias === 1 ? "día" : "días"}`;
}

/** La leyenda del dólar con el total (IVA incluido) en lugar de {total}. */
export function leyendaDolar(plantilla: string | null | undefined, total: number): string {
  return (plantilla ?? "").replace(/\{total\}/g, montoPdf(total, "USD", false)).trim();
}

/** "COT 0007-00000315 NOMBRE DEL CLIENTE.pdf" (sin caracteres que rompan el nombre). */
export function nombreArchivo(numero: string, cliente: string | null | undefined, version: number): string {
  const limpio = (cliente ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w .-]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 60)
    .replace(/[. ]+$/, "")
    .trim();
  return `COT ${numero.replace(/\s/g, "")}${version > 1 ? ` v${version}` : ""}${limpio ? ` ${limpio}` : ""}.pdf`;
}

/** Tipo de ficha que se puede anexar al PDF (por la extensión del archivo). */
export function tipoAnexo(path: string): "pdf" | "png" | "jpg" | null {
  const ext = path.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf") return "pdf";
  if (ext === "png") return "png";
  if (ext === "jpg" || ext === "jpeg") return "jpg";
  return null;
}
