import { describe, it, expect } from "vitest";
import {
  aReintegrar,
  cuitConGuiones,
  estadoRendicion,
  leerFecha,
  leerImporte,
  mesVecino,
  rangoMes,
  resumenPorPersona,
  textoTotales,
  totalPorMoneda,
} from "@/lib/viaticos";

describe("importes escritos como sea (v1.25)", () => {
  it("formato argentino, con signo y espacios", () => {
    expect(leerImporte("$ 12.345,67")).toBe(12345.67);
    expect(leerImporte("1.500")).toBe(1500);
    expect(leerImporte("1.234.567")).toBe(1234567);
    expect(leerImporte("12,5")).toBe(12.5);
  });
  it("formato con punto decimal (como lo devuelve la IA)", () => {
    expect(leerImporte("12345.67")).toBe(12345.67);
    expect(leerImporte("12,345.67")).toBe(12345.67);
    expect(leerImporte("12.50")).toBe(12.5);
    expect(leerImporte(980)).toBe(980);
  });
  it("nada, cero o negativo no es un importe", () => {
    expect(leerImporte("")).toBeNull();
    expect(leerImporte("abc")).toBeNull();
    expect(leerImporte("0")).toBeNull();
    expect(leerImporte("-50")).toBeNull();
    expect(leerImporte(null)).toBeNull();
  });
});

describe("fechas y CUIT (v1.25)", () => {
  it("fecha válida y no futura (un día de margen)", () => {
    expect(leerFecha("2026-10-01", "2026-10-02")).toBe("2026-10-01");
    expect(leerFecha("2026-10-03", "2026-10-02")).toBe("2026-10-03");
    expect(leerFecha("2026-10-05", "2026-10-02")).toBeNull();
    expect(leerFecha("2026-02-30", "2026-10-02")).toBeNull();
    expect(leerFecha("01/10/2026", "2026-10-02")).toBeNull();
    expect(leerFecha("", "2026-10-02")).toBeNull();
  });
  it("CUIT con guiones si tiene 11 dígitos", () => {
    expect(cuitConGuiones("30712345679")).toBe("30-71234567-9");
    expect(cuitConGuiones("30-71234567-9")).toBe("30-71234567-9");
    expect(cuitConGuiones("123")).toBe("123");
    expect(cuitConGuiones("  ")).toBeNull();
  });
});

describe("cuentas de la rendición (v1.25)", () => {
  const gastos = [
    { importe: 1000, moneda: "ARS", medio_pago: "propio", decision: "aprobado" },
    { importe: "500.5", moneda: "ARS", medio_pago: "tarjeta_empresa", decision: "aprobado" },
    { importe: 300, moneda: "ARS", medio_pago: "propio", decision: "rechazado" },
    { importe: 20, moneda: "USD", medio_pago: "propio", decision: "aprobado" },
    { importe: 99, moneda: "ARS", medio_pago: "propio", decision: null },
  ];
  it("total por moneda", () => {
    expect(totalPorMoneda(gastos)).toEqual({ ARS: 1899.5, USD: 20 });
  });
  it("se devuelve solo lo aprobado pagado con plata propia", () => {
    expect(aReintegrar(gastos)).toEqual({ ARS: 1000, USD: 20 });
    expect(aReintegrar([{ importe: 10, moneda: "ARS", medio_pago: "adelanto", decision: "aprobado" }])).toEqual({});
  });
  it("texto de los totales: pesos primero", () => {
    expect(textoTotales({ USD: 20, ARS: 1000 })).toBe("$ 1.000 + USD 20");
    expect(textoTotales({ ARS: 1899.5 })).toBe("$ 1.899,50");
    expect(textoTotales({})).toBe("$ 0");
  });
  it("por persona y por tipo de gasto", () => {
    const r = resumenPorPersona([
      { usuario_id: "a", categoria: "combustible", importe: 100, moneda: "ARS", medio_pago: "propio" },
      { usuario_id: "a", categoria: "combustible", importe: 50, moneda: "ARS", medio_pago: "propio" },
      { usuario_id: "a", categoria: "peaje", importe: 10, moneda: "ARS", medio_pago: "propio" },
      { usuario_id: "b", categoria: "hotel", importe: 30, moneda: "USD", medio_pago: "tarjeta_empresa" },
    ]);
    expect(r.find((p) => p.usuarioId === "a")).toEqual({ usuarioId: "a", total: { ARS: 160 }, porCategoria: { combustible: { ARS: 150 }, peaje: { ARS: 10 } } });
    expect(r.find((p) => p.usuarioId === "b")?.total).toEqual({ USD: 30 });
  });
  it("estado desconocido = para aprobar", () => {
    expect(estadoRendicion("raro")).toBe("enviada");
    expect(estadoRendicion("reintegrada")).toBe("reintegrada");
  });
});

describe("meses (v1.25)", () => {
  it("rango del mes y meses vecinos", () => {
    expect(rangoMes("2026-02")).toEqual({ desde: "2026-02-01", hasta: "2026-02-28" });
    expect(rangoMes("2028-02")).toEqual({ desde: "2028-02-01", hasta: "2028-02-29" });
    expect(rangoMes("2026-10")).toEqual({ desde: "2026-10-01", hasta: "2026-10-31" });
    expect(mesVecino("2026-01", -1)).toBe("2025-12");
    expect(mesVecino("2026-12", 1)).toBe("2027-01");
  });
});
