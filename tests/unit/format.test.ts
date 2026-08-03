import { describe, it, expect } from "vitest";
import {
  normalizarTelefono,
  sumarDias,
  sumarMeses,
  dinero,
  rellenarPlantilla,
  diasDesde,
  linkWhatsApp,
} from "@/lib/format";

describe("normalizarTelefono", () => {
  it("quita prefijos argentinos y no-dígitos", () => {
    expect(normalizarTelefono("+54 9 11 5452-7766")).toBe("1154527766");
    expect(normalizarTelefono("011 4444-5555")).toBe("1144445555");
    expect(normalizarTelefono("54 351 518 3222")).toBe("3515183222");
  });
  it("es idempotente", () => {
    const una = normalizarTelefono("+54 9 223 529-4974");
    expect(normalizarTelefono(una)).toBe(una);
  });
});

describe("fechas", () => {
  it("sumarDias suma sobre una fecha dada", () => {
    expect(sumarDias(2, "2026-08-03")).toBe("2026-08-05");
    expect(sumarDias(30, "2026-08-03")).toBe("2026-09-02");
  });
  it("sumarMeses calcula garantías", () => {
    expect(sumarMeses(12, "2026-08-03")).toBe("2027-08-03");
    expect(sumarMeses(60, "2026-08-03")).toBe("2031-08-03");
  });
  it("diasDesde nunca es negativo", () => {
    const maniana = sumarDias(1);
    expect(diasDesde(maniana)).toBe(0);
  });
});

describe("dinero", () => {
  it("formatea ARS y USD en es-AR", () => {
    expect(dinero(95000)).toBe("$95.000");
    expect(dinero(9500, "USD")).toBe("USD 9.500");
    expect(dinero(null)).toBe("—");
  });
});

describe("rellenarPlantilla", () => {
  it("reemplaza variables presentes y conserva las ausentes", () => {
    expect(
      rellenarPlantilla("Hola {nombre}, el {producto} sale {monto}", {
        nombre: "Pato",
        monto: "$1",
      })
    ).toBe("Hola Pato, el {producto} sale $1");
  });
});

describe("linkWhatsApp", () => {
  it("arma el link con 549 y texto codificado", () => {
    expect(linkWhatsApp("11 5452 7766", "hola")).toBe(
      "https://wa.me/5491154527766?text=hola"
    );
  });
});
