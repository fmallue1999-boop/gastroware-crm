import { describe, it, expect } from "vitest";
import { apartadoPorProducto, textoStock, unidadesDeVenta, type InfoStock } from "@/lib/stock";

const fecha = (iso: string | null) => (iso ? `[${iso}]` : "—");
const info = (o: Partial<InfoStock>): InfoStock => {
  const stock = o.stock ?? 0;
  const apartado = o.apartado ?? 0;
  return { stock, apartado, disponible: stock - apartado, proximo: null, enEspera: 0, ...o };
};

describe("textoStock", () => {
  it("con stock dice cuántos hay", () => {
    expect(textoStock(info({ stock: 3 }), fecha)).toBe("Hay 3");
  });
  it("sin stock y con ingreso previsto dice cuántos llegan y cuándo", () => {
    expect(textoStock(info({ stock: 0, proximo: { cantidad: 5, fecha: "2026-09-20" }, enEspera: 2 }), fecha)).toBe(
      "Sin stock, llegan 5 el [2026-09-20]"
    );
  });
  it("sin fecha del ingreso, a confirmar", () => {
    expect(textoStock(info({ stock: 0, proximo: { cantidad: 2, fecha: null } }), fecha)).toBe("Sin stock, llegan 2 (fecha a confirmar)");
  });
  it("sin stock ni ingreso previsto", () => {
    expect(textoStock(info({ stock: 0 }), fecha)).toBe("Sin stock, sin ingreso previsto");
  });
  it("sin información devuelve vacío", () => {
    expect(textoStock(undefined, fecha)).toBe("");
  });
});

describe("stock apartado para ventas sin entregar (v1.22)", () => {
  it("unidades de una venta: la cantidad de sus ítems o 1", () => {
    expect(
      unidadesDeVenta({
        producto_id: "pro",
        productos_extra: ["jl15"],
        items: [{ producto_id: "pro", cantidad: 4 }],
      })
    ).toEqual([
      { productoId: "pro", cantidad: 4 },
      { productoId: "jl15", cantidad: 1 },
    ]);
    expect(unidadesDeVenta({ producto_id: null, productos_extra: null, items: null })).toEqual([]);
  });

  it("suma lo apartado por producto entre todas las ventas", () => {
    expect(
      apartadoPorProducto([
        { producto_id: "pro", items: [{ producto_id: "pro", cantidad: "4" }] },
        { producto_id: "pro" },
        { producto_id: "basic", productos_extra: ["pro"] },
      ])
    ).toEqual({ pro: 6, basic: 1 });
  });

  it("hay stock con una parte apartada", () => {
    expect(textoStock(info({ stock: 5, apartado: 2 }), fecha)).toBe("Hay 3 disponibles (2 apartadas)");
  });

  it("todo lo que hay está apartado", () => {
    expect(textoStock(info({ stock: 2, apartado: 2, proximo: { cantidad: 5, fecha: "2026-10-20" } }), fecha)).toBe(
      "Sin disponibles (2 apartadas), llegan 5 el [2026-10-20]"
    );
  });

  it("lo vendido sin stock sale de lo que llega", () => {
    expect(textoStock(info({ stock: 0, apartado: 4, proximo: { cantidad: 10, fecha: "2026-11-15" } }), fecha)).toBe(
      "Sin stock, llegan 10 el [2026-11-15] (4 ya vendidas)"
    );
    expect(textoStock(info({ stock: 1, apartado: 3 }), fecha)).toBe("Sin disponibles (1 apartada), sin ingreso previsto (faltan 2 para lo vendido)");
  });
});

// fn_ajustar_stock(producto_id, delta) vive en la base (migración 026) y no
// tiene staging: se verifica a mano al aplicar la migración con
//   select fn_ajustar_stock('<id de un producto>', 0);
// que devuelve el stock actual sin cambiarlo.
