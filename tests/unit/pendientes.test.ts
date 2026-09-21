import { describe, it, expect } from "vitest";
import { clasificarPendientes, NOTA_LLEGO_STOCK } from "@/lib/pendientes";

const HOY = "2026-09-20";
const base = {
  etapa: "nueva",
  temperatura: null as string | null,
  proximo_contacto: null as string | null,
  proximo_nota: null as string | null,
  ultimo_movimiento_at: "2026-09-19T10:00:00.000Z" as string | null,
};

describe("clasificarPendientes", () => {
  it("reparte por fecha: atrasados, hoy, próximos 7 días, y deja afuera lo lejano", () => {
    const b = clasificarPendientes(
      [
        { ...base, id: "a", proximo_contacto: "2026-09-18" },
        { ...base, id: "b", proximo_contacto: "2026-09-20" },
        { ...base, id: "c", proximo_contacto: "2026-09-24" },
        { ...base, id: "d", proximo_contacto: "2026-09-27" },
        { ...base, id: "e", proximo_contacto: "2026-09-28" },
      ],
      HOY
    );
    expect(b.atrasados.map((i) => i.id)).toEqual(["a"]);
    expect(b.hoy.map((i) => i.id)).toEqual(["b"]);
    expect(b.proximos.map((i) => i.id)).toEqual(["c", "d"]);
    expect(b.sinFecha).toEqual([]);
  });

  it("el más atrasado va primero y Hoy ordena por nivel (Muy interesado primero)", () => {
    const b = clasificarPendientes(
      [
        { ...base, id: "x", proximo_contacto: "2026-09-15" },
        { ...base, id: "y", proximo_contacto: "2026-09-10" },
        { ...base, id: "frio", proximo_contacto: HOY, temperatura: "frio" },
        { ...base, id: "caliente", proximo_contacto: HOY, temperatura: "caliente" },
        { ...base, id: "sin", proximo_contacto: HOY, temperatura: null },
        { ...base, id: "tibio", proximo_contacto: HOY, temperatura: "tibio" },
      ],
      HOY
    );
    expect(b.atrasados.map((i) => i.id)).toEqual(["y", "x"]);
    expect(b.hoy.map((i) => i.id)).toEqual(["caliente", "tibio", "frio", "sin"]);
  });

  it("Llegó stock manda sobre la fecha y solo para lista de espera", () => {
    const b = clasificarPendientes(
      [
        { ...base, id: "ok", etapa: "espera", proximo_contacto: HOY, proximo_nota: NOTA_LLEGO_STOCK },
        { ...base, id: "no", etapa: "seguimiento", proximo_contacto: HOY, proximo_nota: NOTA_LLEGO_STOCK },
      ],
      HOY
    );
    expect(b.llegoStock.map((i) => i.id)).toEqual(["ok"]);
    expect(b.hoy.map((i) => i.id)).toEqual(["no"]);
  });

  it("Sin fecha: solo intereses sin movimiento hace más de 7 días, el más viejo primero", () => {
    const b = clasificarPendientes(
      [
        { ...base, id: "reciente", ultimo_movimiento_at: "2026-09-18T12:00:00.000Z" },
        { ...base, id: "viejo", ultimo_movimiento_at: "2026-08-01T12:00:00.000Z" },
        { ...base, id: "medio", ultimo_movimiento_at: "2026-09-01T12:00:00.000Z" },
        { ...base, id: "nunca", ultimo_movimiento_at: null },
      ],
      HOY
    );
    expect(b.sinFecha.map((i) => i.id)).toEqual(["nunca", "viejo", "medio"]);
  });

  it("ignora vendidos y no se dio", () => {
    const b = clasificarPendientes(
      [
        { ...base, id: "g", etapa: "ganada", proximo_contacto: "2026-09-01" },
        { ...base, id: "p", etapa: "perdida", proximo_contacto: HOY },
      ],
      HOY
    );
    expect(b.atrasados).toEqual([]);
    expect(b.hoy).toEqual([]);
  });
});
