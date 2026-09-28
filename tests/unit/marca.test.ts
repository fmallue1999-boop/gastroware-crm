import { describe, it, expect } from "vitest";
import { MARCA_POR_DEFECTO, TEMAS, aclarar, coloresDe, contraste, cssDeMarca, marcaDesdeConfig } from "@/lib/marca";

describe("marca del sistema", () => {
  it("sin configuración usa GastroWare OS con el logo oficial", () => {
    const m = marcaDesdeConfig({});
    expect(m).toEqual(MARCA_POR_DEFECTO);
    expect(m.nombre).toBe("GastroWare OS");
  });

  it("toma lo configurado e ignora valores inválidos", () => {
    const m = marcaDesdeConfig({ marca_nombre: "Mi CRM", marca_tema: "petroleo", marca_color: "rojo", marca_logo_oscuro: "https://x/l.png" });
    expect(m.nombre).toBe("Mi CRM");
    expect(m.tema).toBe("petroleo");
    expect(m.color).toBeNull();
    expect(m.logoOscuro).toBe("https://x/l.png");
    expect(marcaDesdeConfig({ marca_tema: "inventado" }).tema).toBe("gastroware");
    // personalizado sin color válido vuelve al de marca
    expect(marcaDesdeConfig({ marca_tema: "personalizado" }).tema).toBe("gastroware");
  });

  it("el color personalizado arma la paleta", () => {
    const c = coloresDe({ ...MARCA_POR_DEFECTO, tema: "personalizado", color: "#8a1c1c" });
    expect(c.principal).toBe("#8a1c1c");
    expect(c.principal2).toBe(aclarar("#8a1c1c", 0.18));
    expect(cssDeMarca({ ...MARCA_POR_DEFECTO, tema: "personalizado", color: "#8a1c1c" })).toContain("--color-marino:#8a1c1c");
  });

  it("el texto blanco se lee sobre el color principal de cada tema", () => {
    for (const t of TEMAS) expect(contraste(t.colores.principal, "#ffffff"), t.id).toBeGreaterThanOrEqual(4.5);
  });

  it("aclarar mezcla con blanco", () => {
    expect(aclarar("#000000", 0.5)).toBe("#808080");
    expect(aclarar("#111111", 0)).toBe("#111111");
  });
});
