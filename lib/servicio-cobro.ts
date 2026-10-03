/**
 * Cobro de una orden de servicio (v1.27): cuántas horas se cobran, cuánto
 * da y con qué concepto se factura. Funciones puras (las usan la orden, el
 * informe de service y la facturación).
 */

export const COBRO_COMO = [
  { value: "mano_de_obra", label: "Mano de obra" },
  { value: "movilidad", label: "Movilidad" },
  { value: "visita", label: "Visita técnica" },
  { value: "diagnostico", label: "Diagnóstico" },
] as const;
export type CobroComo = (typeof COBRO_COMO)[number]["value"];
export const esCobroComo = (v: string | null | undefined): v is CobroComo => COBRO_COMO.some((c) => c.value === v);
export const nombreCobro = (v: string | null | undefined) => COBRO_COMO.find((c) => c.value === v)?.label ?? "Mano de obra";

type OTCobro = { cobertura: string; horas_cobrar?: number | string | null; cobro_como?: string | null; sin_cargo?: boolean | null };

/** v1.28: por qué dirección autoriza no cobrar una orden. */
export const MOTIVOS_SIN_CARGO = [
  "Cortesía al cliente",
  "Error nuestro o del técnico",
  "Ya se cobró aparte",
  "Garantía sin cargo",
  "Otro",
] as const;

/** v1.28: por qué dirección da de baja una orden. */
export const MOTIVOS_BAJA = [
  "Duplicada o cargada por error",
  "El cliente ya no la quiere",
  "Se resolvió sin ir",
  "No corresponde a nosotros",
  "Otro",
] as const;

/** "Cortesía al cliente: cliente de años" (el detalle es opcional salvo en "Otro"). */
export function motivoCompleto(motivo: string, detalle?: string | null): string | null {
  const m = motivo.trim();
  const d = (detalle ?? "").trim();
  if (!m) return null;
  if (m === "Otro") return d ? d.slice(0, 300) : null;
  return d ? `${m}: ${d}`.slice(0, 300) : m;
}
type ItemCobro = { cantidad: number | string; precio_unit: number | string; estado: string; aprobado_admin: boolean };

const redondear = (n: number) => Math.round(n * 100) / 100;

/**
 * Las horas que se cobran: las que se pusieron a mano; si no, las
 * trabajadas cuando es facturable, y ninguna en garantía o contrato.
 */
export function horasACobrar(ot: OTCobro, minutosTrabajados: number): number {
  if (ot.horas_cobrar !== null && ot.horas_cobrar !== undefined && ot.horas_cobrar !== "") return Math.max(0, Number(ot.horas_cobrar) || 0);
  return ot.cobertura === "facturable" ? redondear(minutosTrabajados / 60) : 0;
}

/** La cuenta de la orden: horas × tarifa + repuestos y gastos facturables aprobados. */
export function cuentaOT(ot: OTCobro, minutosTrabajados: number, tarifa: number, items: ItemCobro[]) {
  const horasTrabajadas = redondear(minutosTrabajados / 60);
  const horas = horasACobrar(ot, minutosTrabajados);
  const manoObra = redondear(horas * tarifa);
  const itemsTotal = redondear(
    items.filter((i) => i.estado === "facturable" && i.aprobado_admin).reduce((s, i) => s + Number(i.cantidad) * Number(i.precio_unit), 0)
  );
  const bruto = redondear(manoObra + itemsTotal);
  // Sin cargo (autorizado por dirección): se ve lo que salía y el total queda en $0
  const bonificado = ot.sin_cargo ? bruto : 0;
  return { horasTrabajadas, horas, manual: ot.horas_cobrar !== null && ot.horas_cobrar !== undefined, manoObra, itemsTotal, bonificado, total: redondear(bruto - bonificado) };
}

const TIPO_TRABAJO: Record<string, string> = {
  correctivo: "Reparación",
  preventivo: "Mantenimiento",
  instalacion: "Instalación",
  garantia: "Reparación",
};

// "Se cambió la luz" → "Cambio de luz": como se escribe un renglón de factura
const VERBO_A_NOMBRE: Record<string, string> = {
  cambio: "Cambio de",
  cambie: "Cambio de",
  reemplazo: "Reemplazo de",
  reemplace: "Reemplazo de",
  limpio: "Limpieza de",
  limpie: "Limpieza de",
  instalo: "Instalación de",
  instale: "Instalación de",
  reparo: "Reparación de",
  repare: "Reparación de",
  ajusto: "Ajuste de",
  ajuste: "Ajuste de",
  reviso: "Revisión de",
  revise: "Revisión de",
  calibro: "Calibración de",
  calibre: "Calibración de",
  coloco: "Colocación de",
  coloque: "Colocación de",
  configuro: "Configuración de",
  configure: "Configuración de",
  actualizo: "Actualización de",
  actualice: "Actualización de",
  destapo: "Destape de",
  desarmo: "Desarme de",
  repuso: "Reposición de",
  repuse: "Reposición de",
};
const sinTildes = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

/**
 * Qué se hizo, en pocas palabras, a partir de lo que escribió el técnico:
 * la primera frase, como renglón de factura ("Se cambió la luz del horno" →
 * "Cambio de luz del horno"), hasta 60 letras. Si no hay nada, el tipo de
 * trabajo.
 */
export function resumenTrabajo(trabajo: string | null | undefined, tipo: string): string {
  const primera = (trabajo ?? "")
    .split(/[\n.;]/)
    .map((s) => s.trim())
    .find(Boolean);
  if (!primera) return TIPO_TRABAJO[tipo] ?? "Servicio técnico";
  let t = primera.replace(/^se\s+/i, "");
  const m = /^(\S+)\s+(?:(?:el|la|los|las|un|una|unos|unas)\s+)?(.+)$/i.exec(t);
  const nombre = m ? VERBO_A_NOMBRE[sinTildes(m[1])] : undefined;
  // "Cambio de luz" ya está como renglón: no se toca
  if (m && nombre && !/^\S+\s+(de|del|y)\s/i.test(t)) t = `${nombre} ${m[2]}`;
  if (t.length > 60) t = t.slice(0, 60).replace(/\s+\S*$/, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * El concepto sugerido para facturar: "ST 123 - Cambio de luz por garantía
 * (Movilidad)". Sin horas: el importe sale de las horas, pero la factura
 * dice qué se hizo.
 */
export function conceptoSugerido(input: {
  numero: number;
  trabajo: string | null | undefined;
  tipo: string;
  cobertura: string;
  cobroComo?: string | null;
  horas: number;
}): string {
  const que = resumenTrabajo(input.trabajo, input.tipo);
  const porGarantia = input.cobertura === "garantia" ? " por garantía" : input.cobertura === "contrato" ? " por contrato" : "";
  const como = input.horas > 0 && esCobroComo(input.cobroComo) ? ` (${nombreCobro(input.cobroComo)})` : input.horas > 0 && input.cobertura !== "facturable" ? " (Mano de obra)" : "";
  return `ST ${input.numero} - ${que}${porGarantia}${como}`;
}

/** El concepto con que se factura: el que se escribió o el sugerido. */
export function conceptoFinal(ot: OTCobro & { numero: number; trabajo_realizado?: string | null; tipo: string; concepto_factura?: string | null }, horas: number): string {
  const escrito = ot.concepto_factura?.trim();
  return escrito || conceptoSugerido({ numero: ot.numero, trabajo: ot.trabajo_realizado, tipo: ot.tipo, cobertura: ot.cobertura, cobroComo: ot.cobro_como, horas });
}
