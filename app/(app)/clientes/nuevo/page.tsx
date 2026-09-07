import { createClient } from "@/lib/supabase/server";
import { infoStockPorProducto } from "@/lib/stock";
import ContactoNuevoForm from "@/components/ContactoNuevoForm";
import type { Producto } from "@/lib/types";

/** Contacto suelto (sin interés): para cargar un cliente de service o de cartera. */
export default async function NuevoContactoPage() {
  const supabase = await createClient();
  const [{ data }, stockInfo] = await Promise.all([
    supabase
      .from("productos")
      .select("*")
      .eq("activo", true)
      .eq("es_consumible", false)
      .order("nombre"),
    infoStockPorProducto(supabase),
  ]);

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-1 text-2xl font-bold tracking-tight">Nuevo contacto</h1>
      <p className="mb-5 text-sm text-piedra">
        Para cargar a alguien sin una consulta puntual. Nombre y teléfono alcanzan.
      </p>
      <ContactoNuevoForm productos={(data ?? []) as Producto[]} stockInfo={stockInfo} />
    </div>
  );
}
