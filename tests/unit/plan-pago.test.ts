import { describe, it, expect } from "vitest";
import {
  cambiarAnticipo,
  normalizarPlan,
  planInicial,
  problemaPlan,
  repartir,
  textoPlan,
  tipoPlan,
  type PlanPago,
} from "@/lib/plan-pago";

// El ejemplo de dirección: anticipo 40% (20% al día, 10% a 15 y 10% a 30 días)
// y saldo 60% antes de despachar en e-cheqs a 30, 45, 60 y 75 días (15% c/u).
const ejemplo: PlanPago = {
  total: 20620,
  moneda: "USD",
  grupos: [
    {
      nombre: "Anticipo",
      pct: 40,
      pagos: [
        { pct: 20, dias: 0, medio: "Transferencia" },
        { pct: 10, dias: 15, medio: "Transferencia" },
        { pct: 10, dias: 30, medio: "Transferencia" },
      ],
    },
    { nombre: "Saldo", pct: 60, cuando: "Antes de despachar", pagos: repartir(60, 4, 30, 15, "E-cheq") },
  ],
};

describe("plan de pagos (v1.18)", () => {
  it("qué formas de pago llevan plan", () => {
    expect(tipoPlan("Anticipo + saldo")).toBe("anticipo");
    expect(tipoPlan("Anticipo y saldo antes de despachar")).toBe("anticipo");
    expect(tipoPlan("Cheque o e-cheq")).toBe("plazos");
    expect(tipoPlan("Cuenta corriente (condición aprobada)")).toBe("plazos");
    expect(tipoPlan("Contado (transferencia)")).toBeNull();
    expect(tipoPlan(null)).toBeNull();
  });

  it("repartir: e-cheqs a 30, 45, 60 y 75 días de 15% cada uno", () => {
    expect(repartir(60, 4, 30, 15, "E-cheq")).toEqual([
      { pct: 15, dias: 30, medio: "E-cheq" },
      { pct: 15, dias: 45, medio: "E-cheq" },
      { pct: 15, dias: 60, medio: "E-cheq" },
      { pct: 15, dias: 75, medio: "E-cheq" },
    ]);
  });

  it("repartir: el último pago absorbe el redondeo", () => {
    const p = repartir(100, 3, 0, 30, "Transferencia");
    expect(p.map((x) => x.pct)).toEqual([33.33, 33.33, 33.34]);
    expect(p.map((x) => x.dias)).toEqual([0, 30, 60]);
  });

  it("el ejemplo de dirección está completo", () => {
    expect(problemaPlan(ejemplo)).toBeNull();
  });

  it("avisa lo que falta repartir o lo que sobra", () => {
    const falta = structuredClone(ejemplo);
    falta.grupos[0].pagos.pop();
    expect(problemaPlan(falta)).toMatch(/anticipo falta repartir 10%/);
    const sobra = structuredClone(ejemplo);
    sobra.grupos[1].pagos[0].pct = 20;
    expect(problemaPlan(sobra)).toMatch(/saldo los pagos se pasan por 5%/);
    expect(problemaPlan(null)).toMatch(/Falta el plan/);
  });

  it("cambiar el anticipo: el saldo es el resto y los pagos mantienen la proporción", () => {
    const p = cambiarAnticipo(ejemplo, 30);
    expect(p.grupos.map((g) => g.pct)).toEqual([30, 70]);
    expect(p.grupos[0].pagos.map((x) => x.pct)).toEqual([15, 7.5, 7.5]);
    expect(p.grupos[1].pagos.map((x) => x.pct)).toEqual([17.5, 17.5, 17.5, 17.5]);
    expect(p.grupos[1].pagos.map((x) => x.dias)).toEqual([30, 45, 60, 75]);
    expect(problemaPlan(p)).toBeNull();
    expect(problemaPlan(cambiarAnticipo(planInicial("anticipo", 1000, "USD"), 35))).toBeNull();
  });

  it("texto para leer con montos", () => {
    const t = textoPlan(ejemplo);
    expect(t[0]).toBe(
      "Anticipo 40% (USD 8.248): 20% al día por transferencia (USD 4.124) · 10% a 15 días por transferencia (USD 2.062) · 10% a 30 días por transferencia (USD 2.062)"
    );
    expect(t[1]).toMatch(/^Saldo 60% \(USD 12\.372\), antes de despachar: 15% a 30 días por e-cheq \(USD 3\.093\)/);
    expect(textoPlan(planInicial("plazos", null, "ARS", "Cheque o e-cheq"))).toEqual(["Pagos: 100% a 30 días por e-cheq"]);
  });

  it("normaliza lo que llega del formulario", () => {
    const n = normalizarPlan({ total: "1000", moneda: "XXX", grupos: [{ nombre: "Pagos", pct: "100", pagos: [{ pct: "100", dias: "30.4", medio: "E-cheq" }] }] });
    expect(n).toEqual({ total: 1000, moneda: "ARS", grupos: [{ nombre: "Pagos", pct: 100, cuando: null, pagos: [{ pct: 100, dias: 30, medio: "E-cheq" }] }] });
    expect(normalizarPlan("nada")).toBeNull();
  });
});
