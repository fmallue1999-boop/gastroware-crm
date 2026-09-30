import { describe, expect, it } from "vitest";
import {
  conParams,
  cuentasDelFiltro,
  diaSemanaCorto,
  fechaDMY,
  lunesDe,
  moverPeriodo,
  ordenarEnCelda,
  ordenNatural,
  rangoMes,
  rangoSemana,
} from "@/lib/contenidos";

describe("calendario de contenidos", () => {
  it("rango del mes", () => {
    expect(rangoMes("2026-02-15").dias).toHaveLength(28);
    expect(rangoMes("2028-02-03").dias).toHaveLength(29);
    const oct = rangoMes("2026-10-20");
    expect(oct.desde).toBe("2026-10-01");
    expect(oct.hasta).toBe("2026-10-31");
    expect(oct.dias).toHaveLength(31);
  });

  it("la semana empieza el lunes", () => {
    expect(lunesDe("2026-10-04")).toBe("2026-09-28"); // domingo
    expect(lunesDe("2026-09-28")).toBe("2026-09-28"); // lunes
    const s = rangoSemana("2026-10-01");
    expect(s.dias[0]).toBe("2026-09-28");
    expect(s.dias[6]).toBe("2026-10-04");
    expect(diaSemanaCorto("2026-09-28")).toBe("LUN");
  });

  it("anterior y siguiente", () => {
    expect(moverPeriodo("mes", "2026-12-15", 1)).toBe("2027-01-01");
    expect(moverPeriodo("mes", "2026-03-31", -1)).toBe("2026-02-01");
    expect(moverPeriodo("semana", "2026-10-01", 1)).toBe("2026-10-05");
  });

  it("filtro de cuenta con colaboraciones", () => {
    expect(cuentasDelFiltro("zumex")).toEqual(["zumex", "colaboracion"]);
    expect(cuentasDelFiltro("todas")).toBeNull();
  });

  it("orden natural de archivos", () => {
    const n = ordenNatural([{ nombre: "10_cierre.mp4" }, { nombre: "02_producto.jpg" }, { nombre: "01_portada.jpg" }, { nombre: "09_x.jpg" }]).map((a) => a.nombre);
    expect(n).toEqual(["01_portada.jpg", "02_producto.jpg", "09_x.jpg", "10_cierre.mp4"]);
  });

  it("orden dentro de la celda: cuenta, nombre, carga", () => {
    const r = ordenarEnCelda([
      { cuenta: "colaboracion", nombre: "A", created_at: "1" },
      { cuenta: "zumex", nombre: "B", created_at: "2" },
      { cuenta: "gastroware", nombre: "Z", created_at: "3" },
      { cuenta: "zumex", nombre: "A", created_at: "4" },
    ]).map((x) => `${x.cuenta}:${x.nombre}`);
    expect(r).toEqual(["gastroware:Z", "zumex:A", "zumex:B", "colaboracion:A"]);
  });

  it("fechas y links", () => {
    expect(fechaDMY("2026-10-05")).toBe("05/10/2026");
    expect(conParams("/contenidos", { vista: "mes", estado: "pendiente" }, { ficha: "abc", estado: null })).toBe("/contenidos?vista=mes&ficha=abc");
  });
});
