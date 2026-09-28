/**
 * Territorios y ruteo por lugar de entrega (manual, 1.1 paso 2): "CABA y
 * AMBA" al vendedor de ese territorio; el resto del país al de "Mar del
 * Plata, costa e interior". Si el puesto está vacante, responde dirección
 * general.
 */

export type Territorio = { codigo: string; nombre: string; zonas: string[]; responsable_id: string | null };
export type UsuarioMin = { id: string; nombre: string; rol: string; activo: boolean; territorio?: string | null };

/** Zonas de entrega que se ofrecen al cargar una consulta, en orden. */
export const ZONAS_ENTREGA = [
  "CABA",
  "AMBA (Gran Buenos Aires)",
  "Mar del Plata y zona",
  "Costa atlántica",
  "Interior de Buenos Aires",
  "Otra provincia",
] as const;

/** Zonas que atiende el técnico propio (el resto va a un técnico aliado). */
export const ZONAS_TECNICO_PROPIO = ["Mar del Plata y zona"];

export function territorioDeZona(zona: string | null | undefined, territorios: Territorio[]): Territorio | null {
  if (!zona) return null;
  return territorios.find((t) => t.zonas.includes(zona)) ?? null;
}

/**
 * Quién responde por un territorio: su responsable si está activo; si no,
 * el primer usuario activo de dirección general.
 */
export function responsableDe(territorio: Territorio | null, usuarios: UsuarioMin[]): UsuarioMin | null {
  const activos = usuarios.filter((u) => u.activo);
  if (territorio?.responsable_id) {
    const r = activos.find((u) => u.id === territorio.responsable_id);
    if (r) return r;
  }
  return activos.find((u) => u.rol === "direccion") ?? null;
}

/** El otro territorio (para "no es de mi territorio"). */
export function otroTerritorio(codigo: string | null | undefined, territorios: Territorio[]): Territorio | null {
  return territorios.find((t) => t.codigo !== codigo) ?? null;
}
