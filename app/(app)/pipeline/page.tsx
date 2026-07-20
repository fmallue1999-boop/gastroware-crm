import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ETAPAS, ETAPAS_ABIERTAS } from "@/lib/constants";
import { dinero, diasDesde } from "@/lib/format";
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
  const columnas = ETAPAS.filter((e) =>
    (ETAPAS_ABIERTAS as readonly string[]).includes(e.value)
  );

  const totalPipeline = oportunidades.reduce(
    (sum, o) => sum + (o.moneda === "ARS" ? o.monto_estimado ?? 0 : 0),
    0
  );

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1">
        <h1 className="text-xl font-semibold">Pipeline</h1>
        <span className="text-sm text-piedra">
          {oportunidades.length} abiertas · {dinero(totalPipeline)}
        </span>
      </div>

      <form method="get" className="mb-4">
        <select
          name="producto"
          defaultValue={producto ?? ""}
          className="rounded-xl border border-borde bg-white px-3 py-2 text-sm"
        >
          <option value="">Todos los productos</option>
          {productos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
        <button className="ml-2 rounded-xl border border-borde px-3 py-2 text-sm">
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
                      className="block rounded-xl border border-borde bg-white p-3"
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        <TempBadge temperatura={o.temperatura} />
                        <ProductoBadge nombre={o.producto?.nombre} />
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
                    </Link>
                  ))}
                  {items.length === 0 && (
                    <p className="rounded-xl border border-dashed border-borde p-3 text-center text-xs text-piedra/50">
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
