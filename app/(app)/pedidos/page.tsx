import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PEDIDO_ESTADOS } from "@/lib/constants";
import { dinero, fechaCorta, telefonoProlijo } from "@/lib/format";
import { ProductoBadge } from "@/components/Badges";
import AvanzarPedidoBoton from "@/components/AvanzarPedidoBoton";
import type { Oportunidad } from "@/lib/types";

/** Seguimiento de todos los pedidos: de la venta ganada a la entrega. */
export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string }>;
}) {
  const { ver } = await searchParams;
  const verTodos = ver === "todos";
  const supabase = await createClient();

  let query = supabase
    .from("oportunidades")
    .select("*, cliente:clientes(*), producto:productos(*)")
    .eq("etapa", "ganada")
    .order("closed_at", { ascending: false })
    .limit(300);
  if (!verTodos) query = query.neq("pedido_estado", "finalizado");

  const { data } = await query;
  const pedidos = (data ?? []) as unknown as Oportunidad[];

  const columnas = verTodos
    ? PEDIDO_ESTADOS
    : PEDIDO_ESTADOS.filter((p) => p.value !== "finalizado");

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Pedidos</h1>
        <Link
          href={verTodos ? "/pedidos" : "/pedidos?ver=todos"}
          className="text-sm text-sky-700 underline"
        >
          {verTodos ? "Ver solo en curso" : "Ver también finalizados"}
        </Link>
      </div>
      <p className="mb-4 text-sm text-piedra">
        Toda venta ganada aparece acá hasta que se entrega y se cierra.
      </p>

      {pedidos.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-borde p-6 text-center text-sm text-piedra">
          No hay pedidos en curso. Cuando marques una venta como ganada, entra
          sola a este tablero.
        </p>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4">
          <div className="flex gap-3 pb-2" style={{ minWidth: "max-content" }}>
            {columnas.map((col) => {
              const items = pedidos.filter(
                (o) => (o.pedido_estado ?? "facturar") === col.value
              );
              return (
                <div key={col.value} className="w-64 shrink-0">
                  <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-piedra">
                    {col.label} ({items.length})
                  </h2>
                  <div className="space-y-2">
                    {items.map((o) => (
                      <div
                        key={o.id}
                        className="rounded-2xl border border-borde bg-white p-3 shadow-sm"
                      >
                        <Link
                          href={`/oportunidades/${o.id}`}
                          className="block"
                        >
                          <p className="truncate text-sm font-medium hover:underline">
                            {o.cliente?.nombre_comercial}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <ProductoBadge nombre={o.producto?.nombre} />
                          </div>
                          <p className="mt-1 text-xs text-piedra">
                            {o.monto_estimado
                              ? dinero(o.monto_estimado, o.moneda)
                              : "Sin monto"}
                            {" · ganada "}
                            {fechaCorta(o.closed_at ?? o.created_at)}
                            {o.entregado_at
                              ? ` · entregado ${fechaCorta(o.entregado_at)}`
                              : ""}
                          </p>
                          {o.cliente?.telefono && (
                            <p className="text-xs text-piedra">
                              {telefonoProlijo(o.cliente.telefono)}
                            </p>
                          )}
                        </Link>
                        <AvanzarPedidoBoton
                          oportunidadId={o.id}
                          estado={o.pedido_estado}
                        />
                      </div>
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
      )}
    </div>
  );
}
