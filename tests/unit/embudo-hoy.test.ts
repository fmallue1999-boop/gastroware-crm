import { describe, it, expect } from "vitest";
import { COLUMNAS_EMBUDO, repartirColumnas, tocaHoy, type TarjetaEmbudo } from "@/lib/embudo";

const HOY = "2026-10-02";
const base: TarjetaEmbudo = {
  id: "x",
  cliente_id: "c",
  nombre: "Cliente",
  telefono: null,
  interes: "Zumex",
  nivel: null,
  etapa: "nueva",
  proximo_contacto: null,
  proximo_hora: null,
  proxima_accion: null,
  proximo_nota: null,
  ultimo_movimiento_at: null,
  monto: null,
  moneda: "USD",
  pedido_estado: null,
  closed_at: null,
  created_at: "2026-10-01T10:00:00Z",
  comercial_id: null,
};
const t = (o: Partial<TarjetaEmbudo>) => ({ ...base, ...o });

describe("embudo: columna Para hoy (v1.21)", () => {
  it("es la primera columna", () => {
    expect(COLUMNAS_EMBUDO[0]).toEqual({ key: "hoy", label: "Para hoy" });
  });

  it("toca hoy: vencido hoy o antes, o llegó stock", () => {
    expect(tocaHoy(t({ proximo_contacto: HOY }), HOY)).toBe(true);
    expect(tocaHoy(t({ proximo_contacto: "2026-09-30" }), HOY)).toBe(true);
    expect(tocaHoy(t({ proximo_contacto: "2026-10-03" }), HOY)).toBe(false);
    expect(tocaHoy(t({ proximo_contacto: null }), HOY)).toBe(false);
    expect(tocaHoy(t({ etapa: "espera", proximo_nota: "Llegó stock", proximo_contacto: "2026-10-20" }), HOY)).toBe(true);
  });

  it("lo que toca hoy sale de su etapa; el resto queda en su columna", () => {
    const c = repartirColumnas(
      [
        t({ id: "hoy-cotizado", etapa: "cotizada", proximo_contacto: HOY }),
        t({ id: "futuro-cotizado", etapa: "cotizada", proximo_contacto: "2026-10-09" }),
        t({ id: "sin-fecha", etapa: "nueva" }),
        t({ id: "atrasado-seg", etapa: "seguimiento", proximo_contacto: "2026-09-28" }),
      ],
      HOY
    );
    expect(c.hoy.map((x) => x.id)).toEqual(["atrasado-seg", "hoy-cotizado"]);
    expect(c.cotizada.map((x) => x.id)).toEqual(["futuro-cotizado"]);
    expect(c.nueva.map((x) => x.id)).toEqual(["sin-fecha"]);
    expect(c.seguimiento).toEqual([]);
  });

  it("orden en Para hoy: atrasados, hoy por hora y nivel, y al final los ya contactados hoy", () => {
    const c = repartirColumnas(
      [
        t({ id: "contactado", proximo_contacto: "2026-09-25", contactado_hoy: true }),
        t({ id: "hoy-tarde", proximo_contacto: HOY, proximo_hora: "16:00:00" }),
        t({ id: "hoy-frio", proximo_contacto: HOY, nivel: "frio" }),
        t({ id: "hoy-caliente", proximo_contacto: HOY, nivel: "caliente" }),
        t({ id: "atrasado", proximo_contacto: "2026-09-30" }),
      ],
      HOY
    );
    expect(c.hoy.map((x) => x.id)).toEqual(["atrasado", "hoy-caliente", "hoy-frio", "hoy-tarde", "contactado"]);
  });
});
