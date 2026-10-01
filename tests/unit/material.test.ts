import { describe, expect, it } from "vitest";
import { aceptaArchivo, buscarMaterial, normalizar, slugDe } from "@/lib/material";

const datos = {
  marcas: [
    { id: "m1", nombre: "GASTROWARE", slug: "gastroware" },
    { id: "m2", nombre: "JETINNO", slug: "jetinno" },
  ],
  categorias: [
    { id: "c1", marca_id: "m1", nombre: "LICUADORAS", seccion: "productos" },
    { id: "c2", marca_id: "m2", nombre: "CAFETERAS", seccion: "productos" },
  ],
  productos: [
    { id: "p1", categoria_id: "c1", nombre: "GX18", slug: "gx18" },
    { id: "p2", categoria_id: "c2", nombre: "JL15", slug: "jl15" },
  ],
};

describe("material", () => {
  it("normaliza y arma slugs", () => {
    expect(normalizar("  Cómo LAVAR ")).toBe("como lavar");
    expect(slugDe("Speed S+Plus Tank")).toBe("speed-s-plus-tank");
    expect(slugDe("Soul Series 2")).toBe("soul-series-2");
  });

  it("buscador: producto con su ruta, sin tildes ni mayúsculas", () => {
    const r = buscarMaterial("gx 18", datos);
    expect(r[0]).toEqual({ tipo: "producto", titulo: "GX18", ruta: ["GASTROWARE", "LICUADORAS", "GX18"], href: "/material/gastroware/gx18" });
    expect(buscarMaterial("licuadóras", datos)[0].tipo).toBe("categoria");
    expect(buscarMaterial("jetinno", datos).some((x) => x.tipo === "marca")).toBe(true);
    expect(buscarMaterial("", datos)).toEqual([]);
  });

  it("qué acepta cada espacio", () => {
    expect(aceptaArchivo("videos", { name: "a.mp4", type: "video/mp4" })).toBeNull();
    expect(aceptaArchivo("videos", { name: "a.jpg", type: "image/jpeg" })).toMatch(/no es un video/);
    expect(aceptaArchivo("ficha", { name: "ficha.pdf", type: "" })).toBeNull();
    expect(aceptaArchivo("ficha", { name: "ficha.docx", type: "application/msword" })).toMatch(/PDF/);
    expect(aceptaArchivo("tipografias", { name: "fuente.otf", type: "" })).toBeNull();
  });
});
