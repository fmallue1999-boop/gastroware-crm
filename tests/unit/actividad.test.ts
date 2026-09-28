import { describe, expect, it } from "vitest";
import {
  esConversacion,
  esIntento,
  nombrePersonaEmpresa,
  notasSinContacto,
  RESULTADOS_POR_MEDIO,
  sugerenciaPorResultado,
  textoActividad,
} from "@/lib/actividad";

describe("actividad comercial", () => {
  it("un intento sin respuesta no es una conversación", () => {
    expect(esIntento("llamada", "no_respondio")).toBe(true);
    expect(esConversacion("no_respondio")).toBe(false);
    expect(esConversacion("enviado")).toBe(false);
    expect(esConversacion("conversamos")).toBe(true);
    expect(esConversacion("no_interesado")).toBe(true);
    expect(esIntento(null, null)).toBe(false);
    expect(esIntento("visita", "no_se_hizo")).toBe(false);
  });

  it("un email enviado no ofrece 'no respondió' y una llamada no ofrece 'enviado'", () => {
    expect(RESULTADOS_POR_MEDIO.email).not.toContain("no_respondio");
    expect(RESULTADOS_POR_MEDIO.llamada).not.toContain("enviado");
  });

  it("sugiere el próximo paso según el resultado", () => {
    expect(sugerenciaPorResultado("llamada", "no_respondio")).toEqual({ accion: "llamar", dias: 2 });
    expect(sugerenciaPorResultado("whatsapp", "no_respondio")).toEqual({ accion: "escribir", dias: 2 });
    expect(sugerenciaPorResultado("llamada", "conversamos")).toBeNull();
    expect(sugerenciaPorResultado("llamada", "no_interesado")).toBeNull();
  });

  it("textos", () => {
    expect(textoActividad("llamada", "no_respondio")).toBe("Llamada · No respondió");
    expect(textoActividad(null, null)).toBe("");
  });

  it("persona | empresa sin repetir", () => {
    expect(nombrePersonaEmpresa("Martín Pérez", "Café Central")).toBe("Martín Pérez | Café Central");
    expect(nombrePersonaEmpresa("Martín Pérez", "martín pérez")).toBe("martín pérez");
    expect(nombrePersonaEmpresa(null, "Café Central")).toBe("Café Central");
  });

  it("saca el 'Contacto:' viejo de las notas", () => {
    expect(notasSinContacto("Contacto: Martín | Quiere para diciembre")).toBe("Quiere para diciembre");
    expect(notasSinContacto("Contacto: Martín")).toBeNull();
    expect(notasSinContacto("Cliente de hace años")).toBe("Cliente de hace años");
  });
});
