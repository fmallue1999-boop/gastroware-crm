/**
 * Números de operación que pide el manual para el tablero de dirección:
 * primer contacto de las consultas, ventas por territorio, remitos hechos
 * contra facturados, casos y cobranza vencida.
 */

export type ConsultaAsignada = { asignado_at: string; primer_contacto_at: string | null };

/** Minutos hasta el primer contacto: mediana, % dentro de la hora y sin contacto. */
export function primerContacto(consultas: ConsultaAsignada[]) {
  const minutos = consultas
    .filter((c) => c.primer_contacto_at)
    .map((c) => Math.max(0, (Date.parse(c.primer_contacto_at!) - Date.parse(c.asignado_at)) / 60000))
    .sort((a, b) => a - b);
  const mediana = minutos.length
    ? minutos.length % 2
      ? minutos[(minutos.length - 1) / 2]
      : (minutos[minutos.length / 2 - 1] + minutos[minutos.length / 2]) / 2
    : null;
  const enLaHora = minutos.filter((m) => m <= 60).length;
  return {
    total: consultas.length,
    contactadas: minutos.length,
    sinContacto: consultas.length - minutos.length,
    medianaMin: mediana == null ? null : Math.round(mediana),
    pctEnLaHora: consultas.length ? Math.round((enLaHora / consultas.length) * 100) : null,
  };
}

/** "45 min", "3 h", "2 días". */
export function textoMinutos(min: number | null): string {
  if (min == null) return "—";
  if (min < 60) return `${min} min`;
  if (min < 60 * 24) return `${Math.round(min / 60)} h`;
  return `${Math.round(min / 1440)} días`;
}

/** Montos vendidos por territorio y moneda. */
export function ventasPorTerritorio(
  ventas: { territorio: string | null; monto_estimado: number | null; moneda: string }[],
  nombres: Record<string, string>
): { nombre: string; cantidad: number; montos: Record<string, number> }[] {
  const mapa = new Map<string, { nombre: string; cantidad: number; montos: Record<string, number> }>();
  for (const v of ventas) {
    const clave = v.territorio ?? "sin";
    const fila = mapa.get(clave) ?? { nombre: v.territorio ? nombres[v.territorio] ?? v.territorio : "Sin territorio", cantidad: 0, montos: {} };
    fila.cantidad++;
    if (v.monto_estimado != null) fila.montos[v.moneda || "ARS"] = (fila.montos[v.moneda || "ARS"] ?? 0) + Number(v.monto_estimado);
    mapa.set(clave, fila);
  }
  return [...mapa.values()].sort((a, b) => b.cantidad - a.cantidad);
}
