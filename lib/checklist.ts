/*
 * Helpers de checklists. Dos modos según cómo se escriben los ítems de la
 * plantilla (un ítem por línea en Admin → Checklists):
 *
 * - Modo simple: líneas de texto → pasos que el técnico tilda (checkbox).
 * - Modo inspección (estilo lista Rational): además de ítems SÍ/NO admite
 *     "## Título"  → encabezado de sección (no se responde)
 *     "= Campo"    → campo de medición / valor libre (ej: presión de agua)
 *   Cada ítem SÍ/NO acepta un comentario opcional.
 *
 * Respuestas (jsonb por índice de ítem):
 * - Modo simple: boolean (compatible con lo ya guardado).
 * - Inspección: { r?: "si"|"no", c?: comentario } o { v: valor } en mediciones.
 */

export type RespuestaChecklist =
  | boolean
  | { r?: "si" | "no"; c?: string; v?: string };

export type ItemChecklist = {
  tipo: "seccion" | "si_no" | "medicion";
  texto: string;
};

export function parseItemChecklist(item: string): ItemChecklist {
  if (item.startsWith("## "))
    return { tipo: "seccion", texto: item.slice(3).trim() };
  if (item.startsWith("= "))
    return { tipo: "medicion", texto: item.slice(2).trim() };
  return { tipo: "si_no", texto: item };
}

/** Una plantilla es de inspección si usa secciones o campos de medición. */
export function esInspeccion(items: string[]): boolean {
  return items.some((i) => i.startsWith("## ") || i.startsWith("= "));
}

export function respuestaObj(
  r: RespuestaChecklist | undefined
): { r?: "si" | "no"; c?: string; v?: string } {
  if (r && typeof r === "object") return r;
  return {};
}
