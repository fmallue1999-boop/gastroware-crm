import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { BASICOS, GUIA_PUESTOS, TAREAS, tareaPorId } from "@/lib/guia";
import { PUESTOS } from "@/lib/puestos";

/** Rutas reales de la app (carpetas con page.tsx, sin los grupos entre paréntesis). */
function rutasDeLaApp(): Set<string> {
  const rutas = new Set<string>();
  const raiz = path.join(process.cwd(), "app");
  const recorrer = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const completo = path.join(dir, e.name);
      if (e.isDirectory()) recorrer(completo);
      else if (e.name === "page.tsx") {
        const rel = path.relative(raiz, dir).split(path.sep).filter((s) => !/^\(.*\)$/.test(s));
        rutas.add("/" + rel.join("/"));
      }
    }
  };
  recorrer(raiz);
  return rutas;
}

describe("guía de uso", () => {
  it("cada puesto tiene su guía y todas sus tareas existen", () => {
    for (const p of PUESTOS) {
      const g = GUIA_PUESTOS[p.value];
      expect(g, p.value).toBeTruthy();
      for (const id of g.tareas) expect(tareaPorId(id), `${p.value}: ${id}`).not.toBeNull();
    }
  });

  it("los ids no se repiten", () => {
    const ids = [...BASICOS, ...TAREAS].map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("cada botón de la guía lleva a una pantalla que existe", () => {
    const rutas = rutasDeLaApp();
    const hrefs = [...BASICOS, ...TAREAS].flatMap((t) => t.pasos.map((p) => p.href).filter(Boolean) as string[]);
    for (const p of PUESTOS) hrefs.push(GUIA_PUESTOS[p.value].abreEn.href);
    for (const h of hrefs) expect(rutas.has(h.split("?")[0]), h).toBe(true);
  });
});
