import { createClient } from "@/lib/supabase/server";
import MaterialForm from "@/components/MaterialForm";
import MaterialItem from "@/components/MaterialItem";
import type { Producto } from "@/lib/types";

export interface MaterialRow {
  id: string;
  nombre: string;
  tipo: string;
  url: string | null;
  producto_id: string | null;
  producto: { nombre: string } | null;
}

export default async function BibliotecaPage() {
  const supabase = await createClient();
  const [materialesRes, productosRes] = await Promise.all([
    supabase
      .from("materiales")
      .select("id, nombre, tipo, url, producto_id, producto:productos(nombre)")
      .order("nombre"),
    supabase
      .from("productos")
      .select("*")
      .eq("activo", true)
      .eq("es_consumible", false)
      .order("nombre"),
  ]);

  const materiales = (materialesRes.data ?? []) as unknown as MaterialRow[];
  const productos = (productosRes.data ?? []) as Producto[];

  const grupos = new Map<string, MaterialRow[]>();
  for (const m of materiales) {
    const k = m.producto?.nombre ?? "Generales (todos los productos)";
    grupos.set(k, [...(grupos.get(k) ?? []), m]);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold mb-1">Biblioteca comercial</h1>
        <p className="text-sm text-piedra">
          Fichas, videos, comparativas y casos — listos para mandar desde cada
          oportunidad.
        </p>
      </div>

      <MaterialForm productos={productos} />

      {materiales.length === 0 ? (
        <div className="rounded-xl border border-dashed border-borde p-5 text-sm text-piedra">
          <p className="font-medium text-tinta/80 mb-1">
            Todavía no hay materiales cargados.
          </p>
          <p>
            Empezá por los de mayor impacto según el análisis: la comparativa
            GX22 vs licuadora doméstica, el video con hielo, la ficha técnica de
            Zumex y la garantía/soporte local de GastroWare.
          </p>
        </div>
      ) : (
        Array.from(grupos.entries()).map(([grupo, items]) => (
          <section key={grupo}>
            <h2 className="text-sm font-semibold mb-2">{grupo}</h2>
            <div className="space-y-2">
              {items.map((m) => (
                <MaterialItem key={m.id} material={m} conBorrar />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
