import { describe, it, expect } from "vitest";
import {
  rangoPeriodo,
  ponderar,
  tasa,
  variacion,
  calcularTablero,
  cotizacionesCaidas,
  listaDe,
  SIN_ASIGNAR,
  type DatosTablero,
  type OppFila,
} from "@/lib/tablero";

const HOY = "2026-09-25";
const AHORA = Date.parse("2026-09-25T15:00:00Z");

function opp(p: Partial<OppFila> & { id: string }): OppFila {
  return {
    cliente_id: `c-${p.id}`,
    comercial_id: null,
    producto_id: null,
    linea: "equipos",
    etapa: "nueva",
    temperatura: null,
    origen: "WhatsApp",
    monto_estimado: null,
    moneda: "ARS",
    motivo_perdida: null,
    proximo_contacto: null,
    proximo_nota: null,
    ultimo_movimiento_at: "2026-09-24T15:00:00Z",
    created_at: "2026-09-10T15:00:00Z",
    closed_at: null,
    nombre: `Contacto ${p.id}`,
    telefono: null,
    producto: null,
    interes: "Interés",
    ...p,
  };
}

const usuarios = [
  { id: "marcelo", nombre: "Marcelo", rol: "comercial", activo: true },
  { id: "clara", nombre: "Clara", rol: "comercial", activo: true },
  { id: "prueba", nombre: "Comercial Prueba", rol: "comercial", activo: true },
];

describe("rangoPeriodo", () => {
  it("este mes se compara con el mes pasado al mismo día", () => {
    const p = rangoPeriodo("mes", HOY);
    expect(p.desde).toBe("2026-09-01");
    expect(p.hasta).toBe("2026-10-01");
    expect(p.antDesde).toBe("2026-08-01");
    expect(p.antHasta).toBe("2026-08-26");
  });
  it("mes pasado se compara con el mes anterior completo", () => {
    const p = rangoPeriodo("mes_pasado", HOY);
    expect([p.desde, p.hasta, p.antDesde, p.antHasta]).toEqual(["2026-08-01", "2026-09-01", "2026-07-01", "2026-08-01"]);
  });
  it("en enero el mes pasado es diciembre del año anterior", () => {
    const p = rangoPeriodo("mes_pasado", "2027-01-10");
    expect([p.desde, p.hasta]).toEqual(["2026-12-01", "2027-01-01"]);
  });
  it("semana pasada va de lunes a lunes", () => {
    const p = rangoPeriodo("semana_pasada", "2026-09-28"); // lunes
    expect([p.desde, p.hasta, p.antDesde, p.antHasta]).toEqual(["2026-09-21", "2026-09-28", "2026-09-14", "2026-09-21"]);
    expect(rangoPeriodo("semana_pasada", "2026-10-04").desde).toBe("2026-09-21"); // domingo
  });
  it("este año se corta al mismo día del año anterior", () => {
    const p = rangoPeriodo("anio", HOY);
    expect([p.desde, p.antDesde]).toEqual(["2026-01-01", "2025-01-01"]);
    expect(p.antHasta).toBe("2025-09-26");
  });
});

describe("cuentas", () => {
  it("pondera por etapa sin mezclar monedas", () => {
    expect(
      ponderar([
        { etapa: "nueva", monto_estimado: 1000, moneda: "USD" },
        { etapa: "cotizada", monto_estimado: 100, moneda: "ARS" },
        { etapa: "espera", monto_estimado: 1000, moneda: "USD" },
        { etapa: "seguimiento", monto_estimado: null, moneda: "ARS" },
      ])
    ).toEqual({ USD: 800, ARS: 30 });
  });
  it("tasa de cierre y variación", () => {
    expect(tasa(3, 1)).toBe(0.75);
    expect(tasa(0, 0)).toBeNull();
    expect(variacion(12, 10)).toBeCloseTo(0.2);
    expect(variacion(5, 0)).toBeNull();
  });
});

describe("calcularTablero", () => {
  const datos: DatosTablero = {
    abiertas: [
      opp({ id: "a1", comercial_id: "marcelo", proximo_contacto: "2026-09-20", monto_estimado: 1000, moneda: "USD", etapa: "cotizada" }),
      opp({ id: "a2", comercial_id: "marcelo", proximo_contacto: HOY }),
      opp({ id: "a3", comercial_id: "clara", ultimo_movimiento_at: "2026-09-01T15:00:00Z" }),
      opp({ id: "a4", comercial_id: null, proximo_contacto: "2026-09-24" }),
      opp({ id: "w1", origen: "Web", created_at: "2026-09-23T15:00:00Z" }),
      opp({ id: "w2", origen: "Web", created_at: "2026-09-23T15:00:00Z" }),
      opp({ id: "e1", comercial_id: "clara", etapa: "espera", producto_id: "jl15", proximo_contacto: "2026-10-10" }),
    ],
    recientes: [
      opp({ id: "v1", comercial_id: "marcelo", etapa: "ganada", closed_at: "2026-09-15T15:00:00Z", created_at: "2026-09-05T15:00:00Z", monto_estimado: 500, moneda: "USD" }),
      opp({ id: "v2", comercial_id: "clara", linea: "consumibles", etapa: "ganada", origen: "Venta directa", closed_at: "2026-09-12T15:00:00Z", created_at: "2026-09-12T15:00:00Z", monto_estimado: 900000 }),
      opp({ id: "v3", comercial_id: "marcelo", etapa: "ganada", closed_at: "2026-08-10T15:00:00Z", created_at: "2026-08-01T15:00:00Z", monto_estimado: 300, moneda: "USD" }),
      opp({ id: "p1", comercial_id: "clara", etapa: "perdida", motivo_perdida: "Precio", closed_at: "2026-09-18T15:00:00Z" }),
    ],
    cotizaciones: [
      { id: "k1", oportunidad_id: "v1", created_at: "2026-09-08T15:00:00Z", total: 500, moneda: "USD", vigencia_dias: 7, version_at: "2026-09-08T15:00:00Z" },
      { id: "k2", oportunidad_id: "a1", created_at: "2026-09-10T15:00:00Z", total: 1000, moneda: "USD", vigencia_dias: 7, version_at: "2026-09-10T15:00:00Z" },
    ],
    actividades: [
      { cliente_id: "c-a1", created_by: "marcelo", created_at: "2026-09-20T15:00:00Z" },
      { cliente_id: "c-a2", created_by: "marcelo", created_at: "2026-09-21T15:00:00Z" },
      { cliente_id: "c-a2", created_by: "marcelo", created_at: "2026-09-22T15:00:00Z" },
      { cliente_id: "c-a3", created_by: "clara", created_at: "2026-08-20T15:00:00Z" },
    ],
    webAtendidas: ["w2"],
    stock: { jl15: { nombre: "JL15", stock: 3 } },
    usuarios,
  };
  const per = rangoPeriodo("mes", HOY);
  const t = calcularTablero(datos, per, {}, HOY, AHORA);

  it("separa por apartado (equipos, consumibles) sin mezclar monedas", () => {
    const equipos = calcularTablero(datos, per, { linea: "equipos" }, HOY, AHORA);
    expect(equipos.negocio.vendidos).toBe(1);
    expect(equipos.negocio.vendido).toEqual({ USD: 500 });
    const consumibles = calcularTablero(datos, per, { linea: "consumibles" }, HOY, AHORA);
    expect(consumibles.negocio.vendidos).toBe(1);
    expect(consumibles.negocio.vendido).toEqual({ ARS: 900000 });
    expect(consumibles.negocio.abiertos).toBe(0);
  });

  it("resume el negocio por moneda", () => {
    expect(t.negocio.abiertos).toBe(7);
    expect(t.negocio.montoAbierto).toEqual({ USD: 1000 });
    expect(t.negocio.ponderado).toEqual({ USD: 300 });
    expect(t.negocio.vendidos).toBe(2);
    expect(t.negocio.vendido).toEqual({ USD: 500, ARS: 900000 });
    expect(t.negocio.vendidosAnt).toBe(1);
    expect(t.negocio.atrasados).toBe(2);
    expect(t.negocio.tasaCierre).toBeCloseTo(2 / 3);
  });

  it("arma la tabla por vendedor con sin asignar al final y sin filas vacías", () => {
    const ids = t.vendedores.map((v) => v.id);
    expect(ids[ids.length - 1]).toBe(SIN_ASIGNAR);
    expect(ids).not.toContain("prueba");
    const marcelo = t.vendedores.find((v) => v.id === "marcelo")!;
    expect(marcelo).toMatchObject({ atendidos: 2, abiertos: 2, atrasados: 1, masViejo: 5, vendidos: 1, vendidosAnt: 1 });
    const clara = t.vendedores.find((v) => v.id === "clara")!;
    expect(clara).toMatchObject({ quietos: 1, atendidos: 0, atendidosAnt: 1, vendidos: 1 });
  });

  it("levanta las alertas", () => {
    const tipos = t.alertas.map((a) => a.tipo);
    expect(tipos.filter((x) => x === "atrasados")).toHaveLength(2);
    expect(t.alertas.find((a) => a.tipo === "sin_responder")?.cantidad).toBe(1);
    expect(t.alertas.find((a) => a.tipo === "cotizacion_caida")).toBeUndefined();
    expect(t.alertas.find((a) => a.tipo === "stock_espera")?.texto).toBe("Hay 3 JL15 en stock y 1 espera");
  });

  it("calcula el ciclo sin contar ventas directas", () => {
    expect(t.ciclo).toEqual({ aCotizar: 3, aVender: 7, total: 10, ventas: 1 });
    expect(t.motivos).toEqual([{ nombre: "Precio", valor: 1, detalle: "" }]);
  });

  it("el filtro por vendedor cambia todos los números", () => {
    const f = calcularTablero(datos, per, { vendedor: "marcelo" }, HOY, AHORA);
    expect(f.negocio.abiertos).toBe(2);
    expect(f.negocio.vendidos).toBe(1);
    expect(f.vendedores.map((v) => v.id)).toEqual(["marcelo"]);
  });

  it("detecta la cotización caída cuando no hubo movimiento después de vencer", () => {
    const caida = opp({ id: "a1", etapa: "cotizada", ultimo_movimiento_at: "2026-09-12T15:00:00Z" });
    expect(cotizacionesCaidas([caida], datos.cotizaciones, HOY).map((o) => o.id)).toEqual(["a1"]);
    const seguida = { ...caida, ultimo_movimiento_at: "2026-09-20T15:00:00Z" };
    expect(cotizacionesCaidas([seguida], datos.cotizaciones, HOY)).toEqual([]);
  });

  it("la lista de atrasados de un vendedor trae solo los suyos, el más viejo primero", () => {
    const l = listaDe("atrasados", "marcelo", datos, per, {}, HOY, AHORA);
    expect(l.filas.map((o) => o.id)).toEqual(["a1"]);
    expect(l.detalle(l.filas[0])).toBe("hace 5 días");
  });
});
