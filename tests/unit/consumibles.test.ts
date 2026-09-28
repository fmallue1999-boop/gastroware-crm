import { describe, expect, it } from "vitest";
import { agruparPorCliente, cantidadTexto, estadoPlan, fechaContacto, reposicionEstimada } from "@/lib/consumibles";

describe("consumibles", () => {
  it("el ejemplo del pedido: compra 28/09, repone en 60 días, contactar 10 antes → 17/11", () => {
    expect(fechaContacto("2026-09-28", 60, 10)).toBe("2026-11-17");
    expect(reposicionEstimada("2026-09-28", 60)).toBe("2026-11-27");
  });

  it("sin frecuencia conocida: 30 días por defecto, y nunca antes del día siguiente", () => {
    expect(fechaContacto("2026-09-28", null, 10)).toBe("2026-10-18");
    expect(fechaContacto("2026-09-28", 5, 10)).toBe("2026-09-29");
    expect(reposicionEstimada("2026-09-28", null)).toBeNull();
  });

  it("estado del plan", () => {
    const hoy = "2026-10-10";
    expect(estadoPlan({ activa: false, proxima_alerta: "2026-10-01" }, hoy)).toBe("suspendido");
    expect(estadoPlan({ activa: true, proxima_alerta: "2026-10-09" }, hoy)).toBe("vencido");
    expect(estadoPlan({ activa: true, proxima_alerta: hoy }, hoy)).toBe("hoy");
    expect(estadoPlan({ activa: true, proxima_alerta: "2026-10-15" }, hoy)).toBe("pronto");
    expect(estadoPlan({ activa: true, proxima_alerta: "2026-11-15" }, hoy)).toBe("programado");
  });

  it("agrupa productos del mismo cliente con fechas cercanas", () => {
    const g = agruparPorCliente([
      { cliente_id: "a", proxima_alerta: "2026-10-10", id: 1 },
      { cliente_id: "b", proxima_alerta: "2026-10-05", id: 2 },
      { cliente_id: "a", proxima_alerta: "2026-10-14", id: 3 },
      { cliente_id: "a", proxima_alerta: "2026-11-30", id: 4 },
    ]);
    expect(g.map((x) => x.map((p) => p.id))).toEqual([[2], [1, 3], [4]]);
  });

  it("cantidad", () => {
    expect(cantidadTexto(6, "cajas")).toBe("6 cajas");
    expect(cantidadTexto(6, null)).toBe("6 u.");
    expect(cantidadTexto(null, "cajas")).toBe("");
  });
});
