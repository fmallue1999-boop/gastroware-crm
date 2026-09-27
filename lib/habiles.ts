/**
 * Plazos en días y horas hábiles (lunes a viernes; feriados no se cuentan
 * todavía). Los usan los plazos del manual: primera respuesta de un caso en
 * 24 h hábiles, cierre en 5 días hábiles, primer contacto de una consulta
 * dentro de la hora en horario laboral.
 */

const esHabil = (d: Date) => d.getUTCDay() !== 0 && d.getUTCDay() !== 6;

/** Suma n días hábiles a una fecha "YYYY-MM-DD". */
export function sumarHabiles(fecha: string, n: number): string {
  const d = new Date(fecha + "T12:00:00Z");
  let faltan = n;
  while (faltan > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (esHabil(d)) faltan--;
  }
  return d.toISOString().slice(0, 10);
}

/** Días hábiles entre dos fechas "YYYY-MM-DD" (desde excluida, hasta incluida). */
export function habilesEntre(desde: string, hasta: string): number {
  if (hasta <= desde) return 0;
  const d = new Date(desde + "T12:00:00Z");
  const fin = new Date(hasta + "T12:00:00Z");
  let n = 0;
  while (d < fin) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (esHabil(d)) n++;
  }
  return n;
}

/**
 * Vencimiento de "N horas hábiles" desde un momento: 24 h hábiles = el
 * próximo día hábil a la misma hora. Para N < 24 se suman horas corridas
 * (el primer contacto dentro de la hora se mide así).
 */
export function venceEnHorasHabiles(desdeIso: string, horas: number): Date {
  const d = new Date(desdeIso);
  if (horas < 24) return new Date(d.getTime() + horas * 3600000);
  let dias = Math.round(horas / 24);
  while (dias > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (esHabil(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12)))) dias--;
  }
  return d;
}

/** "hace 40 min" / "hace 3 h" / "hace 2 días" para tiempos transcurridos. */
export function transcurrido(desdeIso: string, ahora: number): string {
  const min = Math.max(0, Math.round((ahora - Date.parse(desdeIso)) / 60000));
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return `hace ${d} día${d === 1 ? "" : "s"}`;
}
