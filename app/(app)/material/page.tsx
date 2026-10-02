import Link from "next/link";
import { ChevronRight, FileText, Folder, Table2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buscarMaterial } from "@/lib/material";
import { cargarArbol, espaciosDe, puedeGestionarMaterial } from "@/lib/servidor/material";
import { BuscadorMaterial } from "@/components/material/Navegacion";
import { NuevoEspacio } from "@/components/material/EspaciosPropios";

/**
 * Material, la biblioteca comercial (v1.11): buscador, una tarjeta grande
 * por marca y la tabla general de videos por producto. v1.23: los espacios
 * generales que crea marketing (presentaciones, redes, pedidos aprobados…).
 */
export default async function MaterialPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const busqueda = q?.trim() ?? "";
  const supabase = await createClient();
  const [arbol, { data: rol }, espacios, gestiona] = await Promise.all([
    cargarArbol(supabase),
    supabase.rpc("fn_rol"),
    espaciosDe(supabase, "general"),
    puedeGestionarMaterial(supabase),
  ]);
  const cargaFichas = ["marketing", "direccion", "admin"].includes((rol as string) ?? "");
  const resultados = busqueda ? buscarMaterial(busqueda, arbol) : [];

  const productosDe = (marcaId: string) => {
    const cats = new Set(arbol.categorias.filter((c) => c.marca_id === marcaId).map((c) => c.id));
    return arbol.productos.filter((p) => cats.has(p.categoria_id)).length;
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Material</h1>
        <p className="text-[15px] text-piedra">Videos, imágenes, fichas y todo el contenido de marketing, listo para mandar al cliente.</p>
      </div>
      <BuscadorMaterial q={busqueda} />

      {busqueda ? (
        <section className="space-y-2">
          <p className="text-sm font-bold text-piedra">
            {resultados.length ? `${resultados.length} resultado${resultados.length === 1 ? "" : "s"} para “${busqueda}”` : `No encontramos “${busqueda}”.`}
            {" "}
            <Link href="/material" className="text-marino underline">
              Limpiar
            </Link>
          </p>
          <div className="overflow-hidden rounded-2xl border border-borde bg-white shadow-sm">
            {resultados.map((r) => (
              <Link key={r.href} href={r.href} className="flex items-center gap-3 border-b border-borde/70 px-4 py-3 last:border-0 hover:bg-crema">
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-extrabold">{r.titulo}</span>
                  <span className="block text-xs font-semibold text-piedra">{r.ruta.join(" › ")}</span>
                </span>
                <span className="shrink-0 rounded-full bg-crema px-2.5 py-0.5 text-xs font-bold text-piedra">
                  {r.tipo === "producto" ? "Producto" : r.tipo === "categoria" ? "Categoría" : "Marca"}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-piedra" />
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {arbol.marcas.map((m) => (
              <Link
                key={m.id}
                href={`/material/${m.slug}`}
                className="group flex min-h-40 flex-col justify-between rounded-3xl bg-marino p-6 text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <span className="text-3xl font-extrabold tracking-tight">{m.nombre}</span>
                <span className="flex items-center justify-between text-sm font-semibold text-white/70">
                  {productosDe(m.id)} productos
                  <ChevronRight className="h-5 w-5 text-celeste transition group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>
          {(espacios.length > 0 || gestiona) && (
            <section className="space-y-2">
              <h2 className="text-xs font-extrabold tracking-[0.15em] text-piedra">ESPACIOS</h2>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {espacios.map((e) => (
                  <Link key={e.id} href={`/material/espacio/${e.id}`} className="flex items-center gap-3 rounded-2xl border border-borde bg-white p-4 shadow-sm hover:bg-crema">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-celeste-soft text-azul">
                      <Folder className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px] font-extrabold">{e.nombre}</span>
                      <span className="block truncate text-sm text-piedra">
                        {e.cantidad} archivo{e.cantidad === 1 ? "" : "s"}
                        {e.descripcion ? ` · ${e.descripcion}` : ""}
                      </span>
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-piedra" />
                  </Link>
                ))}
              </div>
              {gestiona && <NuevoEspacio ambito="general" irAlCrear />}
            </section>
          )}
          <Link
            href="/material/por-producto"
            className="flex items-center gap-3 rounded-2xl border border-borde bg-white p-4 shadow-sm hover:bg-crema"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-celeste-soft text-azul">
              <Table2 className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-extrabold">Material por producto</span>
              <span className="block text-sm text-piedra">Todos los productos con sus videos de cómo usar, configurar y lavar.</span>
            </span>
            <ChevronRight className="h-5 w-5 text-piedra" />
          </Link>
          {cargaFichas && (
            <Link
              href="/material/fichas"
              className="flex items-center gap-3 rounded-2xl border border-borde bg-white p-4 shadow-sm hover:bg-crema"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-celeste-soft text-azul">
                <FileText className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-extrabold">Fichas para cotizar</span>
                <span className="block text-sm text-piedra">El PDF de cada producto que sale al final de las cotizaciones: cargar, cambiar o quitar.</span>
              </span>
              <ChevronRight className="h-5 w-5 text-piedra" />
            </Link>
          )}
        </>
      )}
    </div>
  );
}
