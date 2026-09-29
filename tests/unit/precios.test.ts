import { describe, expect, it } from "vitest";
import { lineaDeProducto, monedaSugerida, monedasConPrecio, precioEn, productosDeLinea } from "@/lib/precios";
import { evaluarFueraDeLista } from "@/lib/propuestas";

describe("precios en pesos y dólares", () => {
  const zumex = { precio_ars: 9_500_000, precio_usd: 8_000, precio_referencia: 8_000, moneda: "USD" };
  const viejo = { precio_referencia: 1_200_000, moneda: "ARS" };

  it("precio en la moneda pedida", () => {
    expect(precioEn(zumex, "USD")).toBe(8_000);
    expect(precioEn(zumex, "ARS")).toBe(9_500_000);
    expect(precioEn(viejo, "ARS")).toBe(1_200_000);
    expect(precioEn(viejo, "USD")).toBeNull();
    expect(precioEn(null, "ARS")).toBeNull();
  });

  it("monedas con precio y sugerida", () => {
    expect(monedasConPrecio(zumex)).toEqual(["USD", "ARS"]);
    expect(monedasConPrecio(viejo)).toEqual(["ARS"]);
    expect(monedaSugerida(viejo, "USD")).toBe("ARS");
    expect(monedaSugerida(zumex, "ARS")).toBe("ARS");
  });

  it("fuera de lista compara contra el precio en la moneda de la cotización", () => {
    const lista = [{ id: "z", nombre: "Zumex", ...zumex }];
    const enPesos = evaluarFueraDeLista([{ productoId: "z", descripcion: "Zumex", cantidad: 1, precioUnit: 8_000_000 }], lista, "ARS", 5, false);
    expect(enPesos.requiere).toBe(true);
    const enDolares = evaluarFueraDeLista([{ productoId: "z", descripcion: "Zumex", cantidad: 1, precioUnit: 7_900 }], lista, "USD", 5, false);
    expect(enDolares.requiere).toBe(false);
  });
});

describe("apartado de cada producto", () => {
  it("equipos, consumibles y repuestos", () => {
    expect(lineaDeProducto({ es_consumible: true, categoria: "consumible" })).toBe("consumibles");
    expect(lineaDeProducto({ es_consumible: false, categoria: "repuesto" })).toBe("repuestos");
    expect(lineaDeProducto({ es_consumible: false, categoria: "refaccion" })).toBe("repuestos");
    expect(lineaDeProducto({ es_consumible: false, categoria: "exprimidora" })).toBe("equipos");
    const lista = [
      { id: 1, es_consumible: false, categoria: "horno" },
      { id: 2, es_consumible: true, categoria: "consumible" },
      { id: 3, es_consumible: false, categoria: "repuesto" },
    ];
    expect(productosDeLinea(lista, "equipos").map((p) => p.id)).toEqual([1]);
    expect(productosDeLinea(lista, null).map((p) => p.id)).toEqual([1]);
    expect(productosDeLinea(lista, "repuestos").map((p) => p.id)).toEqual([3]);
  });
});
