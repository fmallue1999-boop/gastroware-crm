import { createClient } from "@/lib/supabase/server";
import PedidoDirectoForm from "@/components/PedidoDirectoForm";
import type { Producto } from "@/lib/types";

export default async function NuevoPedidoPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("productos")
    .select("*")
    .eq("activo", true)
    .order("nombre");

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-1 text-2xl font-bold tracking-tight">Nuevo pedido</h1>
      <p className="mb-5 text-sm text-piedra">
        Para cuando el cliente ya pidió: se carga como venta hecha y entra
        directo al tablero de pedidos.
      </p>
      <PedidoDirectoForm productos={(data ?? []) as Producto[]} />
    </div>
  );
}
