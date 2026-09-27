import { describe, it, expect } from "vitest";
import { atrasoMaximo, diasPostventa, pasoDe, proximoPasoVenta } from "@/lib/ventas";

describe("circuito de la venta", () => {
  it("ordena los pasos: vendido, facturado, preparar, despachado, entregado", () => {
    expect(pasoDe(null)).toBe(0);
    expect(pasoDe("comprometido")).toBe(0);
    expect(pasoDe("facturado")).toBe(1);
    expect(pasoDe("preparar_envio")).toBe(2);
    expect(pasoDe("despachado")).toBe(3);
    expect(pasoDe("entregado")).toBe(4);
  });

  it("dice de quién es el próximo paso", () => {
    expect(proximoPasoVenta({ pedido_estado: "comprometido" }).quien).toBe("vendedor");
    expect(proximoPasoVenta({ pedido_estado: "comprometido", forma_pago: "Contado (transferencia)" })).toEqual({
      quien: "administracion",
      texto: "Facturar",
    });
    expect(proximoPasoVenta({ pedido_estado: "facturado" }, { cobro_estado: "pendiente" }).texto).toMatch(/cobro/);
    expect(proximoPasoVenta({ pedido_estado: "preparar_envio" }).quien).toBe("deposito");
    expect(proximoPasoVenta({ pedido_estado: "despachado" }).quien).toBe("vendedor");
    expect(proximoPasoVenta({ pedido_estado: "entregado" }).quien).toBe("nadie");
  });

  it("mide el atraso de las facturas impagas", () => {
    const facturas = [
      { vencimiento: "2026-09-01", cobro_estado: "pendiente" },
      { vencimiento: "2026-08-01", cobro_estado: "cobrado" },
      { vencimiento: "2026-09-20", cobro_estado: "prometido" },
      { vencimiento: null, cobro_estado: "pendiente" },
    ];
    expect(atrasoMaximo(facturas, "2026-10-01")).toBe(30);
    expect(atrasoMaximo([{ vencimiento: "2026-10-05", cobro_estado: "pendiente" }], "2026-10-01")).toBe(0);
  });

  it("agenda la postventa: día 10 siempre; 2 y 30 con instalación", () => {
    expect(diasPostventa(false).map((p) => p.dias)).toEqual([10]);
    expect(diasPostventa(true).map((p) => p.dias)).toEqual([2, 10, 30]);
  });
});
