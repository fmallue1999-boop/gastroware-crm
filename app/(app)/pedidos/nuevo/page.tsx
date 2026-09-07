import { createClient } from "@/lib/supabase/server";
import PedidoDirectoForm from "@/components/PedidoDirectoForm";
import type { Producto } from "@/lib/types";

export default async function NuevaVentaPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>;
}) {
  const { cliente: clienteId } = await searchParams;
  const supabase = await createClient();
  const [{ data }, clienteRes] = await Promise.all([
    supabase.from("productos").select("*").eq("activo", true).order("nombre"),
    clienteId
      ? supabase
          .from("clientes")
          .select("id, nombre_comercial")
          .eq("id", clienteId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const cliente = clienteRes.data as { id: string; nombre_comercial: string } | null;

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-1 text-2xl font-bold tracking-tight">Nueva venta</h1>
      <p className="mb-5 text-sm text-piedra">
        Qué se vendió y a quién. Entra al tablero de ventas como “Vendido”.
      </p>
      <PedidoDirectoForm
        productos={(data ?? []) as Producto[]}
        clienteInicial={cliente ? { id: cliente.id, nombre: cliente.nombre_comercial } : null}
      />
    </div>
  );
}
