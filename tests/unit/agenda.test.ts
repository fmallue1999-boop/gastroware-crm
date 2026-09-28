import { describe, expect, it } from "vitest";
import {
  cuando,
  diaLargo,
  estadoAgenda,
  fechasSerie,
  horario,
  icsDe,
  limpiarLinks,
  linkGoogleCalendar,
  masMeses,
  MAX_REPETICIONES,
  semanasDelMes,
  textoFaltan,
  tocaAvisar,
} from "@/lib/agenda";

describe("repeticiones", () => {
  it("sin repetir es una sola fecha", () => {
    expect(fechasSerie("2026-10-06", "", "2026-12-31")).toEqual(["2026-10-06"]);
    expect(fechasSerie("2026-10-06", "semanal", null)).toEqual(["2026-10-06"]);
  });

  it("cada semana hasta la fecha incluida", () => {
    expect(fechasSerie("2026-10-06", "semanal", "2026-10-27")).toEqual(["2026-10-06", "2026-10-13", "2026-10-20", "2026-10-27"]);
  });

  it("cada 2 semanas", () => {
    expect(fechasSerie("2026-10-06", "quincenal", "2026-11-05")).toEqual(["2026-10-06", "2026-10-20", "2026-11-03"]);
  });

  it("cada mes respeta el día y el fin de mes", () => {
    expect(fechasSerie("2026-10-10", "mensual", "2027-01-10")).toEqual(["2026-10-10", "2026-11-10", "2026-12-10", "2027-01-10"]);
    expect(masMeses("2026-01-31", 1)).toBe("2026-02-28");
    expect(masMeses("2026-01-31", 2)).toBe("2026-03-31");
    expect(masMeses("2026-11-15", 3)).toBe("2027-02-15");
  });

  it("tiene tope", () => {
    expect(fechasSerie("2026-01-01", "semanal", "2030-01-01")).toHaveLength(MAX_REPETICIONES);
  });
});

describe("estado y avisos", () => {
  const hoy = "2026-10-10";
  it("tarea de un día anterior sin hacer queda atrasada; la reunión pasa", () => {
    expect(estadoAgenda({ fecha: "2026-10-09", tipo: "tarea" }, hoy, false)).toBe("atrasada");
    expect(estadoAgenda({ fecha: "2026-10-09", tipo: "pago" }, hoy, false)).toBe("atrasada");
    expect(estadoAgenda({ fecha: "2026-10-09", tipo: "reunion" }, hoy, false)).toBe("pasada");
    expect(estadoAgenda({ fecha: "2026-10-09", tipo: "tarea" }, hoy, true)).toBe("hecha");
  });

  it("dentro de los días de aviso", () => {
    expect(estadoAgenda({ fecha: "2026-10-13", tipo: "pago", aviso_dias: 3 }, hoy, false)).toBe("aviso");
    expect(estadoAgenda({ fecha: "2026-10-14", tipo: "pago", aviso_dias: 3 }, hoy, false)).toBe("proxima");
    expect(estadoAgenda({ fecha: hoy, tipo: "pago", aviso_dias: 3 }, hoy, false)).toBe("hoy");
  });

  it("el aviso sale el día de aviso y el día mismo", () => {
    expect(tocaAvisar({ fecha: "2026-10-13", aviso_dias: 3 }, hoy)).toBe(true);
    expect(tocaAvisar({ fecha: hoy, aviso_dias: 3 }, hoy)).toBe(true);
    expect(tocaAvisar({ fecha: "2026-10-12", aviso_dias: 3 }, hoy)).toBe(false);
    expect(tocaAvisar({ fecha: "2026-10-13", aviso_dias: 0 }, hoy)).toBe(false);
  });

  it("textos", () => {
    expect(textoFaltan("2026-10-13", hoy)).toBe("En 3 días");
    expect(textoFaltan("2026-10-11", hoy)).toBe("Mañana");
    expect(cuando("2026-10-11", hoy)).toBe("Mañana");
    expect(diaLargo("2026-09-28")).toBe("lunes 28 de septiembre");
    expect(horario("09:30:00", "10:30:00")).toBe("9:30 a 10:30");
    expect(horario(null, null)).toBe("");
  });
});

describe("links y calendario", () => {
  it("limpia links: agrega https y descarta lo que no es web", () => {
    expect(limpiarLinks([{ url: "meet.google.com/abc-defg-hij" }, { url: "javascript:alert(1)" }, { url: "  " }])).toEqual([
      { url: "https://meet.google.com/abc-defg-hij", texto: null },
    ]);
  });

  it("Google Calendar con hora de Argentina", () => {
    const url = new URL(linkGoogleCalendar({ titulo: "Reunión de Marketing", fecha: "2026-10-06", hora: "10:00:00" }));
    expect(url.searchParams.get("dates")).toBe("20261006T100000/20261006T110000");
    expect(url.searchParams.get("ctz")).toBe("America/Argentina/Buenos_Aires");
    const todoElDia = new URL(linkGoogleCalendar({ titulo: "Pagar alquiler", fecha: "2026-10-31" }));
    expect(todoElDia.searchParams.get("dates")).toBe("20261031/20261101");
  });

  it("archivo .ics", () => {
    const ics = icsDe({ id: "x", titulo: "Pago, alquiler", fecha: "2026-10-10", aviso_dias: 3 });
    expect(ics).toContain("DTSTART;VALUE=DATE:20261010");
    expect(ics).toContain("SUMMARY:Pago\\, alquiler");
    expect(ics).toContain("TRIGGER:-PT63H");
  });

  it("el mes arranca el lunes y cubre todos los días", () => {
    const semanas = semanasDelMes("2026-10-15");
    expect(semanas[0][0]).toBe("2026-09-28");
    expect(semanas.flat()).toContain("2026-10-31");
    expect(semanas.every((s) => s.length === 7)).toBe(true);
  });
});
