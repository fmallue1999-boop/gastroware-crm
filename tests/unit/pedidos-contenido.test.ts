import { describe, it, expect } from "vitest";
import { agruparPedidos, estaCerrado, estadoDe, sePuedeTrabajar, ESTADOS_PEDIDO } from "@/lib/pedidos-contenido";
import { espacioValido, esEspacio } from "@/lib/material";

describe("pedidos de contenido a marketing (v1.23)", () => {
  it("primero lo que está para aprobar y lo que volvió con cambios", () => {
    const g = agruparPedidos([
      { id: "a", estado: "aprobado" },
      { id: "b", estado: "pedido" },
      { id: "c", estado: "para_aprobar" },
      { id: "d", estado: "cambios" },
      { id: "e", estado: "en_curso" },
    ]);
    expect(g.map((x) => x.estado)).toEqual(["para_aprobar", "cambios", "pedido", "en_curso", "aprobado"]);
  });

  it("qué se puede trabajar y qué está cerrado", () => {
    expect(["pedido", "en_curso", "cambios"].every(sePuedeTrabajar)).toBe(true);
    expect(sePuedeTrabajar("para_aprobar")).toBe(false);
    expect(["aprobado", "entregado", "cancelado"].every(estaCerrado)).toBe(true);
    expect(estaCerrado("para_aprobar")).toBe(false);
  });

  it("un estado desconocido se muestra como pedido", () => {
    expect(estadoDe("raro")).toBe("pedido");
    expect(ESTADOS_PEDIDO[estadoDe("para_aprobar")].label).toBe("Para aprobar");
  });
});

describe("espacios de Material (v1.23)", () => {
  it("cada dueño con su espacio (igual que la base)", () => {
    expect(espacioValido("marca", "logo")).toBe(true);
    expect(espacioValido("marca", "propio")).toBe(false);
    expect(espacioValido("producto", "imagenes")).toBe(true);
    expect(espacioValido("espacio", "propio")).toBe(true);
    expect(espacioValido("espacio", "imagenes")).toBe(false);
    expect(espacioValido("pedido", "entrega")).toBe(true);
    expect(espacioValido("pedido", "propio")).toBe(false);
    expect(esEspacio("propio") && esEspacio("entrega")).toBe(true);
  });
});
