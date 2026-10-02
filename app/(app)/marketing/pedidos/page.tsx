import { createClient } from "@/lib/supabase/server";
import PedidosMaterial, { type PedidoMaterial } from "@/components/marketing/PedidosMaterial";
import AyudaLink from "@/components/guia/AyudaLink";

/** Pedidos de contenido a marketing (manual 4.6; v1.23 con aprobación de dirección). */
export default async function PedidosMaterialPage() {
  const supabase = await createClient();
  const [{ data }, { data: usuarios }] = await Promise.all([
    supabase.from("pedidos_material").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("usuarios").select("id, nombre"),
  ]);
  const filas = (data ?? []) as (Omit<PedidoMaterial, "quien" | "hace" | "archivos"> & {
    pedido_por: string | null;
    tomado_por: string | null;
    espacio_destino_id: string | null;
  })[];
  // Cuántos archivos: los entregados del pedido y, si se aprobó, los que quedaron en el espacio
  const { data: entregas } = filas.length
    ? await supabase.from("material_archivos").select("dueno_id").eq("dueno", "pedido").in("dueno_id", filas.map((p) => p.id))
    : { data: [] };
  const cuenta = new Map<string, number>();
  for (const a of (entregas ?? []) as { dueno_id: string }[]) cuenta.set(a.dueno_id, (cuenta.get(a.dueno_id) ?? 0) + 1);
  const nombres = new Map(((usuarios ?? []) as { id: string; nombre: string }[]).map((u) => [u.id, u.nombre]));
  const pedidos: PedidoMaterial[] = filas.map((p) => ({
    ...p,
    quien: p.pedido_por ? (nombres.get(p.pedido_por) ?? null) : null,
    hace: p.tomado_por ? (nombres.get(p.tomado_por) ?? null) : null,
    archivos: cuenta.get(p.id) ?? 0,
  }));
  return (
    <div className="space-y-3">
      <div>
        <h1 className="flex flex-wrap items-center gap-x-2 text-2xl font-extrabold tracking-tight">
          Pedidos a marketing <AyudaLink tarea="pedir-material" />
        </h1>
        <p className="text-[15px] text-piedra">
          Se pide → marketing lo hace y lo sube → dirección lo aprueba o pide cambios → queda en Material.
        </p>
      </div>
      <PedidosMaterial pedidos={pedidos} />
    </div>
  );
}
