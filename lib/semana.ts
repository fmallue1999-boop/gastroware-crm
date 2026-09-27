/**
 * Semanas del informe comercial (manual 4.5): cada lunes antes de las 10 el
 * vendedor manda el informe de la semana anterior (lunes a domingo).
 */

/** Lunes (YYYY-MM-DD) de la semana de una fecha. */
export function lunesDe(fecha: string): string {
  const d = new Date(fecha + "T12:00:00Z");
  const dia = d.getUTCDay(); // 0 domingo
  d.setUTCDate(d.getUTCDate() - ((dia + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/** Semana que se informa el lunes `semana`: del lunes anterior al domingo anterior. */
export function periodoInforme(semana: string): { desde: string; hasta: string } {
  const d = new Date(semana + "T12:00:00Z");
  const desde = new Date(d);
  desde.setUTCDate(d.getUTCDate() - 7);
  const hasta = new Date(d);
  hasta.setUTCDate(d.getUTCDate() - 1);
  return { desde: desde.toISOString().slice(0, 10), hasta: hasta.toISOString().slice(0, 10) };
}

export type NumerosInforme = {
  consultasNuevas: number;
  sinPrimerContacto: number;
  cotizaciones: number;
  ventas: number;
  montoVentas: Record<string, number>;
  movimientos: number;
  abiertosPorEtapa: Record<string, number>;
  casosAbiertos: number;
  casosCerrados: number;
  perdidas: number;
};
