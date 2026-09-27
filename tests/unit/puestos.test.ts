import { describe, it, expect } from "vitest";
import { sumarHabiles, habilesEntre, venceEnHorasHabiles, transcurrido } from "@/lib/habiles";
import { siguientePasoPropuesta, sugerenciaSinRespuesta } from "@/lib/cadencia";
import { territorioDeZona, responsableDe, otroTerritorio, type Territorio } from "@/lib/territorios";
import { factura, veTodo, vende, controlaServicio } from "@/lib/puestos";

describe("días hábiles", () => {
  it("salta el fin de semana", () => {
    expect(sumarHabiles("2026-10-02", 1)).toBe("2026-10-05"); // viernes + 1 = lunes
    expect(sumarHabiles("2026-10-01", 5)).toBe("2026-10-08"); // jueves + 5 = jueves siguiente
    expect(habilesEntre("2026-10-02", "2026-10-06")).toBe(2); // lunes y martes
  });
  it("24 h hábiles desde un viernes vencen el lunes a la misma hora", () => {
    expect(venceEnHorasHabiles("2026-10-02T14:00:00.000Z", 24).toISOString()).toBe("2026-10-05T14:00:00.000Z");
    expect(venceEnHorasHabiles("2026-10-02T14:00:00.000Z", 1).toISOString()).toBe("2026-10-02T15:00:00.000Z");
  });
  it("tiempo transcurrido en palabras", () => {
    const ahora = Date.parse("2026-10-02T15:00:00Z");
    expect(transcurrido("2026-10-02T14:20:00Z", ahora)).toBe("hace 40 min");
    expect(transcurrido("2026-10-02T10:00:00Z", ahora)).toBe("hace 5 h");
    expect(transcurrido("2026-09-30T15:00:00Z", ahora)).toBe("hace 2 días");
  });
});

describe("cadencia de la propuesta", () => {
  it("sigue 1-3-7, duerme a los 14 y recontacta a 30 y 60", () => {
    expect(siguientePasoPropuesta(0)).toEqual({ dias: 1, nota: "Seguimiento de la propuesta (día 1)" });
    expect(siguientePasoPropuesta(1)?.dias).toBe(2);
    expect(siguientePasoPropuesta(3)?.dias).toBe(4);
    expect(siguientePasoPropuesta(7)?.nota).toMatch(/último intento/);
    expect(siguientePasoPropuesta(14)?.nota).toBe("Recontacto de la propuesta dormida (día 30)");
    expect(siguientePasoPropuesta(60)).toBeNull();
  });
  it("lead sin respuesta: dos reintentos y en espera", () => {
    expect(sugerenciaSinRespuesta(0).dias).toBe(1);
    expect(sugerenciaSinRespuesta(2)).toEqual({ dias: 14, nota: "En espera: no respondió a tres intentos" });
  });
});

describe("territorios", () => {
  const territorios: Territorio[] = [
    { codigo: "amba", nombre: "CABA y AMBA", zonas: ["CABA", "AMBA (Gran Buenos Aires)"], responsable_id: "g1" },
    { codigo: "interior", nombre: "Interior", zonas: ["Mar del Plata y zona", "Otra provincia"], responsable_id: null },
  ];
  const usuarios = [
    { id: "d1", nombre: "Dirección", rol: "direccion", activo: true },
    { id: "g1", nombre: "Gerencia", rol: "comercial", activo: true },
  ];
  it("asigna por lugar de entrega y cae en dirección si el puesto está vacante", () => {
    expect(territorioDeZona("CABA", territorios)?.codigo).toBe("amba");
    expect(responsableDe(territorioDeZona("CABA", territorios), usuarios)?.id).toBe("g1");
    expect(responsableDe(territorioDeZona("Mar del Plata y zona", territorios), usuarios)?.id).toBe("d1");
    expect(responsableDe(territorioDeZona("CABA", territorios), [{ ...usuarios[0] }, { ...usuarios[1], activo: false }])?.id).toBe("d1");
    expect(otroTerritorio("amba", territorios)?.codigo).toBe("interior");
  });
});

describe("puestos", () => {
  it("cada puesto hace lo suyo", () => {
    expect(factura("administrativa")).toBe(true);
    expect(factura("comercial")).toBe(false);
    expect(veTodo("administrativa")).toBe(true);
    expect(vende("administrativa")).toBe(false);
    expect(controlaServicio("admin")).toBe(true);
    expect(controlaServicio("administrativa")).toBe(false);
  });
});
