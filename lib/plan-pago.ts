/**
 * Plan de pagos de una venta (v1.18). Con "Anticipo + saldo" la venta se
 * divide en dos partes (ej: anticipo 40%, saldo 60%) y cada parte en pagos
 * con su porcentaje del total, a cuántos días y con qué medio (ej: saldo en
 * e-cheqs a 30, 45, 60 y 75 días, 15% cada uno). Con cheque o cuenta
 * corriente hay una sola parte. Los porcentajes son siempre sobre el total.
 */
import { dinero } from "@/lib/format";

export const MEDIOS_PAGO = ["Transferencia", "Efectivo", "E-cheq", "Cheque", "Tarjeta", "Mercado Pago"] as const;
export const CUANDO_SALDO = ["Antes de despachar", "Contra entrega"] as const;

export type PagoPlan = { pct: number; dias: number; medio: string };
export type GrupoPlan = { nombre: string; pct: number; cuando?: string | null; pagos: PagoPlan[] };
export type PlanPago = { total: number | null; moneda: string; grupos: GrupoPlan[] };
export type TipoPlan = "anticipo" | "plazos";

/** Forma de pago anterior a v1.18 que hoy es "Anticipo + saldo". */
export const FORMA_ANTICIPO_VIEJA = "Anticipo y saldo antes de despachar";

export const r2 = (n: number) => Math.round(n * 100) / 100;

/** Qué plan pide cada forma de pago (null = se paga de una vez, sin plan). */
export function tipoPlan(formaPago: string | null | undefined): TipoPlan | null {
  const f = formaPago ?? "";
  if (/anticipo/i.test(f)) return "anticipo";
  if (/cheq|cuenta corriente/i.test(f)) return "plazos";
  return null;
}

/** Reparte un porcentaje en pagos iguales (el último absorbe el redondeo). */
export function repartir(pct: number, cantidad: number, primerDia: number, cadaDias: number, medio: string): PagoPlan[] {
  const n = Math.max(1, Math.min(24, Math.round(cantidad)));
  const parte = r2(pct / n);
  return Array.from({ length: n }, (_, i) => ({
    pct: i === n - 1 ? r2(pct - parte * (n - 1)) : parte,
    dias: Math.max(0, Math.round(primerDia + cadaDias * i)),
    medio,
  }));
}

export function planInicial(tipo: TipoPlan, total: number | null, moneda: string, formaPago = ""): PlanPago {
  if (tipo === "anticipo")
    return {
      total,
      moneda,
      grupos: [
        { nombre: "Anticipo", pct: 50, pagos: [{ pct: 50, dias: 0, medio: "Transferencia" }] },
        { nombre: "Saldo", pct: 50, cuando: CUANDO_SALDO[0], pagos: [{ pct: 50, dias: 0, medio: "Transferencia" }] },
      ],
    };
  return {
    total,
    moneda,
    grupos: [{ nombre: "Pagos", pct: 100, pagos: [{ pct: 100, dias: 30, medio: /cheq/i.test(formaPago) ? "E-cheq" : "Transferencia" }] }],
  };
}

/** Cambia el % del anticipo: el saldo pasa a ser el resto, y cada parte se reparte en sus pagos. */
export function cambiarAnticipo(plan: PlanPago, pct: number): PlanPago {
  const anticipo = Math.min(99, Math.max(1, r2(pct)));
  const [a, s] = plan.grupos;
  if (!a || !s) return plan;
  return { ...plan, grupos: [escalarGrupo(a, anticipo), escalarGrupo(s, r2(100 - anticipo))] };
}

/** Lleva un grupo a otro %: sus pagos mantienen la proporción (o se reparten iguales si no tenían %). */
function escalarGrupo(g: GrupoPlan, nuevo: number): GrupoPlan {
  if (!g.pagos.length) return { ...g, pct: nuevo, pagos: [{ pct: nuevo, dias: 0, medio: "Transferencia" }] };
  const suma = sumaPagos(g);
  const pagos = g.pagos.map((p) => ({ ...p, pct: r2(suma ? (p.pct / suma) * nuevo : nuevo / g.pagos.length) }));
  const ultimo = pagos[pagos.length - 1];
  ultimo.pct = r2(ultimo.pct + r2(nuevo - pagos.reduce((t, p) => t + p.pct, 0)));
  return { ...g, pct: nuevo, pagos };
}

export const sumaPagos = (g: GrupoPlan) => r2(g.pagos.reduce((t, p) => t + (Number(p.pct) || 0), 0));
export const montoDe = (total: number | null, pct: number) => (total == null ? null : r2((total * pct) / 100));
export const textoPlazo = (dias: number) => (dias === 0 ? "al día" : `a ${dias} días`);
const pctTexto = (n: number) => `${String(r2(n)).replace(".", ",")}%`;

/** Qué le falta al plan para estar completo (null = está bien). */
export function problemaPlan(plan: PlanPago | null | undefined): string | null {
  if (!plan?.grupos?.length) return "Falta el plan de pagos";
  const totalGrupos = r2(plan.grupos.reduce((t, g) => t + g.pct, 0));
  if (Math.abs(totalGrupos - 100) > 0.01) return `Las partes suman ${pctTexto(totalGrupos)}: tienen que sumar 100%`;
  for (const g of plan.grupos) {
    const nombre = g.nombre.toLowerCase();
    if (!(g.pct > 0)) return `Poné el % del ${nombre}`;
    if (!g.pagos.length) return `Agregá al menos un pago al ${nombre}`;
    for (const p of g.pagos) {
      if (!(p.pct > 0)) return `Hay un pago del ${nombre} sin %`;
      if (!Number.isInteger(p.dias) || p.dias < 0 || p.dias > 730) return `Revisá los días de un pago del ${nombre}`;
      if (!p.medio?.trim()) return `Elegí cómo se paga cada pago del ${nombre}`;
    }
    const suma = sumaPagos(g);
    const dif = r2(g.pct - suma);
    if (Math.abs(dif) > 0.01)
      return dif > 0
        ? `En el ${nombre} falta repartir ${pctTexto(dif)} (los pagos suman ${pctTexto(suma)} de ${pctTexto(g.pct)})`
        : `En el ${nombre} los pagos se pasan por ${pctTexto(-dif)} (suman ${pctTexto(suma)} de ${pctTexto(g.pct)})`;
  }
  return null;
}

/** Limpia lo que llega del formulario (números, textos, cantidad de pagos). */
export function normalizarPlan(plan: unknown): PlanPago | null {
  const p = plan as Partial<PlanPago> | null;
  if (!p || !Array.isArray(p.grupos)) return null;
  const num = (v: unknown) => (typeof v === "number" ? v : Number(String(v ?? "").replace(",", ".")));
  return {
    total: p.total == null || !Number.isFinite(num(p.total)) ? null : r2(num(p.total)),
    moneda: p.moneda === "USD" ? "USD" : "ARS",
    grupos: p.grupos.slice(0, 3).map((g) => ({
      nombre: String(g?.nombre ?? "Pagos").slice(0, 30),
      pct: r2(num(g?.pct) || 0),
      cuando: g?.cuando ? String(g.cuando).slice(0, 40) : null,
      pagos: (Array.isArray(g?.pagos) ? g.pagos : []).slice(0, 24).map((x) => ({
        pct: r2(num(x?.pct) || 0),
        dias: Math.round(num(x?.dias) || 0),
        medio: String(x?.medio ?? "").slice(0, 30),
      })),
    })),
  };
}

/** El plan en renglones para leer (tarjeta de la venta, historial, aprobación). */
export function textoPlan(plan: PlanPago | null | undefined): string[] {
  if (!plan?.grupos?.length) return [];
  return plan.grupos.map((g) => {
    const monto = montoDe(plan.total, g.pct);
    const cabeza =
      plan.grupos.length > 1
        ? `${g.nombre} ${pctTexto(g.pct)}${monto != null ? ` (${dinero(monto, plan.moneda)})` : ""}${g.cuando ? `, ${g.cuando.toLowerCase()}` : ""}`
        : `${g.nombre}${monto != null ? ` (${dinero(monto, plan.moneda)})` : ""}`;
    const pagos = g.pagos
      .map((p) => {
        const m = montoDe(plan.total, p.pct);
        return `${pctTexto(p.pct)} ${textoPlazo(p.dias)} por ${p.medio.toLowerCase()}${m != null ? ` (${dinero(m, plan.moneda)})` : ""}`;
      })
      .join(" · ");
    return `${cabeza}: ${pagos}`;
  });
}
