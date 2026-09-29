import { describe, expect, it } from "vitest";
import { cuitProlijo, cuitValido, datosFiscalesDe, emailValido, faltanParaCotizar } from "@/lib/datos-cotizar";

describe("datos para cotizar", () => {
  it("CUIT con dígito verificador", () => {
    expect(cuitValido("30-71905618-7")).toBe(true);
    expect(cuitValido("20123456786")).toBe(true);
    expect(cuitValido("20123456785")).toBe(false);
    expect(cuitValido("2012345678")).toBe(false);
    expect(cuitProlijo("20123456786")).toBe("20-12345678-6");
    expect(cuitProlijo("123")).toBe("123");
  });

  it("email", () => {
    expect(emailValido("compras@empresa.com.ar")).toBe(true);
    expect(emailValido("compras@empresa")).toBe(false);
  });

  it("qué falta para cotizar", () => {
    expect(faltanParaCotizar({ razon_social: "Empresa S.A.", cuit: "20-12345678-6", email: "a@b.com", direccion: "Calle 1", ciudad: "Ciudad" })).toEqual([]);
    expect(faltanParaCotizar({ razon_social: "", cuit: "20123456785", email: "x", direccion: null, ciudad: "Ciudad" })).toEqual([
      "razón social",
      "CUIT válido",
      "dirección",
      "email válido",
    ]);
  });

  it("la dirección sale de la sucursal principal", () => {
    const d = datosFiscalesDe({
      razon_social: "E",
      sucursales: [
        { direccion: "Otra 2", ciudad: "B", es_principal: false },
        { direccion: "Principal 1", ciudad: "A", es_principal: true },
        { direccion: "Borrada", ciudad: "C", es_principal: true, deleted_at: "2026-01-01" },
      ],
    });
    expect(d.direccion).toBe("Principal 1");
    expect(d.ciudad).toBe("A");
  });
});
