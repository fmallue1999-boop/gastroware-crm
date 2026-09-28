import { describe, it, expect } from "vitest";
import { plazosCaso, prioridadOT, vencePrimeraRespuesta } from "@/lib/casos";

describe("plazos de un caso", () => {
  it("parado: 1 hora; anda mal: 24 h hábiles", () => {
    expect(vencePrimeraRespuesta({ prioridad: "parado", created_at: "2026-10-02T13:00:00.000Z" }).toISOString()).toBe("2026-10-02T14:00:00.000Z");
    // viernes → lunes misma hora
    expect(vencePrimeraRespuesta({ prioridad: "anda_mal", created_at: "2026-10-02T13:00:00.000Z" }).toISOString()).toBe("2026-10-05T13:00:00.000Z");
  });
  it("marca respuesta vencida, cierre vencido y parado sin técnico", () => {
    const c = { prioridad: "parado", estado: "abierto", created_at: "2026-10-01T13:00:00.000Z", primera_respuesta_at: null };
    const p = plazosCaso(c, Date.parse("2026-10-09T13:00:00.000Z"), "2026-10-09");
    expect(p.respuestaVencida).toBe(true);
    expect(p.diasAbierto).toBe(6);
    expect(p.cierreVencido).toBe(true);
    expect(p.paradoSinTecnico).toBe(true);
    const ok = plazosCaso({ ...c, primera_respuesta_at: "2026-10-01T13:30:00.000Z", tecnico_asignado: true }, Date.parse("2026-10-01T15:00:00Z"), "2026-10-01");
    expect(ok.respuestaVencida).toBe(false);
    expect(ok.paradoSinTecnico).toBe(false);
  });
  it("prioridad del trabajo técnico", () => {
    expect(prioridadOT("parado")).toBe("urgente");
    expect(prioridadOT("consulta")).toBe("normal");
  });
});
