"use server";

// Calendario de contenidos (v1.10): una ficha = un contenido con su estado.
// Cargan marketing y dirección; solo dirección general aprueba (la base
// también lo controla). Los archivos van al bucket privado "contenidos".

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { esCuenta, esEstado, esFecha, esTipo, estadoDe, fechaDMY, type EstadoContenido } from "@/lib/contenidos";
import { avisar, puestoActual, usuarioActual, usuariosDePuesto } from "./comun";

const CARGAN = ["marketing", "direccion", "admin"];

export type DatosContenido = {
  nombre: string;
  cuenta: string;
  fecha: string;
  tipo: string;
  objetivo?: string | null;
  copy?: string | null;
  estado?: string | null;
  correccion?: string | null;
};

/** Crea o actualiza una ficha. Devuelve su id (el mismo al editar). */
export async function guardarContenido(id: string | null, d: DatosContenido): Promise<{ error: string } | { ok: true; id: string }> {
  const nombre = d.nombre.trim();
  if (!nombre) return { error: "Poné el nombre del contenido" };
  if (!esCuenta(d.cuenta)) return { error: "Elegí la cuenta" };
  if (!esFecha(d.fecha)) return { error: "Elegí la fecha" };
  if (!esTipo(d.tipo)) return { error: "Elegí si es historia o feed" };
  const estado: EstadoContenido = esEstado(d.estado) ? d.estado : "pendiente";

  const supabase = await createClient();
  const [rol, user] = await Promise.all([puestoActual(supabase), usuarioActual()]);
  if (!CARGAN.includes(rol)) return { error: "Los contenidos los cargan marketing y dirección" };
  const aprueba = rol === "direccion";

  const fila: Record<string, unknown> = {
    nombre: nombre.slice(0, 200),
    cuenta: d.cuenta,
    fecha: d.fecha,
    tipo: d.tipo,
    objetivo: d.objetivo?.trim() || null,
    copy: d.copy?.replace(/\r\n/g, "\n").trimEnd() || null,
  };
  // Solo dirección cambia el estado a aprobado / re-edición / cancelado y escribe la corrección
  if (aprueba) {
    fila.estado = estado;
    fila.correccion = d.correccion?.trim() || null;
  } else if (estado === "pendiente") fila.estado = "pendiente";

  let anterior: { estado: string; created_by: string | null } | null = null;
  let contenidoId = id;
  if (id) {
    const { data: previo } = await supabase.from("contenidos").select("estado, created_by").eq("id", id).maybeSingle();
    if (!previo) return { error: "No se encontró el contenido" };
    anterior = previo as { estado: string; created_by: string | null };
    const { error } = await supabase.from("contenidos").update(fila).eq("id", id);
    if (error) return { error: error.message };
  } else {
    const { data, error } = await supabase.from("contenidos").insert(fila).select("id").single();
    if (error || !data) return { error: error?.message ?? "No se pudo crear" };
    contenidoId = data.id as string;
  }

  // Avisos: lo nuevo o re-editado le llega a dirección; la decisión, a quien lo cargó
  const url = `/contenidos?ficha=${contenidoId}&dia=${d.fecha}`;
  const quedaPendiente = (fila.estado ?? anterior?.estado) === "pendiente";
  if (!aprueba && quedaPendiente && (!anterior || anterior.estado !== "pendiente")) {
    await avisar(
      supabase,
      await usuariosDePuesto(supabase, ["direccion"]),
      { tipo: "contenido_a_aprobar", titulo: `Contenido para aprobar: ${nombre}`, cuerpo: `${fechaDMY(d.fecha)} · ${d.tipo === "historia" ? "Historia" : "Feed"}`, url },
      user?.id
    );
  }
  if (aprueba && anterior && anterior.estado !== estado && estado !== "pendiente") {
    await avisar(
      supabase,
      [anterior.created_by],
      {
        tipo: "contenido_revisado",
        titulo: `${estadoDe(estado).label}: ${nombre}`,
        cuerpo: estado === "reedicion" ? d.correccion?.trim() || null : `${fechaDMY(d.fecha)}`,
        url,
      },
      user?.id
    );
  }

  revalidatePath("/contenidos", "layout");
  return { ok: true, id: contenidoId as string };
}

/**
 * Decisión de dirección general desde Aprobaciones (v1.15): aprobar, pedir
 * cambios (con la corrección) o cancelar, sin abrir la ficha. La base también
 * controla que solo dirección cambie el estado. Le avisa a quien lo cargó.
 */
export async function decidirContenido(id: string, estado: "aprobado" | "reedicion" | "cancelado", correccion?: string | null) {
  if (!["aprobado", "reedicion", "cancelado"].includes(estado)) return { error: "Estado inválido" };
  const texto = correccion?.trim() || null;
  if (estado === "reedicion" && !texto) return { error: "Escribí qué hay que cambiar" };
  const supabase = await createClient();
  const [rol, user] = await Promise.all([puestoActual(supabase), usuarioActual()]);
  if (rol !== "direccion") return { error: "Los contenidos los aprueba dirección general" };
  const { data: previo } = await supabase.from("contenidos").select("nombre, fecha, created_by").eq("id", id).maybeSingle();
  if (!previo) return { error: "No se encontró el contenido" };
  const { error } = await supabase
    .from("contenidos")
    .update({ estado, ...(estado === "reedicion" || texto ? { correccion: texto } : {}) })
    .eq("id", id);
  if (error) return { error: error.message };
  await avisar(
    supabase,
    [previo.created_by as string | null],
    {
      tipo: "contenido_revisado",
      titulo: `${estadoDe(estado).label}: ${previo.nombre}`,
      cuerpo: estado === "reedicion" ? texto : fechaDMY(previo.fecha as string),
      url: `/contenidos?ficha=${id}&dia=${previo.fecha}`,
    },
    user?.id
  );
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** Borra la ficha y sus archivos (también del almacenamiento). */
export async function borrarContenido(id: string) {
  const supabase = await createClient();
  if (!CARGAN.includes(await puestoActual(supabase))) return { error: "Sin permiso" };
  const { data: archivos } = await supabase.from("contenido_archivos").select("path").eq("contenido_id", id);
  const paths = (archivos ?? []).map((a) => a.path as string);
  if (paths.length) {
    const { error } = await supabase.storage.from("contenidos").remove(paths);
    if (error) return { error: `No se pudieron borrar los archivos: ${error.message}` };
  }
  const { error } = await supabase.from("contenidos").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/contenidos", "layout");
  return { ok: true as const };
}

/** Registra archivos ya subidos al bucket (el navegador los sube directo). */
export async function registrarArchivosContenido(
  contenidoId: string,
  archivos: { path: string; nombre: string; mime: string | null; tamano: number }[]
) {
  if (!archivos.length) return { ok: true as const };
  if (archivos.some((a) => !a.path.startsWith(`${contenidoId}/`))) return { error: "Archivo inválido" };
  const supabase = await createClient();
  const { error } = await supabase.from("contenido_archivos").insert(
    archivos.map((a) => ({ contenido_id: contenidoId, path: a.path, nombre: a.nombre.slice(0, 200), mime: a.mime, tamano: a.tamano }))
  );
  if (error) {
    // Que no queden archivos sueltos en el almacenamiento
    await supabase.storage.from("contenidos").remove(archivos.map((a) => a.path));
    return { error: error.message };
  }
  revalidatePath("/contenidos", "layout");
  return { ok: true as const };
}

/** Borra un archivo de la ficha (y del almacenamiento). */
export async function borrarArchivoContenido(archivoId: string) {
  const supabase = await createClient();
  const { data: a } = await supabase.from("contenido_archivos").select("path").eq("id", archivoId).maybeSingle();
  if (!a) return { error: "No se encontró el archivo" };
  const { error: errSt } = await supabase.storage.from("contenidos").remove([a.path as string]);
  if (errSt) return { error: errSt.message };
  const { error } = await supabase.from("contenido_archivos").delete().eq("id", archivoId);
  if (error) return { error: error.message };
  revalidatePath("/contenidos", "layout");
  return { ok: true as const };
}
