import { createClient } from "@/lib/supabase/server";
import { esGestor } from "@/lib/puestos";
import PedidosMaterial, { type PedidoMaterial } from "@/components/marketing/PedidosMaterial";
import AyudaLink from "@/components/guia/AyudaLink";

/** Pedidos de material a marketing (manual 4.6). */
export default async function PedidosMaterialPage() {
  const supabase = await createClient();
  const [{ data: rol }, { data }, { data: usuarios }] = await Promise.all([
    supabase.rpc("fn_rol"),
    supabase.from("pedidos_material").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("usuarios").select("id, nombre"),
  ]);
  const nombres = new Map(((usuarios ?? []) as { id: string; nombre: string }[]).map((u) => [u.id, u.nombre]));
  const pedidos = ((data ?? []) as (Omit<PedidoMaterial, "quien"> & { pedido_por: string | null })[]).map((p) => ({
    ...p,
    quien: p.pedido_por ? nombres.get(p.pedido_por) ?? null : null,
  }));
  return (
    <div className="space-y-3">
      <div>
        <h1 className="flex flex-wrap items-center gap-x-2 text-2xl font-extrabold tracking-tight">
          Pedidos de material <AyudaLink tarea="pedir-material" />
        </h1>
        <p className="text-[15px] text-piedra">Folletos, videos, fichas o posteos que necesita comercial. Marketing compromete la fecha.</p>
      </div>
      <PedidosMaterial pedidos={pedidos} gestiona={rol === "marketing" || esGestor(rol as string)} />
    </div>
  );
}
