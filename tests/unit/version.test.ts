import { describe, it, expect } from "vitest";
import pkg from "../../package.json";
import { VERSION, VERSIONES, versionCorta } from "@/lib/novedades";

describe("versiones", () => {
  it("package.json y la lista de novedades dicen la misma versión", () => {
    expect(pkg.version).toBe(VERSION);
  });
  it("las versiones van de la más nueva a la más vieja, sin repetirse", () => {
    const ids = VERSIONES.map((v) => v.version);
    expect(new Set(ids).size).toBe(ids.length);
    const num = (v: string) => v.split(".").map(Number).reduce((a, n) => a * 1000 + n, 0);
    for (let i = 1; i < ids.length; i++) expect(num(ids[i - 1])).toBeGreaterThan(num(ids[i]));
  });
  it("se muestra corta", () => {
    expect(versionCorta("1.0.0")).toBe("v1.0");
    expect(versionCorta("1.2.3")).toBe("v1.2.3");
  });
});
