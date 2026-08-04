import { createClient } from "@/lib/supabase/server";
import ProductoFila from "@/components/admin/ProductoFila";
import FichaProducto from "@/components/admin/FichaProducto";
import AltaProducto from "@/components/admin/AltaProducto";
import type { Producto } from "@/lib/types";

export default async function AdminCatalogoPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("productos")
    .select("*")
    .order("categoria")
    .order("nombre");

  const productos = (data ?? []) as Producto[];
  const categorias = Array.from(new Set(productos.map((p) => p.categoria)));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-xl text-sm text-piedra">
          Precio, garantía y ficha de venta de cada producto. La ficha
          (descripción, argumentos, imagen) alimenta el cotizador, la IA y el
          catálogo público para la web.
        </p>
        <AltaProducto />
      </div>
      {categorias.map((cat) => (
        <section key={cat}>
          <h2 className="mb-2 text-sm font-semibold capitalize text-tinta/80">
            {cat}
          </h2>
          <div className="overflow-hidden rounded-2xl border border-borde bg-white shadow-sm">
            {productos
              .filter((p) => p.categoria === cat)
              .map((p) => (
                <div key={p.id}>
                  <ProductoFila producto={p} />
                  <FichaProducto producto={p} />
                </div>
              ))}
          </div>
        </section>
      ))}
      {productos.length === 0 && (
        <p className="rounded-2xl border border-dashed border-borde p-6 text-center text-sm text-piedra">
          Sin productos en el catálogo.
        </p>
      )}
    </div>
  );
}
