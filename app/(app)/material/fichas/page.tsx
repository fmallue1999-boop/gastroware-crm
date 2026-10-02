import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { firmarUrls } from "@/lib/core/storage";
import FichasCotizacion, { type FichaLite } from "@/components/admin/FichasCotizacion";

const GESTIONAN = ["marketing", "direccion", "admin"];

/**
 * Fichas para cotizar (v1.15): marketing carga, cambia o quita el PDF (o la
 * imagen) que se anexa al final de cada cotización de ese producto, sin entrar
 * a Administración. Lista todos los productos activos del catálogo por marca.
 */
export default async function FichasParaCotizarPage({ searchParams }: { searchParams: Promise<{ falta?: string }> }) {
  const { falta } = await searchParams;
  const soloSinFicha = falta === "1";
  const supabase = await createClient();
  const { data: rol } = await supabase.rpc("fn_rol");
  if (!GESTIONAN.includes((rol as string) ?? "")) redirect("/material");

  const [{ data: productos }, { data: docs }, { data: vinculados }] = await Promise.all([
    supabase.from("productos").select("id, nombre, marca, categoria").eq("activo", true).order("marca").order("nombre"),
    supabase.from("documentos").select("id, entidad_id, nombre, path, created_at").eq("entidad", "producto").eq("tipo", "ficha").order("created_at"),
    supabase.from("material_productos").select("id, producto_id").not("producto_id", "is", null),
  ]);
  const materialDe = new Map(((vinculados ?? []) as { id: string; producto_id: string }[]).map((m) => [m.id, m.producto_id]));
  const { data: fichasMaterial } = materialDe.size
    ? await supabase.from("material_archivos").select("dueno_id").eq("dueno", "producto").eq("espacio", "ficha").in("dueno_id", [...materialDe.keys()])
    : { data: [] };
  const conFichaEnMaterial = new Set(((fichasMaterial ?? []) as { dueno_id: string }[]).map((f) => materialDe.get(f.dueno_id)));

  const lista = (docs ?? []) as { id: string; entidad_id: string; nombre: string; path: string }[];
  const urls = await firmarUrls("documentos", lista.map((d) => d.path));
  const fichasDe = new Map<string, FichaLite[]>();
  lista.forEach((d, k) => fichasDe.set(d.entidad_id, [...(fichasDe.get(d.entidad_id) ?? []), { id: d.id, nombre: d.nombre, url: urls[k] }]));

  const todos = (productos ?? []) as { id: string; nombre: string; marca: string | null; categoria: string | null }[];
  const tiene = (id: string) => (fichasDe.get(id)?.length ?? 0) > 0 || conFichaEnMaterial.has(id);
  const conFicha = todos.filter((p) => tiene(p.id)).length;
  const visibles = soloSinFicha ? todos.filter((p) => !tiene(p.id)) : todos;
  const marcas = [...new Set(visibles.map((p) => p.marca ?? "Otras"))];

  const chip = (activo: boolean) =>
    `inline-flex min-h-10 items-center rounded-full px-4 text-[15px] font-bold ${activo ? "bg-marino text-white" : "border border-borde bg-white text-tinta"}`;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <header className="flex items-start gap-2">
        <Link href="/material" aria-label="Volver a Material" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-borde bg-white">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Fichas para cotizar</h1>
          <p className="text-[15px] text-piedra">
            El PDF (o la imagen) de cada producto sale solo al final de cada cotización que lo lleve. {conFicha} de {todos.length} productos ya tienen ficha.
          </p>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        <Link href="/material/fichas" className={chip(!soloSinFicha)}>
          Todos ({todos.length})
        </Link>
        <Link href="/material/fichas?falta=1" className={chip(soloSinFicha)}>
          Sin ficha ({todos.length - conFicha})
        </Link>
      </div>

      {visibles.length === 0 && <p className="rounded-2xl bg-white px-4 py-6 text-center text-lg font-bold text-verde shadow-sm">Todos los productos tienen ficha.</p>}

      {marcas.map((m) => (
        <section key={m} className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wide text-piedra">{m}</h2>
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {visibles
              .filter((p) => (p.marca ?? "Otras") === m)
              .map((p) => (
                <div key={p.id} className="space-y-2 rounded-2xl bg-white p-3 shadow-sm">
                  <p className="flex flex-wrap items-center gap-2 text-[15px] font-extrabold">
                    {p.nombre}
                    {tiene(p.id) ? (
                      <span className="rounded-full bg-verde-soft px-2 py-0.5 text-xs font-bold text-verde">con ficha</span>
                    ) : (
                      <span className="rounded-full bg-ambar-soft px-2 py-0.5 text-xs font-bold text-ambar">sin ficha</span>
                    )}
                  </p>
                  {conFichaEnMaterial.has(p.id) && (
                    <p className="text-xs text-piedra">Tiene la ficha cargada en Material: también se anexa.</p>
                  )}
                  <FichasCotizacion productoId={p.id} fichas={fichasDe.get(p.id) ?? []} />
                </div>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
