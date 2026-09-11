import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ETAPAS, ETAPAS_ABIERTAS } from "@/lib/constants";
import { dinero, diasDesde, hoyISO } from "@/lib/format";
import { sumarPorMoneda } from "@/lib/dinero";
import Montos from "@/components/Montos";
import { TempBadge, ProductoBadge } from "@/components/Badges";
import type { Oportunidad, Producto } from "@/lib/types";

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ producto?: string }>;
}) {
  const { producto } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("oportunidades")
    .select("*, cliente:clientes(*), producto:productos(*)")
    .in("etapa", [...ETAPAS_ABIERTAS])
    .order("created_at", { ascending: false })
    .limit(300);
  if (producto) query = query.eq("producto_id", producto);

  const [{ data }, { data: prods }] = await Promise.all([
    query,
    supabase
      .from("productos")
      .select("*")
      .eq("activo", true)
      .eq("es_consumible", false)
      .order("nombre"),
  ]);

  const oportunidades = (data ?? []) as unknown as Oportunidad[];
  const productos = (prods ?? []) as Producto[];

  // Próxima acción por oportunidad (para avisar cuáles quedaron sin seguimiento)
  const hoy = hoyISO();
  const ids = oportunidades.map((o) => o.id);
  const { data: tareasAbiertas } = ids.length
    ? await supabase
        .from("tareas")
        .select("oportunidad_id, vence_el")
        .in("oportunidad_id", ids)
        .is("completada_at", null)
        .eq("cancelada", false)
    : { data: [] };
  const proximaAccion = new Map<string, string>();
  for (const t of (tareasAbiertas ?? []) as {
    oportunidad_id: string | null;
    vence_el: string;
  }[]) {
    if (!t.oportunidad_id) continue;
    const actual = proximaAccion.get(t.oportunidad_id);
    if (!actual || t.vence_el < actual)
      proximaAccion.set(t.oportunidad_id, t.vence_el);
  }
  const columnas = ETAPAS.filter((e) =>
    (ETAPAS_ABIERTAS as readonly string[]).includes(e.value)
  );

  // Totales por moneda, sin mezclar (antes solo se sumaba ARS y USD quedaba afuera)
  const totalPipeline = sumarPorMoneda(
    oportunidades.map((o) => ({ monto: o.monto_estimado, moneda: o.moneda }))
  );

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1">
        <h1 className="text-2xl font-bold tracking-tight">Pipeline</h1>
        <span className="text-sm text-piedra">
          {oportunidades.length} abiertas · <Montos por={totalPipeline} inline />
        </span>
      </div>
      <p className="mb-3 text-sm text-piedra">
        Las ventas ganadas siguen su entrega en{" "}
        <Link href="/pedidos" className="text-sky-700 underline">
          Pedidos
        </Link>
        .
      </p>

      <form method="get" className="mb-4">
        <select
          name="producto"
          defaultValue={producto ?? ""}
          className="rounded-2xl border border-borde bg-white shadow-sm px-3 py-2 text-sm"
        >
          <option value="">Todos los productos</option>
          {productos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
        <button className="ml-2 rounded-2xl border border-borde px-3 py-2 text-sm">
          Filtrar
        </button>
      </form>

      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex gap-3 pb-2" style={{ minWidth: "max-content" }}>
          {columnas.map((col) => {
            const items = oportunidades.filter((o) => o.etapa === col.value);
            return (
              <div key={col.value} className="w-60 shrink-0">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-piedra mb-2">
                  {col.label} ({items.length})
                </h2>
                <div className="space-y-2">
                  {items.map((o) => (
                    <Link
                      key={o.id}
                      href={`/oportunidades/${o.id}`}
                      className="block rounded-2xl border border-borde bg-white shadow-sm p-3"
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        <TempBadge temperatura={o.temperatura} />
                        <ProductoBadge nombre={o.producto?.nombre} />
                        {(o.productos_extra?.length ?? 0) > 0 && (
                          <span className="rounded-full border border-borde px-1.5 py-0.5 text-[11px] text-piedra">
                            +{o.productos_extra.length}
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-sm font-medium truncate">
                        {o.cliente?.nombre_comercial}
                      </p>
                      <p className="mt-0.5 text-xs text-piedra">
                        {o.monto_estimado
                          ? dinero(o.monto_estimado, o.moneda)
                          : "Sin cotizar"}
                        {" · "}hace {diasDesde(o.created_at)} días
                      </p>
                      {!proximaAccion.has(o.id) ? (
                        <p className="mt-1 rounded-md bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700">
                          Sin próxima acción
                        </p>
                      ) : (
                        proximaAccion.get(o.id)! < hoy && (
                          <p className="mt-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">
                            Seguimiento vencido
                          </p>
                        )
                      )}
                    </Link>
                  ))}
                  {items.length === 0 && (
                    <p className="rounded-2xl border border-dashed border-borde p-3 text-center text-xs text-piedra/50">
                      Vacío
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
