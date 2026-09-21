import { sumarDias } from "@/lib/format";

/** Lo mínimo que hace falta de un interés para saber si está pendiente. */
export type InteresPendiente = {
  id: string;
  etapa: string;
  temperatura: string | null;
  proximo_contacto: string | null;
  proximo_nota: string | null;
  ultimo_movimiento_at: string | null;
};

export type Bloques<T> = {
  /** proximo_contacto < hoy, el más atrasado primero */
  atrasados: T[];
  /** proximo_contacto = hoy, Muy interesado primero */
  hoy: T[];
  /** en lista de espera y llegó el stock */
  llegoStock: T[];
  /** entre mañana y hoy + 7, por fecha */
  proximos: T[];
  /** sin fecha y sin movimiento hace más de 7 días, el más viejo primero */
  sinFecha: T[];
};

export const NOTA_LLEGO_STOCK = "Llegó stock";
const ABIERTAS = new Set(["nueva", "cotizada", "seguimiento", "espera"]);
const ORDEN_NIVEL: Record<string, number> = { caliente: 0, tibio: 1, frio: 2 };

const porNivel = <T extends InteresPendiente>(a: T, b: T) =>
  (ORDEN_NIVEL[a.temperatura ?? ""] ?? 3) - (ORDEN_NIVEL[b.temperatura ?? ""] ?? 3);
const porFecha = <T extends InteresPendiente>(a: T, b: T) =>
  (a.proximo_contacto ?? "").localeCompare(b.proximo_contacto ?? "");
const porUltimo = <T extends InteresPendiente>(a: T, b: T) =>
  (a.ultimo_movimiento_at ?? "").localeCompare(b.ultimo_movimiento_at ?? "");

/**
 * Bloques de Pendientes del inicio (Etapa 1, 1.3), calculados a partir de
 * los intereses abiertos. Cada interés cae en un solo bloque: primero manda
 * "Llegó stock", después la fecha, y al final los que quedaron sin fecha.
 * Función pura: `hoy` viene de afuera (YYYY-MM-DD).
 */
export function clasificarPendientes<T extends InteresPendiente>(
  intereses: T[],
  hoy: string
): Bloques<T> {
  const b: Bloques<T> = { atrasados: [], hoy: [], llegoStock: [], proximos: [], sinFecha: [] };
  const limite = sumarDias(7, hoy);
  const corteSinFecha = sumarDias(-7, hoy);
  for (const i of intereses) {
    if (!ABIERTAS.has(i.etapa)) continue;
    if (i.etapa === "espera" && i.proximo_nota === NOTA_LLEGO_STOCK) {
      b.llegoStock.push(i);
      continue;
    }
    const p = i.proximo_contacto;
    if (p) {
      if (p < hoy) b.atrasados.push(i);
      else if (p === hoy) b.hoy.push(i);
      else if (p <= limite) b.proximos.push(i);
    } else if (!i.ultimo_movimiento_at || i.ultimo_movimiento_at.slice(0, 10) < corteSinFecha) {
      b.sinFecha.push(i);
    }
  }
  b.atrasados.sort(porFecha);
  b.hoy.sort(porNivel);
  b.llegoStock.sort(porNivel);
  b.proximos.sort(porFecha);
  b.sinFecha.sort(porUltimo);
  return b;
}
