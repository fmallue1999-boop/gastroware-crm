"use server";

// Viáticos (v1.25, pedido de dirección): cada uno carga sus gastos con el
// comprobante (la IA lo lee y completa los datos) → los rinde → dirección
// aprueba o rechaza cada gasto → administración reintegra lo aprobado que se
// pagó con plata propia. Las reglas de quién puede qué están también en la
// base (047_viaticos: permisos y guardias).

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { consultarIA } from "@/lib/core/ia";
import {
  CATEGORIAS_GASTO,
  TIPOS_COMPROBANTE,
  aReintegrar,
  cuitConGuiones,
  esCategoria,
  esMedio,
  hayAlgo,
  leerFecha,
  leerImporte,
  textoTotales,
  totalPorMoneda,
} from "@/lib/viaticos";
import { avisar, puestoActual, usuarioActual, usuariosDePuesto, type SupabaseServidor } from "./comun";

const hoyAR = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
const apruebaViaticos = (rol: string) => rol === "direccion" || rol === "admin";
const reintegraViaticos = (rol: string) => ["direccion", "admin", "administrativa"].includes(rol);
const urlRendicion = (id: string) => `/viaticos/rendicion/${id}`;
const MAX_LEER = 10 * 1024 * 1024;

function revalidar() {
  revalidatePath("/viaticos", "layout");
  revalidatePath("/hoy");
  revalidatePath("/aprobaciones");
}

export type DatosGasto = {
  fecha: string;
  categoria: string;
  importe: number | string;
  moneda: string;
  medio_pago: string;
  comercio?: string | null;
  cuit?: string | null;
  tipo_comprobante?: string | null;
  numero_comprobante?: string | null;
  iva?: number | string | null;
  detalle?: string | null;
  clienteId?: string | null;
  archivoPath?: string | null;
  leidoPorIA?: boolean;
};

/** Valida lo cargado y lo deja listo para la base. */
function fila(input: DatosGasto, usuarioId: string) {
  const fecha = leerFecha(input.fecha, hoyAR());
  if (!fecha) return { error: "Poné la fecha del gasto (no puede ser futura)" } as const;
  if (!esCategoria(input.categoria)) return { error: "Elegí de qué es el gasto" } as const;
  const importe = leerImporte(input.importe);
  if (!importe) return { error: "Poné el importe" } as const;
  if (!["ARS", "USD"].includes(input.moneda)) return { error: "Moneda no válida" } as const;
  if (!esMedio(input.medio_pago)) return { error: "Elegí cómo se pagó" } as const;
  const iva = input.iva === null || input.iva === undefined || input.iva === "" ? null : leerImporte(input.iva);
  if (iva !== null && iva > importe) return { error: "El IVA no puede ser mayor que el importe" } as const;
  if (input.archivoPath && !input.archivoPath.startsWith(`${usuarioId}/`)) return { error: "Comprobante no válido" } as const;
  const texto = (s: string | null | undefined, max = 200) => (s ?? "").trim().slice(0, max) || null;
  return {
    datos: {
      fecha,
      categoria: input.categoria,
      importe,
      moneda: input.moneda,
      medio_pago: input.medio_pago,
      comercio: texto(input.comercio),
      cuit: cuitConGuiones(input.cuit),
      tipo_comprobante: texto(input.tipo_comprobante, 40),
      numero_comprobante: texto(input.numero_comprobante, 40),
      iva,
      detalle: texto(input.detalle, 500),
      cliente_id: input.clienteId || null,
      archivo_path: input.archivoPath || null,
      leido_por_ia: Boolean(input.leidoPorIA),
    },
  } as const;
}

async function borrarArchivo(supabase: SupabaseServidor, path: string | null | undefined) {
  if (path) await supabase.storage.from("viaticos").remove([path]);
}

// ---------------------------------------------------------------------------
// La IA lee el comprobante
// ---------------------------------------------------------------------------

export type LecturaComprobante = {
  fecha: string | null;
  importe: number | null;
  moneda: "ARS" | "USD";
  categoria: string | null;
  comercio: string | null;
  cuit: string | null;
  tipo_comprobante: string | null;
  numero_comprobante: string | null;
  iva: number | null;
  detalle: string | null;
  legible: boolean;
};

/**
 * Lee la foto o el PDF del comprobante (ya subido a "viaticos/{usuario}/…")
 * y devuelve los datos para completar el formulario. Lo que no se lee, vacío.
 */
export async function leerComprobante(path: string): Promise<{ ok: true; datos: LecturaComprobante } | { error: string }> {
  const supabase = await createClient();
  const user = await usuarioActual();
  if (!user) return { error: "Tenés que entrar de nuevo" };
  if (!path.startsWith(`${user.id}/`)) return { error: "Comprobante no válido" };
  const { data: blob, error } = await supabase.storage.from("viaticos").download(path);
  if (error || !blob) return { error: "No se pudo abrir el comprobante" };
  if (blob.size > MAX_LEER) return { error: "El archivo es muy grande para leerlo (hasta 10 MB). Completá los datos a mano." };
  const base64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
  const esPdf = blob.type === "application/pdf" || path.toLowerCase().endsWith(".pdf");
  const tipoImagen = (["image/jpeg", "image/png", "image/webp"].includes(blob.type) ? blob.type : "image/jpeg") as "image/jpeg" | "image/png" | "image/webp";
  const hoy = hoyAR();

  const res = await consultarIA<{
    fecha: string;
    importe: string;
    moneda: string;
    categoria: string;
    comercio: string;
    cuit: string;
    tipo_comprobante: string;
    numero_comprobante: string;
    iva: string;
    detalle: string;
    legible: string;
  }>({
    supabase,
    usuarioId: user.id,
    funcion: "leer_comprobante",
    maxTokens: 1000,
    ...(esPdf ? { documento: { base64 } } : { imagen: { base64, mediaType: tipoImagen } }),
    instrucciones: `${esPdf ? "El PDF" : "La imagen"} es un comprobante de un gasto de viaje de trabajo en Argentina (ticket, factura, recibo, ticket de peaje o estacionamiento, comprobante de Uber/Cabify, pasaje). Extraé:
- fecha: la fecha del gasto en formato AAAA-MM-DD (en Argentina las fechas se escriben día/mes/año). Hoy es ${hoy}.
- importe: el TOTAL final pagado (con IVA e impuestos incluidos), solo el número con punto decimal (ej: 12345.67).
- moneda: "ARS" salvo que diga claramente dólares (USD, US$, U$S): entonces "USD".
- categoria: UNA de ${CATEGORIAS_GASTO.map((c) => c.value).join(", ")}. Nafta, gasoil, GNC, YPF, Shell, Axion, Puma → combustible. Autopista, AUBASA, peaje → peaje. Estacionamiento, parking, cochera → estacionamiento. Restaurante, bar, café, comida → comida. Hotel, hospedaje, alojamiento → hotel. Avión, micro, tren, pasaje → pasajes. Taxi, remís, Uber, Cabify, DiDi → taxi. Si no encaja, otros.
- comercio: el nombre o razón social de quien emite el comprobante.
- cuit: el CUIT de quien emite (no el del cliente), solo si figura.
- tipo_comprobante: UNO de ${TIPOS_COMPROBANTE.join(", ")} (o vacío si no se ve).
- numero_comprobante: punto de venta y número tal como figura (ej: 0003-00012345).
- iva: el IVA discriminado si figura (factura A), solo el número; si no figura, vacío.
- detalle: qué se compró en pocas palabras, hasta 60 letras (ej: "Nafta súper 35 L", "Almuerzo 2 personas").
- legible: "si" si se pudo leer el comprobante, "no" si no es un comprobante o no se lee.
Devolvé string vacío en todo campo que no se lea con claridad. NO inventes datos.`,
    contexto: "Carga de viáticos de un empleado de GastroWare.",
    esquema: {
      type: "object",
      properties: {
        fecha: { type: "string" },
        importe: { type: "string" },
        moneda: { type: "string" },
        categoria: { type: "string" },
        comercio: { type: "string" },
        cuit: { type: "string" },
        tipo_comprobante: { type: "string" },
        numero_comprobante: { type: "string" },
        iva: { type: "string" },
        detalle: { type: "string" },
        legible: { type: "string" },
      },
      required: ["fecha", "importe", "moneda", "categoria", "comercio", "cuit", "tipo_comprobante", "numero_comprobante", "iva", "detalle", "legible"],
      additionalProperties: false,
    },
  });
  if (!res.ok) return { error: res.error };
  const d = res.datos;
  const texto = (s: string, max = 200) => s.trim().slice(0, max) || null;
  return {
    ok: true,
    datos: {
      fecha: leerFecha(d.fecha, hoy),
      importe: leerImporte(d.importe),
      moneda: d.moneda.trim().toUpperCase() === "USD" ? "USD" : "ARS",
      categoria: esCategoria(d.categoria.trim()) ? d.categoria.trim() : null,
      comercio: texto(d.comercio),
      cuit: cuitConGuiones(d.cuit),
      tipo_comprobante: (TIPOS_COMPROBANTE as readonly string[]).includes(d.tipo_comprobante.trim()) ? d.tipo_comprobante.trim() : null,
      numero_comprobante: texto(d.numero_comprobante, 40),
      iva: leerImporte(d.iva),
      detalle: texto(d.detalle, 120),
      legible: d.legible.trim().toLowerCase() !== "no",
    },
  };
}

/** Borra un comprobante que se subió pero no se guardó (se canceló o se cambió). */
export async function descartarComprobante(path: string) {
  const supabase = await createClient();
  const user = await usuarioActual();
  if (!user || !path.startsWith(`${user.id}/`)) return { error: "Comprobante no válido" };
  const { count } = await supabase.from("gastos").select("id", { count: "exact", head: true }).eq("archivo_path", path);
  if (count) return { ok: true as const };
  await borrarArchivo(supabase, path);
  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// Cargar, corregir y borrar gastos (los propios, mientras no se rindieron)
// ---------------------------------------------------------------------------

export async function crearGasto(input: DatosGasto): Promise<{ ok: true; id: string } | { error: string }> {
  const supabase = await createClient();
  const user = await usuarioActual();
  if (!user) return { error: "Tenés que entrar de nuevo" };
  const f = fila(input, user.id);
  if ("error" in f) return { error: f.error! };
  const { data, error } = await supabase.from("gastos").insert({ ...f.datos, usuario_id: user.id }).select("id").single();
  if (error) return { error: error.message };
  revalidar();
  return { ok: true, id: data.id as string };
}

export async function editarGasto(id: string, input: DatosGasto): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const user = await usuarioActual();
  if (!user) return { error: "Tenés que entrar de nuevo" };
  const { data: antes } = await supabase.from("gastos").select("usuario_id, rendicion_id, archivo_path").eq("id", id).maybeSingle();
  if (!antes || antes.usuario_id !== user.id) return { error: "Solo podés cambiar tus gastos" };
  if (antes.rendicion_id) return { error: "El gasto ya se rindió: no se puede cambiar" };
  const f = fila(input, user.id);
  if ("error" in f) return { error: f.error! };
  const { error } = await supabase.from("gastos").update(f.datos).eq("id", id);
  if (error) return { error: error.message };
  if (antes.archivo_path && antes.archivo_path !== f.datos.archivo_path) await borrarArchivo(supabase, antes.archivo_path as string);
  revalidar();
  return { ok: true };
}

export async function borrarGasto(id: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const user = await usuarioActual();
  if (!user) return { error: "Tenés que entrar de nuevo" };
  const { data, error } = await supabase.from("gastos").delete().eq("id", id).eq("usuario_id", user.id).is("rendicion_id", null).select("archivo_path");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "Solo se borran tus gastos sin rendir" };
  await borrarArchivo(supabase, data[0].archivo_path as string | null);
  revalidar();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Rendir y retirar
// ---------------------------------------------------------------------------

type GastoRevision = { id: string; importe: number; moneda: string; medio_pago: string; decision: string | null };

export async function rendirGastos(ids: string[], nota?: string): Promise<{ ok: true; id: string } | { error: string }> {
  const unicos = [...new Set(ids)];
  if (!unicos.length) return { error: "Elegí los gastos que rendís" };
  const supabase = await createClient();
  const user = await usuarioActual();
  if (!user) return { error: "Tenés que entrar de nuevo" };
  const { data: propios } = await supabase
    .from("gastos")
    .select("id, importe, moneda, medio_pago, decision")
    .in("id", unicos)
    .eq("usuario_id", user.id)
    .is("rendicion_id", null);
  const gastos = (propios ?? []) as GastoRevision[];
  if (gastos.length !== unicos.length) return { error: "Algún gasto ya se rindió o no es tuyo. Recargá la página." };

  const { data: r, error } = await supabase
    .from("rendiciones")
    .insert({ usuario_id: user.id, nota: nota?.trim().slice(0, 500) || null })
    .select("id, numero")
    .single();
  if (error || !r) return { error: error?.message ?? "No se pudo crear la rendición" };
  const { error: errG } = await supabase.from("gastos").update({ rendicion_id: r.id }).in("id", unicos).eq("usuario_id", user.id).is("rendicion_id", null);
  if (errG) {
    await supabase.from("rendiciones").delete().eq("id", r.id);
    return { error: errG.message };
  }

  const { data: yo } = await supabase.from("usuarios").select("nombre").eq("id", user.id).maybeSingle();
  const direccion = await usuariosDePuesto(supabase, ["direccion", "admin"]);
  await avisar(
    supabase,
    direccion,
    {
      tipo: "viaticos",
      titulo: `${yo?.nombre ?? "Alguien"} rindió ${gastos.length} ${gastos.length === 1 ? "gasto" : "gastos"} de viáticos: ${textoTotales(totalPorMoneda(gastos))} (rendición N° ${r.numero})`,
      url: urlRendicion(r.id as string),
    },
    user.id
  );
  revalidar();
  return { ok: true, id: r.id as string };
}

/** Quien rindió la retira (antes de que dirección decida algo): los gastos vuelven a "sin rendir". */
export async function retirarRendicion(id: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const user = await usuarioActual();
  if (!user) return { error: "Tenés que entrar de nuevo" };
  const { data, error } = await supabase.from("rendiciones").delete().eq("id", id).eq("usuario_id", user.id).eq("estado", "enviada").select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "No se puede retirar: dirección ya empezó a revisarla" };
  revalidar();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Dirección: aprobar o rechazar cada gasto
// ---------------------------------------------------------------------------

async function leerRendicion(supabase: SupabaseServidor, id: string) {
  const { data } = await supabase.from("rendiciones").select("id, numero, usuario_id, estado").eq("id", id).maybeSingle();
  return data as { id: string; numero: number; usuario_id: string; estado: string } | null;
}

/** Si ya no queda nada por decidir, cierra la revisión y avisa. */
async function cerrarRevision(supabase: SupabaseServidor, rendicionId: string, quien: string) {
  const r = await leerRendicion(supabase, rendicionId);
  if (!r || r.estado !== "enviada") return;
  const { data } = await supabase.from("gastos").select("id, importe, moneda, medio_pago, decision").eq("rendicion_id", rendicionId);
  const gastos = (data ?? []) as GastoRevision[];
  if (!gastos.length || gastos.some((g) => !g.decision)) return;
  const devolver = aReintegrar(gastos);
  const estado = hayAlgo(devolver) ? "aprobada" : "cerrada";
  const { error } = await supabase.from("rendiciones").update({ estado }).eq("id", rendicionId).eq("estado", "enviada");
  if (error) return;

  const aprobados = gastos.filter((g) => g.decision === "aprobado");
  const rechazados = gastos.length - aprobados.length;
  const partes = [
    aprobados.length ? `aprobado ${textoTotales(totalPorMoneda(aprobados))}` : "no se aprobó ningún gasto",
    rechazados ? `${rechazados} ${rechazados === 1 ? "rechazado" : "rechazados"}` : null,
    hayAlgo(devolver) ? `se te devuelve ${textoTotales(devolver)}` : null,
  ].filter(Boolean);
  const url = urlRendicion(rendicionId);
  await avisar(supabase, [r.usuario_id], { tipo: "viaticos", titulo: `Tu rendición N° ${r.numero} fue revisada: ${partes.join(" · ")}`, url }, quien);
  if (estado === "aprobada") {
    const { data: duenio } = await supabase.from("usuarios").select("nombre").eq("id", r.usuario_id).maybeSingle();
    // Si el puesto de administración está vacante, el aviso le llega a dirección
    const administracion = await usuariosDePuesto(supabase, ["administrativa", "admin", "direccion"]);
    await avisar(
      supabase,
      administracion,
      { tipo: "viaticos", titulo: `Viáticos para reintegrar: ${textoTotales(devolver)} a ${duenio?.nombre ?? "alguien"} (rendición N° ${r.numero})`, url },
      quien
    );
  }
}

export async function decidirGasto(gastoId: string, decision: "aprobado" | "rechazado", motivo?: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const user = await usuarioActual();
  if (!user) return { error: "Tenés que entrar de nuevo" };
  if (!apruebaViaticos(await puestoActual(supabase))) return { error: "Los gastos los aprueba dirección" };
  if (decision === "rechazado" && !motivo?.trim()) return { error: "Poné por qué se rechaza" };
  const { data: g } = await supabase.from("gastos").select("rendicion_id").eq("id", gastoId).maybeSingle();
  if (!g?.rendicion_id) return { error: "El gasto no está rendido" };
  const { error } = await supabase
    .from("gastos")
    .update({ decision, motivo_rechazo: decision === "rechazado" ? motivo!.trim().slice(0, 300) : null })
    .eq("id", gastoId);
  if (error) return { error: error.message };
  await cerrarRevision(supabase, g.rendicion_id as string, user.id);
  revalidar();
  return { ok: true };
}

/** Aprueba de una vez todo lo que falta decidir de la rendición. */
export async function aprobarPendientes(rendicionId: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const user = await usuarioActual();
  if (!user) return { error: "Tenés que entrar de nuevo" };
  if (!apruebaViaticos(await puestoActual(supabase))) return { error: "Los gastos los aprueba dirección" };
  const { error } = await supabase.from("gastos").update({ decision: "aprobado", motivo_rechazo: null }).eq("rendicion_id", rendicionId).is("decision", null);
  if (error) return { error: error.message };
  await cerrarRevision(supabase, rendicionId, user.id);
  revalidar();
  return { ok: true };
}

/** Vuelve a abrir la revisión (antes del reintegro) para cambiar alguna decisión. */
export async function reabrirRendicion(id: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  if (!apruebaViaticos(await puestoActual(supabase))) return { error: "La revisión la reabre dirección" };
  const { data, error } = await supabase.from("rendiciones").update({ estado: "enviada" }).eq("id", id).in("estado", ["aprobada", "cerrada"]).select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "Ya se reintegró: no se puede reabrir" };
  revalidar();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Administración: reintegrar
// ---------------------------------------------------------------------------

export async function reintegrarRendicion(id: string, fecha: string, nota?: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const user = await usuarioActual();
  if (!user) return { error: "Tenés que entrar de nuevo" };
  if (!reintegraViaticos(await puestoActual(supabase))) return { error: "El reintegro lo marca administración" };
  const dia = leerFecha(fecha, hoyAR());
  if (!dia) return { error: "Poné la fecha del reintegro" };
  const r = await leerRendicion(supabase, id);
  if (!r) return { error: "No se encontró la rendición" };
  if (r.estado !== "aprobada") return { error: "La rendición no está para reintegrar" };
  const { error } = await supabase
    .from("rendiciones")
    .update({ estado: "reintegrada", reintegro_fecha: dia, reintegro_nota: nota?.trim().slice(0, 300) || null })
    .eq("id", id)
    .eq("estado", "aprobada");
  if (error) return { error: error.message };
  const { data } = await supabase.from("gastos").select("id, importe, moneda, medio_pago, decision").eq("rendicion_id", id);
  const devolver = aReintegrar((data ?? []) as GastoRevision[]);
  await avisar(
    supabase,
    [r.usuario_id],
    { tipo: "viaticos", titulo: `Te reintegraron ${textoTotales(devolver)} de la rendición N° ${r.numero} (${dia.split("-").reverse().join("/")})`, url: urlRendicion(id) },
    user.id
  );
  revalidar();
  return { ok: true };
}
