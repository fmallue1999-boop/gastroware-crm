/** Fecha local (Argentina) en formato YYYY-MM-DD. */
export function hoyISO(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

export function sumarMeses(meses: number, desde?: string): string {
  const base = desde ? new Date(desde + "T12:00:00") : new Date();
  base.setMonth(base.getMonth() + meses);
  return base.toLocaleDateString("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

export function sumarDias(dias: number, desde?: string): string {
  const base = desde ? new Date(desde + "T12:00:00") : new Date();
  base.setDate(base.getDate() + dias);
  return base.toLocaleDateString("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

export function fechaCorta(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? iso + "T12:00:00" : iso);
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

export function diasDesde(iso: string): number {
  const d = new Date(iso.length <= 10 ? iso + "T12:00:00" : iso);
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}

export function dinero(monto: number | null, moneda = "ARS"): string {
  if (monto == null) return "—";
  const simbolo = moneda === "USD" ? "USD " : "$";
  return (
    simbolo +
    new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(monto)
  );
}

/** Normaliza teléfono para deduplicar: solo dígitos, sin 0/15 iniciales de área. */
export function normalizarTelefono(tel: string): string {
  let d = tel.replace(/\D/g, "");
  if (d.startsWith("549")) d = d.slice(3);
  else if (d.startsWith("54")) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  return d;
}

// Códigos de área argentinos de 3 dígitos (los demás son de 2 u 4)
const AREAS_3 = new Set([
  "220", "221", "223", "230", "236", "237", "249", "260", "261", "263",
  "264", "266", "280", "291", "294", "297", "298", "299", "336", "341",
  "342", "343", "345", "348", "351", "353", "358", "362", "364", "370",
  "376", "379", "380", "381", "383", "385", "387", "388",
]);

/**
 * Deja un teléfono argentino entero y prolijo para mostrar/compartir:
 * "+54 9 2243 43-4282" → "2243 43-4282" · "011 15 5555-0199" → "11 5555-0199".
 * Si no parece un número argentino completo, devuelve los dígitos tal cual.
 */
export function telefonoProlijo(tel: string): string {
  let d = normalizarTelefono(tel);
  // "15" después del código de área (formato viejo del interior)
  if (d.length === 12 && d.startsWith("11") && d.slice(2, 4) === "15")
    d = d.slice(0, 2) + d.slice(4);
  if (d.length === 12 && d.slice(3, 5) === "15" && AREAS_3.has(d.slice(0, 3)))
    d = d.slice(0, 3) + d.slice(5);
  if (d.length === 12 && d.slice(4, 6) === "15")
    d = d.slice(0, 4) + d.slice(6);

  if (d.length !== 10) return d;
  if (d.startsWith("11")) return `11 ${d.slice(2, 6)}-${d.slice(6)}`;
  if (AREAS_3.has(d.slice(0, 3)))
    return `${d.slice(0, 3)} ${d.slice(3, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 4)} ${d.slice(4, 6)}-${d.slice(6)}`;
}

/** Link de WhatsApp con mensaje opcional. */
export function linkWhatsApp(tel: string, texto?: string): string {
  const num = "549" + normalizarTelefono(tel);
  const q = texto ? `?text=${encodeURIComponent(texto)}` : "";
  return `https://wa.me/${num}${q}`;
}

/** Reemplaza variables {nombre}, {producto}, {monto} en una plantilla. */
export function rellenarPlantilla(
  contenido: string,
  vars: Record<string, string>
): string {
  return contenido.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);
}
