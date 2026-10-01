import { describe, it, expect } from "vitest";
import { clasificarPendientes } from "@/lib/pendientes";
import { textoProximo } from "@/components/PuntoNivel";

const HOY = "2026-10-01";
const base = {
  etapa: "nueva",
  temperatura: null as string | null,
  proximo_contacto: HOY as string | null,
  proximo_hora: null as string | null,
  proximo_nota: null as string | null,
  ultimo_movimiento_at: "2026-09-30T10:00:00.000Z" as string | null,
};

describe("reprogramar con hora (v1.13)", () => {
  it("los de hoy: primero los sin hora (por nivel) y después por hora", () => {
    const b = clasificarPendientes(
      [
        { ...base, id: "tarde", proximo_hora: "16:00:00" },
        { ...base, id: "frio", temperatura: "frio" },
        { ...base, id: "temprano", proximo_hora: "09:30:00" },
        { ...base, id: "caliente", temperatura: "caliente" },
      ],
      HOY
    );
    expect(b.hoy.map((i) => i.id)).toEqual(["caliente", "frio", "temprano", "tarde"]);
  });

  it("el texto del próximo contacto dice la hora", () => {
    expect(textoProximo(HOY, null, HOY, "visitar", "16:00:00").texto).toBe("Visitar hoy a las 16:00");
    expect(textoProximo("2026-10-08", "prefiere la semana que viene", HOY, "visitar", null).texto).toMatch(/^Visitar el .+ · prefiere la semana que viene$/);
    expect(textoProximo(HOY, null, HOY).texto).toBe("Contactar hoy");
  });
});
