"use server";

// Marca del sistema (Administración → Marca): nombre, etiqueta, tema y logos.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { esGestor } from "@/lib/puestos";
import { CLAVES_MARCA, TEMAS, type TemaId } from "@/lib/marca";
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
