import { responsableDe, territorioDeZona, type Territorio, type UsuarioMin } from "@/lib/territorios";
import type { SupabaseServidor } from "@/lib/actions/comun";

export type Ruta = Awaited<ReturnType<typeof rutearConsulta>>;

/** Columnas del interés que deja el ruteo (asignación, territorio y primer contacto hoy). */
export function camposDeRuta(ruta: Ruta, hoy: string, enEspera = false): Record<string, unknown> {
  const campos: Record<string, unknown> = {
    comercial_id: ruta.comercialId,
    zona_entrega: ruta.zona,
    territorio: ruta.territorio,
    asignado_at: ruta.comercialId ? new Date().toISOString() : null,
  };
  if (!enEspera && (ruta.derivada || !ruta.comercialId)) {
    campos.proximo_contacto = hoy;
    campos.proximo_nota = ruta.comercialId ? "Primer contacto (dentro de la hora)" : "Asignar por lugar de entrega";
  }
  return campos;
}

/**
 * Ruteo de una consulta por lugar de entrega (manual 1.1 paso 2). No es una
 * acción del servidor: lo usan las altas de interés después de validar.
 *
 * - Con zona: va al responsable del territorio (si está vacante, a
 *   dirección general).
 * - Sin zona: si la carga alguien que vende, queda con esa persona; si la
 *   carga la administrativa u otro puesto, queda sin asignar ("consultas
 *   por asignar" en su día).
 */
export async function rutearConsulta(
  supabase: SupabaseServidor,
  input: { zona?: string | null; creadorId: string | null }
): Promise<{
  zona: string | null;
  territorio: string | null;
  comercialId: string | null;
  responsableNombre: string | null;
  derivada: boolean;
}> {
  const { territorios, usuarios } = await datosDeRuteo(supabase);
  return elegirResponsable(input, territorios, usuarios);
}

/** Territorios y usuarios para rutear (una sola lectura). */
export async function datosDeRuteo(supabase: SupabaseServidor) {
  const [{ data: ts }, { data: us }] = await Promise.all([
    supabase.from("territorios").select("codigo, nombre, zonas, responsable_id").order("orden"),
    supabase.from("usuarios").select("id, nombre, rol, activo, territorio"),
  ]);
  return { territorios: (ts ?? []) as Territorio[], usuarios: (us ?? []) as UsuarioMin[] };
}

/** La regla del ruteo, sin leer la base (también la usa el formulario para mostrar a quién va). */
export function elegirResponsable(
  input: { zona?: string | null; creadorId: string | null },
  territorios: Territorio[],
  usuarios: UsuarioMin[]
) {
  const creador = usuarios.find((u) => u.id === input.creadorId) ?? null;
  const zona = input.zona?.trim() || null;
  const territorio = territorioDeZona(zona, territorios);

  if (!territorio) {
    const vende = creador && ["comercial", "direccion", "distribuidor"].includes(creador.rol);
    return {
      zona,
      territorio: null,
      comercialId: vende ? creador.id : null,
      responsableNombre: vende ? creador.nombre : null,
      derivada: false,
    };
  }
  // Un vendedor que carga una consulta de su propio territorio se la queda.
  const delTerritorio =
    creador && creador.activo && creador.territorio === territorio.codigo && ["comercial", "direccion"].includes(creador.rol);
  const responsable = delTerritorio ? creador : responsableDe(territorio, usuarios);
  return {
    zona,
    territorio: territorio.codigo,
    comercialId: responsable?.id ?? null,
    responsableNombre: responsable?.nombre ?? null,
    derivada: Boolean(responsable && responsable.id !== input.creadorId),
  };
}
