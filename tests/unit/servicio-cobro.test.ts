import { describe, it, expect } from "vitest";
import { conceptoFinal, conceptoSugerido, cuentaOT, horasACobrar, motivoCompleto, resumenTrabajo } from "@/lib/servicio-cobro";

describe("horas a cobrar (v1.27)", () => {
  it("automático: las trabajadas si es facturable; nada en garantía o contrato", () => {
    expect(horasACobrar({ cobertura: "facturable", horas_cobrar: null }, 90)).toBe(1.5);
    expect(horasACobrar({ cobertura: "garantia", horas_cobrar: null }, 90)).toBe(0);
    expect(horasACobrar({ cobertura: "contrato" }, 120)).toBe(0);
  });
  it("las que se ponen a mano mandan, también en garantía", () => {
    expect(horasACobrar({ cobertura: "garantia", horas_cobrar: 2 }, 90)).toBe(2);
    expect(horasACobrar({ cobertura: "facturable", horas_cobrar: 0 }, 90)).toBe(0);
    expect(horasACobrar({ cobertura: "facturable", horas_cobrar: "1.25" }, 90)).toBe(1.25);
  });
});

describe("cuenta de la orden (v1.27)", () => {
  const items = [
    { cantidad: 1, precio_unit: 5000, estado: "facturable", aprobado_admin: true },
    { cantidad: 2, precio_unit: 1000, estado: "facturable", aprobado_admin: false },
    { cantidad: 1, precio_unit: 9000, estado: "garantia", aprobado_admin: true },
  ];
  it("garantía con movilidad: se cobran las horas puestas + ítems facturables aprobados", () => {
    const c = cuentaOT({ cobertura: "garantia", horas_cobrar: 2, cobro_como: "movilidad" }, 60, 10000, items);
    expect(c).toMatchObject({ horasTrabajadas: 1, horas: 2, manual: true, manoObra: 20000, itemsTotal: 5000, total: 25000 });
  });
  it("garantía sin horas puestas: solo lo facturable", () => {
    expect(cuentaOT({ cobertura: "garantia", horas_cobrar: null }, 60, 10000, items).total).toBe(5000);
  });
});

describe("concepto para facturar (v1.27)", () => {
  it("lo que hizo el técnico, en pocas palabras", () => {
    expect(resumenTrabajo("Se cambió la luz del horno. Quedó andando.", "correctivo")).toBe("Cambio de luz del horno");
    expect(resumenTrabajo("Reemplacé la resistencia", "correctivo")).toBe("Reemplazo de resistencia");
    expect(resumenTrabajo("Limpieza general y prueba", "preventivo")).toBe("Limpieza general y prueba");
    expect(resumenTrabajo("cambio de luz\nprobado", "garantia")).toBe("Cambio de luz");
    expect(resumenTrabajo("", "preventivo")).toBe("Mantenimiento");
    expect(resumenTrabajo(null, "instalacion")).toBe("Instalación");
  });
  it("ST número - qué se hizo, por garantía y cómo se cobra; sin horas", () => {
    expect(conceptoSugerido({ numero: 123, trabajo: "Cambio de luz", tipo: "garantia", cobertura: "garantia", cobroComo: "movilidad", horas: 2 })).toBe(
      "ST 123 - Cambio de luz por garantía (Movilidad)"
    );
    expect(conceptoSugerido({ numero: 7, trabajo: "Reemplazo de resistencia", tipo: "correctivo", cobertura: "facturable", cobroComo: null, horas: 1.5 })).toBe(
      "ST 7 - Reemplazo de resistencia"
    );
    expect(conceptoSugerido({ numero: 8, trabajo: "Limpieza", tipo: "preventivo", cobertura: "contrato", cobroComo: null, horas: 1 })).toBe(
      "ST 8 - Limpieza por contrato (Mano de obra)"
    );
    expect(conceptoSugerido({ numero: 9, trabajo: "Cambio de luz", tipo: "garantia", cobertura: "garantia", cobroComo: "movilidad", horas: 0 })).toBe(
      "ST 9 - Cambio de luz por garantía"
    );
  });
  it("el escrito a mano gana sobre el sugerido", () => {
    const ot = { numero: 5, tipo: "garantia", cobertura: "garantia", trabajo_realizado: "Cambio de luz", cobro_como: "movilidad" };
    expect(conceptoFinal({ ...ot, concepto_factura: "ST 5 - Visita por garantía" }, 1)).toBe("ST 5 - Visita por garantía");
    expect(conceptoFinal({ ...ot, concepto_factura: "  " }, 1)).toBe("ST 5 - Cambio de luz por garantía (Movilidad)");
  });
});

describe("sin cargo y motivos (v1.28)", () => {
  it("sin cargo: se ve lo que salía y el total queda en $0", () => {
    const items = [{ cantidad: 1, precio_unit: 5000, estado: "facturable", aprobado_admin: true }];
    const c = cuentaOT({ cobertura: "facturable", horas_cobrar: 1, sin_cargo: true }, 60, 10000, items);
    expect(c).toMatchObject({ manoObra: 10000, itemsTotal: 5000, bonificado: 15000, total: 0 });
    expect(cuentaOT({ cobertura: "facturable", horas_cobrar: 1 }, 60, 10000, items)).toMatchObject({ bonificado: 0, total: 15000 });
  });
  it("el motivo: elegido + detalle; en 'Otro' el detalle es obligatorio", () => {
    expect(motivoCompleto("Cortesía al cliente", "cliente de años")).toBe("Cortesía al cliente: cliente de años");
    expect(motivoCompleto("Duplicada o cargada por error", "")).toBe("Duplicada o cargada por error");
    expect(motivoCompleto("Otro", "  ")).toBeNull();
    expect(motivoCompleto("Otro", "se mudó")).toBe("se mudó");
    expect(motivoCompleto("", "algo")).toBeNull();
  });
});
