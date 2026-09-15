/**
 * Convierte el resultado de supabase-js en un valor o una excepción con
 * contexto. Sirve para que ningún insert/update quede sin verificar:
 *
 *   const equipo = must(await supabase.from("equipos").insert(...).select("id").single(), "crear equipo");
 *
 * Las acciones lo usan dentro de try/catch y devuelven `{ error: e.message }`,
 * que es lo que muestran los formularios.
 */
export function must<R extends { data: unknown; error: { message: string } | null }>(
  res: R,
  contexto: string
): Exclude<R["data"], null> {
  if (res.error) throw new Error(`${contexto}: ${res.error.message}`);
  return res.data as Exclude<R["data"], null>;
}

/** Mensaje legible de cualquier excepción, para devolverlo como `{ error }`. */
export function mensajeDe(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
