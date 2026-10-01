"use server";

// Administración: importación, checklists, notificaciones, push, catálogo, usuarios, config y sesión.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { rolActual } from "@/lib/auth";
import { usuarioActual } from "./comun";

// =====================================================================
// Importación de clientes (Excel/CSV)
// =====================================================================

export type FilaImport = {
  nombre_comercial: string;
  razon_social?: string;
  cuit?: string;
  condicion_fiscal?: string;
  rubro?: string;
  telefono?: string;
  email?: string;
  ciudad?: string;
  provincia?: string;
  direccion?: string;
  notas?: string;
};

const soloDigitos = (s: string | undefined | null) => {
  let d = (s ?? "").replace(/\D/g, "");
  if (d.startsWith("549")) d = d.slice(3);
  else if (d.startsWith("54") && d.length > 10) d = d.slice(2);
  return d;
};

/**
 * Importa un lote de clientes (máx 200 por llamada; el cliente manda de a
 * tandas). Dedup contra la base y dentro del archivo por teléfono y CUIT.
 */
export async function importarClientes(
  filas: FilaImport[],
  opciones: { estado: "cliente_activo" | "prospecto" }
) {
  const rol = await rolActual();
  if (!["direccion", "admin"].includes(rol))
    return { error: "Solo dirección o administración pueden importar" };
  if (filas.length > 200) return { error: "Máximo 200 filas por tanda" };

  const supabase = await createClient();

  // Mapa de existentes para dedup (teléfonos y CUITs)
  const { data: existentes } = await supabase
    .from("clientes")
    .select("telefono, cuit")
    .is("deleted_at", null)
    .limit(10000);
  const telefonos = new Set(
    (existentes ?? []).map((c) => soloDigitos(c.telefono)).filter((d) => d.length >= 8)
  );
  const cuits = new Set(
    (existentes ?? []).map((c) => (c.cuit ?? "").replace(/\D/g, "")).filter(Boolean)
  );

  let creados = 0;
  let salteados = 0;
  const errores: string[] = [];

  for (const fila of filas) {
    const nombre = (fila.nombre_comercial ?? "").trim();
    if (!nombre) {
      salteados++;
      continue;
    }
    const tel = soloDigitos(fila.telefono);
    const cuit = (fila.cuit ?? "").replace(/\D/g, "");
    if ((tel.length >= 8 && telefonos.has(tel)) || (cuit && cuits.has(cuit))) {
      salteados++;
      continue;
    }

    const condicion = (fila.condicion_fiscal ?? "")
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z_]/g, "");
    const condicionValida = [
      "responsable_inscripto",
      "monotributo",
      "exento",
      "consumidor_final",
    ].includes(condicion)
      ? condicion
      : null;

    const { data: nuevo, error } = await supabase
      .from("clientes")
      .insert({
        nombre_comercial: nombre.slice(0, 120),
        razon_social: fila.razon_social?.trim() || null,
        cuit: cuit ? cuit.slice(0, 11) : null,
        condicion_fiscal: condicionValida,
        rubro: fila.rubro?.trim() || "Otro",
        telefono: fila.telefono?.trim() || null,
        email: fila.email?.trim() || null,
        estado: opciones.estado,
        notas: fila.notas?.trim() || null,
      })
      .select("id")
      .single();

    if (error || !nuevo) {
      errores.push(`${nombre}: ${error?.message ?? "error"}`);
      if (errores.length >= 10) break;
      continue;
    }
    if (tel.length >= 8) telefonos.add(tel);
    if (cuit) cuits.add(cuit);
    creados++;

    if (fila.ciudad?.trim() || fila.direccion?.trim() || fila.provincia?.trim()) {
      await supabase.from("sucursales").insert({
        cliente_id: nuevo.id,
        nombre: "Principal",
        direccion: fila.direccion?.trim() || null,
        ciudad: fila.ciudad?.trim() || null,
        provincia: fila.provincia?.trim() || null,
        es_principal: true,
      });
    }
  }

  revalidatePath("/", "layout");
  return { ok: true, creados, salteados, errores };
}
// =====================================================================
// Checklists
// =====================================================================

export async function guardarChecklistPlantilla(input: {
  id?: string | null;
  nombre: string;
  modeloId: string | null;
  items: string[];
}) {
  const supabase = await createClient();
  const fila = {
    nombre: input.nombre.trim(),
    modelo_id: input.modeloId,
    items: input.items.map((i) => i.trim()).filter(Boolean),
  };
  if (!fila.nombre) return { error: "Falta el nombre" };
  if (fila.items.length === 0) return { error: "Cargá al menos un ítem" };
  const { error } = input.id
    ? await supabase.from("checklist_plantillas").update(fila).eq("id", input.id)
    : await supabase.from("checklist_plantillas").insert(fila);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function borrarChecklistPlantilla(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("checklist_plantillas")
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}
// =====================================================================
// Notificaciones internas
// =====================================================================

export async function marcarNotificacionLeida(id: string) {
  const supabase = await createClient();
  await supabase
    .from("notificaciones")
    .update({ leida_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function marcarTodasLeidas() {
  const supabase = await createClient();
  const user = await usuarioActual();
  if (!user) return { error: "Sin sesión" };
  await supabase
    .from("notificaciones")
    .update({ leida_at: new Date().toISOString() })
    .eq("usuario_id", user.id)
    .is("leida_at", null);
  revalidatePath("/", "layout");
  return { ok: true };
}
// =====================================================================
// Push
// =====================================================================

export async function guardarSuscripcionPush(sub: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}) {
  const supabase = await createClient();
  const user = await usuarioActual();
  if (!user) return { error: "Sin sesión" };
  const { error } = await supabase.from("push_subs").upsert(
    { usuario_id: user.id, endpoint: sub.endpoint, subscription: sub },
    { onConflict: "endpoint" }
  );
  if (error) return { error: error.message };
  return { ok: true };
}

export async function borrarSuscripcionPush(endpoint: string) {
  const supabase = await createClient();
  await supabase.from("push_subs").delete().eq("endpoint", endpoint);
  return { ok: true };
}
// =====================================================================
// Administración
// =====================================================================

/**
 * Crea una subida firmada al bucket público biblioteca. El navegador después
 * sube el archivo con el token (uploadToSignedUrl), sin depender de que la
 * sesión del navegador llegue al storage — evita falsos "row-level security".
 */
export async function crearSubidaBiblioteca(
  nombreArchivo: string,
  carpeta?: string
) {
  const rol = await rolActual();
  if (!["direccion", "admin", "marketing"].includes(rol))
    return { error: "Sin permiso para subir archivos" };
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/\s+/g, "");
  if (!serviceKey)
    return { error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor" };

  const { createClient: createAdmin } = await import("@supabase/supabase-js");
  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const limpio = nombreArchivo.replace(/[^\w.\-]/g, "_");
  const path = `${carpeta ? `${carpeta}/` : ""}${Date.now()}-${limpio}`;
  const { data, error } = await admin.storage
    .from("biblioteca")
    .createSignedUploadUrl(path);
  if (error || !data) return { error: error?.message ?? "No se pudo firmar" };
  return { ok: true as const, path: data.path, token: data.token };
}

export async function setConfigValor(clave: string, valor: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("config")
    .upsert({ clave, valor }, { onConflict: "clave" });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function crearMaterial(input: {
  nombre: string;
  tipo: string;
  producto_id?: string | null;
  url: string;
}) {
  if (!input.nombre.trim() || !input.url.trim())
    return { error: "Nombre y link son obligatorios" };
  const supabase = await createClient();
  const { error } = await supabase.from("materiales").insert({
    nombre: input.nombre.trim(),
    tipo: input.tipo,
    producto_id: input.producto_id || null,
    url: input.url.trim(),
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function borrarMaterial(id: string) {
  const supabase = await createClient();
  await supabase.from("materiales").delete().eq("id", id);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Alta de usuario (requiere SUPABASE_SERVICE_ROLE_KEY configurada). */
export async function crearUsuario(input: {
  email: string;
  nombre: string;
  rol: string;
  passwordInicial: string;
}) {
  const rol = await rolActual();
  if (!["direccion", "admin"].includes(rol))
    return { error: "Solo dirección o administración pueden crear usuarios" };
  if (rol === "admin" && ["direccion", "admin"].includes(input.rol))
    return { error: "Solo dirección puede crear usuarios de dirección o administración" };
  // Las claves nunca llevan espacios: si el copy/paste en Vercel metió un
  // salto de línea o espacio, lo limpiamos en vez de fallar con un header inválido
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/\s+/g, "");
  if (!serviceKey)
    return {
      error:
        "Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno (Vercel → Settings → Environment Variables)",
    };

  const { createClient: createAdmin } = await import("@supabase/supabase-js");
  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data, error } = await admin.auth.admin.createUser({
    email: input.email.trim(),
    password: input.passwordInicial,
    email_confirm: true,
    user_metadata: { nombre: input.nombre.trim() },
  });
  if (error || !data.user) return { error: error?.message ?? "No se pudo crear" };

  await admin
    .from("usuarios")
    .upsert({ id: data.user.id, nombre: input.nombre.trim(), rol: input.rol });

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function actualizarUsuario(
  usuarioId: string,
  patch: { nombre?: string; rol?: string; activo?: boolean; telefono?: string | null; territorio?: string | null; ve_contenidos?: boolean }
) {
  const rol = await rolActual();
  if (!["direccion", "admin"].includes(rol))
    return { error: "Sin permiso" };
  if (patch.rol && rol !== "direccion")
    return { error: "Solo dirección puede cambiar roles" };
  const supabase = await createClient();
  const limpio: Record<string, unknown> = { ...patch };
  if ("telefono" in patch) limpio.telefono = patch.telefono?.trim() || null;
  if ("territorio" in patch) limpio.territorio = patch.territorio || null;
  const { error } = await supabase
    .from("usuarios")
    .update(limpio)
    .eq("id", usuarioId);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function guardarProducto(
  productoId: string | null,
  patch: {
    nombre?: string;
    precio_referencia?: number | null;
    moneda?: string;
    /** Precio de lista en pesos y en dólares (migración 033). */
    precio_ars?: number | null;
    precio_usd?: number | null;
    garantia_meses?: number | null;
    activo?: boolean;
    descripcion?: string | null;
    destacados?: string[];
    imagen_url?: string | null;
    /** Consumibles: cada cuántos días repone un cliente típico (se reinicia con cada compra). */
    frecuencia_recompra_dias?: number | null;
    /** Código y detalle técnico: salen en la línea del PDF de la cotización. */
    codigo?: string | null;
    detalle_tecnico?: string | null;
    /** IVA del producto (v1.12): lo usa la cotización, no lo elige el vendedor. */
    iva_pct?: number | null;
  }
) {
  if (patch.iva_pct != null && ![0, 10.5, 21, 27].includes(patch.iva_pct)) return { error: "El IVA va 10,5%, 21%, 27% o exento" };
  if (patch.frecuencia_recompra_dias != null && (!Number.isInteger(patch.frecuencia_recompra_dias) || patch.frecuencia_recompra_dias < 1 || patch.frecuencia_recompra_dias > 730))
    return { error: "El tiempo de reposición va de 1 a 730 días" };
  const supabase = await createClient();
  if (productoId) {
    const { error } = await supabase
      .from("productos")
      .update(patch)
      .eq("id", productoId);
    if (error) return { error: error.message };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function crearProducto(input: {
  nombre: string;
  marca?: string;
  categoria: string;
  moneda: string;
  precio_referencia?: number | null;
  precio_ars?: number | null;
  precio_usd?: number | null;
  garantia_meses?: number | null;
}) {
  const rol = await rolActual();
  if (!["direccion", "admin"].includes(rol)) return { error: "Sin permiso" };
  if (!input.nombre.trim()) return { error: "Falta el nombre" };
  const supabase = await createClient();
  const { error } = await supabase.from("productos").insert({
    nombre: input.nombre.trim(),
    marca: input.marca?.trim() || null,
    categoria: input.categoria || "otro",
    moneda: input.moneda || "ARS",
    precio_referencia: input.precio_referencia ?? null,
    precio_ars: input.precio_ars ?? null,
    precio_usd: input.precio_usd ?? null,
    garantia_meses: input.garantia_meses ?? null,
    // Los consumibles se marcan como tales (reposición en el apartado Consumibles)
    es_consumible: input.categoria === "consumible",
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function guardarPlantilla(
  plantillaId: string,
  contenido: string
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("plantillas")
    .update({ contenido })
    .eq("id", plantillaId);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function guardarRepuesto(input: {
  id?: string | null;
  codigo_interno?: string;
  descripcion: string;
  marca?: string;
  precio?: number | null;
  costo?: number | null;
  moneda?: string;
  stock_minimo?: number | null;
}) {
  const supabase = await createClient();
  const fila = {
    stock_minimo: input.stock_minimo ?? null,
    codigo_interno: input.codigo_interno?.trim() || null,
    descripcion: input.descripcion.trim(),
    marca: input.marca?.trim() || null,
    precio: input.precio ?? null,
    costo: input.costo ?? null,
    moneda: input.moneda || "ARS",
  };
  const { error } = input.id
    ? await supabase.from("repuestos").update(fila).eq("id", input.id)
    : await supabase.from("repuestos").insert(fila);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

// =====================================================================
// Sesión
// =====================================================================

export async function cerrarSesion() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
