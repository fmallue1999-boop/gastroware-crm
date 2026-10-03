import { describe, it, expect } from "vitest";
import { cuandoMensaje, detectarMenciones, mencionEnCurso, partesMensaje, sugerirPersonas, veLaCotizacion } from "@/lib/conversaciones";

const personas = [
  { id: "a", nombre: "Ana Pérez" },
  { id: "b", nombre: "Bruno Díaz" },
  { id: "c", nombre: "Bruno Gómez" },
  { id: "d", nombre: "Carla" },
];

describe("menciones con @ (v1.24)", () => {
  it("por nombre completo, sin importar mayúsculas ni tildes", () => {
    expect(detectarMenciones("@ana perez fijate el descuento", personas)).toEqual(["a"]);
    expect(detectarMenciones("Hola @Bruno Gómez y @Carla", personas).sort()).toEqual(["c", "d"]);
  });

  it("por primer nombre solo si nadie más se llama igual", () => {
    expect(detectarMenciones("@Ana mirá esto", personas)).toEqual(["a"]);
    expect(detectarMenciones("@Bruno mirá esto", personas)).toEqual([]);
  });

  it("no cuenta un mail ni un nombre más largo", () => {
    expect(detectarMenciones("escribile a ventas@ana.com", personas)).toEqual([]);
    expect(detectarMenciones("@Carlanga", personas)).toEqual([]);
  });

  it("resalta las menciones dentro del texto", () => {
    expect(partesMensaje("ok @Ana Pérez, gracias", personas)).toEqual([
      { texto: "ok ", mencion: false },
      { texto: "@Ana Pérez", mencion: true },
      { texto: ", gracias", mencion: false },
    ]);
    expect(partesMensaje("sin menciones", personas)).toEqual([{ texto: "sin menciones", mencion: false }]);
  });

  it("detecta la mención que se está escribiendo y sugiere personas", () => {
    expect(mencionEnCurso("hola @")).toBe("");
    expect(mencionEnCurso("hola @bru")).toBe("bru");
    expect(mencionEnCurso("hola @Bruno G")).toBe("Bruno G");
    expect(mencionEnCurso("hola @Ana Pérez ya está")).toBeNull();
    expect(mencionEnCurso("ventas@ana")).toBeNull();
    expect(sugerirPersonas("bru", personas).map((p) => p.id)).toEqual(["b", "c"]);
    expect(sugerirPersonas("gom", personas).map((p) => p.id)).toEqual(["c"]);
    expect(sugerirPersonas("bruno g", personas).map((p) => p.id)).toEqual(["c"]);
    expect(sugerirPersonas("", personas)).toHaveLength(4);
  });
});

describe("quién ve la cotización (v1.24, igual que la base)", () => {
  it("dirección y administración siempre; el vendedor solo la suya", () => {
    expect(veLaCotizacion({ id: "x", rol: "direccion" }, "v1")).toBe(true);
    expect(veLaCotizacion({ id: "x", rol: "administrativa" }, "v1")).toBe(true);
    expect(veLaCotizacion({ id: "v1", rol: "comercial" }, "v1")).toBe(true);
    expect(veLaCotizacion({ id: "v2", rol: "comercial" }, "v1")).toBe(false);
    expect(veLaCotizacion({ id: "m", rol: "marketing" }, "v1")).toBe(false);
    expect(veLaCotizacion({ id: "v2", rol: "comercial" }, null)).toBe(true);
  });
});

describe("hora de los mensajes (v1.24)", () => {
  const ahora = new Date("2026-10-02T15:00:00-03:00");
  it("hoy solo la hora; ayer y antes con el día", () => {
    expect(cuandoMensaje("2026-10-02T09:05:00-03:00", ahora)).toBe("09:05");
    expect(cuandoMensaje("2026-10-01T22:30:00-03:00", ahora)).toBe("ayer 22:30");
    expect(cuandoMensaje("2026-09-12T18:00:00-03:00", ahora)).toMatch(/^12 .+ 18:00$/);
  });
});
