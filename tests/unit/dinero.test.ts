import { describe, it, expect } from "vitest";
import { sumarPorMoneda, ordenarMonedas, textoMontos } from "@/lib/dinero";

describe("sumarPorMoneda", () => {
  it("nunca mezcla monedas", () => {
    expect(
      sumarPorMoneda([
        { monto: 100, moneda: "USD" },
        { monto: 5, moneda: "ARS" },
        { monto: 50, moneda: "USD" },
      ])
    ).toEqual({ USD: 150, ARS: 5 });
  });

  it("ignora montos vacíos y asume ARS si falta la moneda", () => {
    expect(sumarPorMoneda([{ monto: null }, { monto: 10 }, { monto: 2, moneda: "" }])).toEqual({
      ARS: 12,
    });
  });
});

describe("ordenarMonedas y textoMontos", () => {
  it("pone USD primero, después ARS", () => {
    expect(ordenarMonedas({ ARS: 1, USD: 2, EUR: 3 }).map(([m]) => m)).toEqual([
      "USD",
      "ARS",
      "EUR",
    ]);
  });

  it("arma el texto separado por punto medio", () => {
    expect(textoMontos({ USD: 48200, ARS: 12400000 })).toBe("USD 48.200 · $12.400.000");
    expect(textoMontos({})).toBe("$0");
  });
});
