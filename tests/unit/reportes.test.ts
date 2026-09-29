import { describe, expect, it } from "vitest";
import { deLinea, resumirActividad, resumirControl } from "@/lib/reportes";

const nombre = (id: string) => ({ a: "Vendedor A", b: "Vendedor B" })[id] ?? "?";

describe("actividad comercial", () => {
  it("intentos contra conversaciones", () => {
    const r = resumirActividad(
      [
        { medio: "llamada", resultado: "no_respondio", created_by: "a", linea: "equipos" },
        { medio: "llamada", resultado: "conversamos", created_by: "a", linea: "equipos" },
        { medio: "whatsapp", resultado: "enviado", created_by: "b", linea: "equipos" },
        { medio: "visita", resultado: "no_se_hizo", created_by: "b", linea: "equipos" },
        { medio: null, resultado: null, created_by: "a", linea: null },
      ],
      nombre
    );
    expect(r.intentos).toBe(3);
    expect(r.conversaciones).toBe(1);
    expect(r.efectividad).toBeCloseTo(1 / 3);
    expect(r.porMedio).toEqual([
      { medio: "Llamada", intentos: 2, conversaciones: 1 },
      { medio: "WhatsApp", intentos: 1, conversaciones: 0 },
    ]);
    expect(r.porVendedor[0]).toEqual({ id: "a", nombre: "Vendedor A", intentos: 2, conversaciones: 1 });
  });

  it("sin intentos no hay efectividad", () => {
    expect(resumirActividad([], nombre).efectividad).toBeNull();
  });
});

describe("control", () => {
  it("sin atender y sin próximo paso (la lista de espera no cuenta)", () => {
    const r = resumirControl(
      [
        { comercial_id: "a", linea: "equipos", etapa: "nueva", asignado_at: "x", primer_contacto_at: null, proximo_contacto: null },
        { comercial_id: "a", linea: "equipos", etapa: "cotizada", asignado_at: "x", primer_contacto_at: "y", proximo_contacto: null },
        { comercial_id: "b", linea: "repuestos", etapa: "espera", asignado_at: null, primer_contacto_at: null, proximo_contacto: null },
        { comercial_id: null, linea: "equipos", etapa: "nueva", asignado_at: null, primer_contacto_at: null, proximo_contacto: "2026-10-01" },
      ],
      nombre
    );
    expect(r.sinAtender).toBe(1);
    expect(r.sinProximo).toBe(1);
    expect(r.porVendedor).toEqual([{ id: "a", nombre: "Vendedor A", sinAtender: 1, sinProximo: 1 }]);
  });

  it("filtra por apartado", () => {
    const filas = [{ linea: "equipos" }, { linea: null }, { linea: "consumibles" }];
    expect(deLinea(filas, "equipos")).toHaveLength(2);
    expect(deLinea(filas, "consumibles")).toHaveLength(1);
    expect(deLinea(filas, null)).toHaveLength(3);
  });
});
