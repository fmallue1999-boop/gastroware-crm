import { describe, expect, it } from "vitest";
import { estadoRepuesto, mensajeCotizacion, textoDisponibilidad, totalRepuesto } from "@/lib/repuestos";

describe("repuestos", () => {
  it("estado según etapa y validación", () => {
    expect(estadoRepuesto("nueva", "pendiente")).toBe("validacion");
    expect(estadoRepuesto("nueva", "no_requiere")).toBe("para_cotizar");
    expect(estadoRepuesto("nueva", "validada")).toBe("para_cotizar");
    expect(estadoRepuesto("nueva", "no_se_pudo")).toBe("para_cotizar");
    expect(estadoRepuesto("cotizada", "validada")).toBe("cotizada");
    expect(estadoRepuesto("seguimiento", "validada")).toBe("esperando");
    expect(estadoRepuesto("ganada", "pendiente")).toBe("ganada");
    expect(estadoRepuesto("perdida", "validada")).toBe("perdida");
  });

  it("total y disponibilidad", () => {
    expect(totalRepuesto(1500.5, 2)).toBe(3001);
    expect(totalRepuesto(null, 2)).toBeNull();
    expect(textoDisponibilidad("en_stock", 0)).toBe("en stock");
    expect(textoDisponibilidad("a_pedir", 15)).toBe("a pedir, 15 días");
    expect(textoDisponibilidad(null, null)).toBe("");
  });

  it("mensaje de cotización", () => {
    expect(
      mensajeCotizacion({ contacto: "Martín", descripcion: "tanque de leche 500 ml", equipo: "Jetinno JL36", cantidad: 1, total: "$ 85.000", disponibilidad: "a_pedir", plazo: 10 })
    ).toBe("Hola Martín, te paso la cotización del repuesto tanque de leche 500 ml para Jetinno JL36: $ 85.000 (a pedir, 10 días). ¿Te lo reservamos?");
  });
});
