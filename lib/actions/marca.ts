"use server";

// Marca del sistema (Administración → Marca): nombre, etiqueta, tema y logos.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { esGestor } from "@/lib/puestos";
import { CLAVES_MARCA, TEMAS, type TemaId } from "@/lib/marca";
import { CAMPOS_COTIZACION, type ClaveCotizacion } from "@/lib/cotizacion-pdf";
import { puestoActual } from "./comun";

const logoValido = (u: string) => u === "" || /^https:\/\/[^\s"'<>]+$/.test(u) || /^\/marca\/[\w.-]+$/.test(u);

export async function guardarMarca(input: {
  nombre: string;
  etiqueta: string;
  tema: TemaId;
  color: string | null;
  logoOscuro: string;
  logoClaro: string;
}) {
  const supabase = await createClient();
  if (!esGestor(await puestoActual(supabase))) return { error: "La marca la define dirección" };
  const nombre = input.nombre.trim();
  if (!nombre) return { error: "Poné el nombre del sistema" };
  if (nombre.length > 40) return { error: "El nombre es muy largo (máximo 40 letras)" };
  const etiqueta = input.etiqueta.trim();
  if (etiqueta.length > 8) return { error: "La etiqueta es muy larga (máximo 8 letras)" };
  if (input.tema !== "personalizado" && !TEMAS.some((t) => t.id === input.tema)) return { error: "Tema inválido" };
  if (input.tema === "personalizado" && !/^#[0-9a-fA-F]{6}$/.test(input.color ?? "")) return { error: "Elegí el color principal" };
  const logoOscuro = input.logoOscuro.trim();
  const logoClaro = input.logoClaro.trim();
  if (!logoValido(logoOscuro) || !logoValido(logoClaro)) return { error: "El link del logo no es válido" };

  const filas = [
    { clave: CLAVES_MARCA.nombre, valor: nombre },
    { clave: CLAVES_MARCA.etiqueta, valor: etiqueta },
    { clave: CLAVES_MARCA.tema, valor: input.tema },
    { clave: CLAVES_MARCA.color, valor: input.tema === "personalizado" ? (input.color as string) : "" },
    { clave: CLAVES_MARCA.logoOscuro, valor: logoOscuro },
    { clave: CLAVES_MARCA.logoClaro, valor: logoClaro },
  ];
  const { error } = await supabase.from("config").upsert(filas, { onConflict: "clave" });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** Datos del membrete de la cotización en PDF (v1.8). Solo claves conocidas. */
export async function guardarDatosCotizacion(valores: Partial<Record<ClaveCotizacion, string>>) {
  const supabase = await createClient();
  if (!esGestor(await puestoActual(supabase))) return { error: "Los datos de la empresa los define dirección" };
  const filas = CAMPOS_COTIZACION.filter((c) => c.clave in valores).map((c) => ({ clave: c.clave, valor: (valores[c.clave] ?? "").trim() }));
  const pv = filas.find((f) => f.clave === "cotizacion_punto_venta");
  if (pv && !/^\d{1,4}$/.test(pv.valor)) return { error: "El punto de venta son hasta 4 números (ej: 0007)" };
  if (pv) pv.valor = pv.valor.padStart(4, "0");
  const moneda = filas.find((f) => f.clave === "cotizacion_moneda");
  if (moneda && !["USD", "ARS", ""].includes(moneda.valor)) return { error: "Moneda inválida" };
  // Las listas: una opción por renglón, sin renglones vacíos
  for (const f of filas)
    if (["cotizacion_formas_pago", "cotizacion_plazos_entrega", "cotizacion_condiciones_entrega"].includes(f.clave))
      f.valor = f.valor
        .split(/\r?\n/)
        .map((x) => x.trim())
        .filter(Boolean)
        .join("\n");
  if (filas.some((f) => f.valor.length > 1000)) return { error: "Hay un texto demasiado largo" };
  const { error } = await supabase.from("config").upsert(filas, { onConflict: "clave" });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** Desde qué número siguen las cotizaciones (tiene que ser mayor que el último). */
export async function fijarProximoNumeroCotizacion(numero: number) {
  if (!Number.isInteger(numero) || numero < 1 || numero > 99_999_999) return { error: "Poné un número entero" };
  const supabase = await createClient();
  if (!esGestor(await puestoActual(supabase))) return { error: "La numeración la define dirección" };
  const { error } = await supabase.rpc("fn_proximo_numero_cotizacion", { p_numero: numero });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true as const };
}
