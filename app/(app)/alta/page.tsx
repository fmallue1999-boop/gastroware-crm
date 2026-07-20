import { createClient } from "@/lib/supabase/server";
import AltaForm from "@/components/AltaForm";
import type { Producto } from "@/lib/types";

export default async function AltaPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("productos")
    .select("*")
    .eq("activo", true)
    .eq("es_consumible", false)
    .order("nombre");

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Nuevo lead</h1>
      <p className="text-sm text-piedra mb-5">
        30 segundos: teléfono, nombre, producto y listo.
      </p>
      <AltaForm productos={(data ?? []) as Producto[]} />
    </div>
  );
}
