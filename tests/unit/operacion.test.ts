import { describe, it, expect } from "vitest";
import { primerContacto, textoMinutos, ventasPorTerritorio } from "@/lib/operacion";

describe("operación del manual", () => {
  it("primer contacto: mediana, % en la hora y sin contacto", () => {
    const r = primerContacto([
      { asignado_at: "2026-10-01T13:00:00Z", primer_contacto_at: "2026-10-01T13:20:00Z" },
      { asignado_at: "2026-10-01T13:00:00Z", primer_contacto_at: "2026-10-01T15:00:00Z" },
      { asignado_at: "2026-10-01T13:00:00Z", primer_contacto_at: "2026-10-01T13:40:00Z" },
      { asignado_at: "2026-10-01T13:00:00Z", primer_contacto_at: null },
    ]);
    expect(r.medianaMin).toBe(40);
    expect(r.pctEnLaHora).toBe(50);
    expect(r.sinContacto).toBe(1);
    expect(textoMinutos(40)).toBe("40 min");
    expect(textoMinutos(180)).toBe("3 h");
  });
  it("ventas por territorio sin mezclar monedas", () => {
    const r = ventasPorTerritorio(
      [
        { territorio: "amba", monto_estimado: 100, moneda: "USD" },
        { territorio: "amba", monto_estimado: 50, moneda: "ARS" },
        { territorio: null, monto_estimado: 10, moneda: "USD" },
      ],
      { amba: "CABA y AMBA" }
    );
    expect(r[0]).toEqual({ nombre: "CABA y AMBA", cantidad: 2, montos: { USD: 100, ARS: 50 } });
    expect(r[1].nombre).toBe("Sin territorio");
  });
});
