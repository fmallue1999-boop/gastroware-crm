import { describe, it, expect } from "vitest";
import { clasificarFacturas, diasDeAtraso, mensajeReclamo } from "@/lib/cobranzas";

describe("cobranzas del día", () => {
  const hoy = "2026-10-01"; // jueves
  const f = (id: string, vencimiento: string | null, cobro_estado = "pendiente", promesa_fecha: string | null = null) => ({
    id,
    vencimiento,
    cobro_estado,
    promesa_fecha,
  });
  it("separa vencidas, hoy, 48 h hábiles, prometidas y al día", () => {
    const r = clasificarFacturas(
      [
        f("v1", "2026-09-10"),
        f("v2", "2026-09-30"),
        f("h", "2026-10-01"),
        f("48a", "2026-10-02"),
        f("48b", "2026-10-05"), // lunes: 2 hábiles desde el jueves
        f("ok", "2026-10-06"),
        f("p", "2026-09-20", "prometido", "2026-10-03"),
        f("c", "2026-09-01", "cobrado"),
      ],
      hoy
    );
    expect(r.vencidas.map((x) => x.id)).toEqual(["v1", "v2"]);
    expect(r.hoy.map((x) => x.id)).toEqual(["h"]);
    expect(r.en48.map((x) => x.id)).toEqual(["48a", "48b"]);
    expect(r.alDia.map((x) => x.id)).toEqual(["ok"]);
    expect(r.prometidas.map((x) => x.id)).toEqual(["p"]);
    expect(r.cobradas.map((x) => x.id)).toEqual(["c"]);
  });
  it("una promesa vencida vuelve a vencidas", () => {
    const r = clasificarFacturas([f("p", "2026-09-20", "prometido", "2026-09-28")], hoy);
    expect(r.vencidas.map((x) => x.id)).toEqual(["p"]);
  });
  it("días de atraso y mensaje", () => {
    expect(diasDeAtraso("2026-09-01", hoy)).toBe(30);
    expect(diasDeAtraso("2026-10-05", hoy)).toBe(0);
    expect(mensajeReclamo({ numero: "A 1", vencimiento: "2026-09-01", montoTexto: "$100" }, hoy)).toMatch(/venció el 01\/09\/2026/);
  });
});
