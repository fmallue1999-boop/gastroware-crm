/** Fecha local (Argentina) en formato YYYY-MM-DD. */
export function hoyISO(): string {
  return new Date().toLocaleDateString("en-CA", {
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
  return Math.floor((Date.now() - d.getTime()) / 86400000);
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
