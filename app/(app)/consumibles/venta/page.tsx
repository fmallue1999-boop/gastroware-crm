import { createClient } from "@/lib/supabase/server";
import { hoyISO } from "@/lib/format";
import VentaConsumiblesForm, { type PlanExistente, type ProductoConsumible } from "@/components/consumibles/VentaConsumiblesForm";
import AyudaLink from "@/components/guia/AyudaLink";

export const metadata = { title: "Venta de consumibles" };

/** Registrar una venta de consumibles (?cliente=, ?productos=id,id, ?sucursal= la precargan). */
export default async function VentaConsumiblesPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string; productos?: string; sucursal?: string }>;
}) {
  const p = await searchParams;
  const supabase = await createClient();
  const uuid = /^[0-9a-f-]{36}$/i;
  const clienteId = uuid.test(p.cliente ?? "") ? p.cliente! : null;
  const [
    {
      data: { user },
    },
    { data: productos },
    { data: usuarios },
    clienteRes,
    sucursalesRes,
    planesRes,
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("productos").select("id, nombre, frecuencia_recompra_dias").eq("activo", true).eq("es_consumible", true).order("nombre"),
    supabase.from("usuarios").select("id, nombre, rol").eq("activo", true).order("nombre"),
    clienteId ? supabase.from("clientes").select("id, nombre_comercial").eq("id", clienteId).maybeSingle() : Promise.resolve({ data: null }),
    clienteId
      ? supabase.from("sucursales").select("id, nombre, ciudad").eq("cliente_id", clienteId).is("deleted_at", null).order("es_principal", { ascending: false })
      : Promise.resolve({ data: [] }),
    clienteId
      ? supabase.from("recurrencias").select("producto_id, sucursal_id, frecuencia_dias, anticipacion_dias, responsable_id").eq("cliente_id", clienteId).eq("activa", true)
      : Promise.resolve({ data: [] }),
  ]);
  const cliente = clienteRes.data as { id: string; nombre_comercial: string } | null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="flex flex-wrap items-center gap-x-2 text-2xl font-extrabold tracking-tight">
          Venta de consumibles <AyudaLink tarea="consumibles" />
        </h1>
        <p className="text-[15px] text-piedra">Cada producto trae su tiempo de reposición: se reinicia con esta compra y lo podés ajustar para este cliente.</p>
      </div>
      <VentaConsumiblesForm
        productos={(productos ?? []) as ProductoConsumible[]}
        usuarios={(usuarios ?? []) as { id: string; nombre: string; rol: string }[]}
        hoy={hoyISO()}
        yo={user?.id ?? ""}
        clienteInicial={cliente ? { id: cliente.id, nombre: cliente.nombre_comercial } : null}
        sucursalesIniciales={(sucursalesRes.data ?? []) as { id: string; nombre: string; ciudad: string | null }[]}
        sucursalInicial={uuid.test(p.sucursal ?? "") ? p.sucursal! : null}
        planes={(planesRes.data ?? []) as PlanExistente[]}
        productosIniciales={(p.productos ?? "").split(",").filter((x) => uuid.test(x))}
      />
    </div>
  );
}
