import { describe, it, expect } from "vitest";
import { atrasoMaximo, diasPostventa, pasoDe, proximoPasoVenta } from "@/lib/ventas";
import { evaluarFueraDeLista } from "@/lib/propuestas";

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

describe("propuesta fuera de lista", () => {
  const lista = [
    { id: "a", nombre: "Zumex Speed", precio_referencia: 1000, moneda: "USD" },
    { id: "b", nombre: "Licuadora", precio_referencia: 500, moneda: "ARS" },
  ];
  it("a precio de lista no requiere aprobación", () => {
    expect(evaluarFueraDeLista([{ productoId: "a", descripcion: "", cantidad: 1, precioUnit: 1000 }], lista, "USD", 0, false).requiere).toBe(false);
  });
  it("cualquier descuento requiere aprobación si el margen libre es 0", () => {
    const r = evaluarFueraDeLista([{ productoId: "a", descripcion: "", cantidad: 1, precioUnit: 950 }], lista, "USD", 0, false);
    expect(r.requiere).toBe(true);
    expect(r.motivos[0]).toMatch(/5% por debajo/);
  });
  it("respeta el descuento libre y la moneda", () => {
    expect(evaluarFueraDeLista([{ productoId: "a", descripcion: "", cantidad: 1, precioUnit: 950 }], lista, "USD", 5, false).requiere).toBe(false);
    expect(evaluarFueraDeLista([{ productoId: "b", descripcion: "", cantidad: 1, precioUnit: 10 }], lista, "USD", 0, false).requiere).toBe(false);
  });
  it("la condición especial siempre pasa por dirección", () => {
    expect(evaluarFueraDeLista([], lista, "USD", 0, true).requiere).toBe(true);
  });
});
