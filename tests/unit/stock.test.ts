import { describe, it, expect } from "vitest";
import { textoStock } from "@/lib/stock";

const fecha = (iso: string | null) => (iso ? `[${iso}]` : "—");

describe("textoStock", () => {
  it("con stock dice cuántos hay", () => {
    expect(textoStock({ stock: 3, proximo: null, enEspera: 0 }, fecha)).toBe("Hay 3");
  });
  it("sin stock y con ingreso previsto dice cuántos llegan y cuándo", () => {
    expect(
      textoStock({ stock: 0, proximo: { cantidad: 5, fecha: "2026-09-20" }, enEspera: 2 }, fecha)
    ).toBe("Sin stock, llegan 5 el [2026-09-20]");
  });
  it("sin fecha del ingreso, a confirmar", () => {
    expect(textoStock({ stock: 0, proximo: { cantidad: 2, fecha: null }, enEspera: 0 }, fecha)).toBe(
      "Sin stock, llegan 2 (fecha a confirmar)"
    );
  });
  it("sin stock ni ingreso previsto", () => {
    expect(textoStock({ stock: 0, proximo: null, enEspera: 0 }, fecha)).toBe(
      "Sin stock, sin ingreso previsto"
    );
  });
  it("sin información devuelve vacío", () => {
    expect(textoStock(undefined, fecha)).toBe("");
  });
});

// fn_ajustar_stock(producto_id, delta) vive en la base (migración 026) y no
// tiene staging: se verifica a mano al aplicar la migración con
//   select fn_ajustar_stock('<id de un producto>', 0);
// que devuelve el stock actual sin cambiarlo.
