import { NextResponse } from "next/server";
import { zipSync } from "fflate";
import { createClient } from "@/lib/supabase/server";
import { ordenNatural } from "@/lib/contenidos";
import { slugDe } from "@/lib/material";

export const maxDuration = 60;

/** Todas las imágenes de un producto en un .zip (v1.11), con la sesión del usuario. */
export async function GET(_request: Request, { params }: { params: Promise<{ marca: string; producto: string }> }) {
  const { producto: slug } = await params;
  const supabase = await createClient();
  const { data: producto } = await supabase.from("material_productos").select("id, nombre").eq("slug", slug).maybeSingle();
  if (!producto) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const { data } = await supabase
    .from("material_archivos")
    .select("nombre, path")
    .eq("dueno", "producto")
    .eq("dueno_id", producto.id)
    .eq("espacio", "imagenes");
  const archivos = ordenNatural((data ?? []) as { nombre: string; path: string }[]);
  if (!archivos.length) return NextResponse.json({ error: "Sin imágenes" }, { status: 404 });

  const bajadas = await Promise.all(
    archivos.map(async (a) => {
      const { data: blob } = await supabase.storage.from("material").download(a.path);
      return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
    })
  );
  const usados = new Set<string>();
  const entradas: Record<string, [Uint8Array, { level: 0 }]> = {};
  archivos.forEach((a, i) => {
    const bytes = bajadas[i];
    if (!bytes) return;
    let nombre = a.nombre;
    for (let n = 2; usados.has(nombre); n++) nombre = a.nombre.replace(/(\.[^.]*)?$/, `-${n}$1`);
    usados.add(nombre);
    entradas[nombre] = [bytes, { level: 0 }]; // las imágenes ya vienen comprimidas
  });
  const zip = zipSync(entradas);
  const archivo = `${slugDe(producto.nombre as string)}-imagenes.zip`;
  return new NextResponse(Buffer.from(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${archivo}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
