import { createClient } from "@/lib/supabase/server";
import ProductoFila from "@/components/admin/ProductoFila";
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
      <p className="text-sm text-piedra">
        Precio de referencia y garantía de cada producto del catálogo. Los
        cambios impactan en cotizaciones nuevas y en el cálculo de garantía de
        equipos nuevos (los ya cargados no cambian).
      </p>
      {categorias.map((cat) => (
        <section key={cat}>
          <h2 className="mb-2 text-sm font-semibold capitalize text-tinta/80">
            {cat}
          </h2>
          <div className="overflow-hidden rounded-2xl border border-borde bg-white shadow-sm">
            {productos
              .filter((p) => p.categoria === cat)
              .map((p) => (
                <ProductoFila key={p.id} producto={p} />
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
