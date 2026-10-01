import { describe, expect, it } from "vitest";
import { calcularTotales, diasEnLetras, enLetras, leyendaDolar, montoPdf, nombreArchivo, numeroComprobante, tipoAnexo } from "@/lib/cotizacion-pdf";

describe("cotización en PDF", () => {
  it("número de comprobante", () => {
    expect(numeroComprobante("0007", 315)).toBe("0007 - 00000315");
    expect(numeroComprobante("7", 1)).toBe("0007 - 00000001");
    expect(numeroComprobante(null, 12)).toBe("0000 - 00000012");
  });

  it("totales: neto + IVA 10,5% (el ejemplo)", () => {
    const t = calcularTotales(
      [
        { cantidad: 1, precio_unit: 6611 },
        { cantidad: 1, precio_unit: 8077.6 },
      ],
      { total: 14688.6, iva_pct: 10.5 }
    );
    expect(t.subtotal).toBe(14688.6);
    expect(t.descuento).toBe(0);
    expect(t.neto).toBe(14688.6);
    expect(t.iva).toBe(1542.3);
    expect(t.total).toBe(16230.9);
  });

  it("totales con descuento especial y sin IVA", () => {
    const t = calcularTotales([{ cantidad: 2, precio_unit: 1000 }], { total: 1900, subtotal: 2000, descuento_pct: 5, iva_pct: null });
    expect(t.descuento).toBe(100);
    expect(t.neto).toBe(1900);
    expect(t.iva).toBe(0);
    expect(t.total).toBe(1900);
  });

  it("IVA por producto: 10,5% y 21% por separado", () => {
    const t = calcularTotales(
      [
        { cantidad: 1, precio_unit: 1000, iva_pct: 10.5 },
        { cantidad: 2, precio_unit: 100, iva_pct: 21 },
      ],
      { total: 1200 }
    );
    expect(t.ivas).toEqual([
      { pct: 10.5, monto: 105 },
      { pct: 21, monto: 42 },
    ]);
    expect(t.iva).toBe(147);
    expect(t.total).toBe(1347);
    expect(t.ivaPct).toBe(0);
  });

  it("IVA por producto con descuento especial", () => {
    const t = calcularTotales([{ cantidad: 1, precio_unit: 1000, iva_pct: 21 }], { total: 900, subtotal: 1000, descuento_pct: 10 });
    expect(t.ivas).toEqual([{ pct: 21, monto: 189 }]);
    expect(t.total).toBe(1089);
  });

  it("sin líneas vale el monto guardado", () => {
    expect(calcularTotales([], { total: 500, iva_pct: 21 }).total).toBe(605);
  });

  it("importes y leyenda del dólar", () => {
    expect(montoPdf(12927.39, "USD")).toBe("US$ 12.927,39");
    expect(montoPdf(1405, "ARS")).toBe("$ 1.405,00");
    expect(leyendaDolar("El monto de los ítems equivale a {total}. Resto.", 12927.39)).toBe(
      "El monto de los ítems equivale a US$12.927,39. Resto."
    );
  });

  it("días en letras", () => {
    expect(diasEnLetras(7)).toBe("7 (siete) días");
    expect(diasEnLetras(1)).toBe("1 (un) día");
    expect(diasEnLetras(21)).toBe("21 (veintiún) días");
    expect(enLetras(45)).toBe("cuarenta y cinco");
    expect(enLetras(100)).toBe("cien");
    expect(enLetras(115)).toBe("ciento quince");
  });

  it("nombre del archivo y anexos", () => {
    expect(nombreArchivo("0007 - 00000315", "Nuevo Plaza Hotel S.A.", 1)).toBe("COT 0007-00000315 Nuevo Plaza Hotel S.A.pdf");
    expect(nombreArchivo("0007 - 00000315", "Café Ñandú / Sucursal", 2)).toBe("COT 0007-00000315 v2 Cafe Nandu Sucursal.pdf");
    expect(tipoAnexo("producto/x/ficha.PDF")).toBe("pdf");
    expect(tipoAnexo("a.jpeg")).toBe("jpg");
    expect(tipoAnexo("a.docx")).toBeNull();
  });
});
