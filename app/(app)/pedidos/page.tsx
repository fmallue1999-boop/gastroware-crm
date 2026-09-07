import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { VENTA_PASOS } from "@/lib/constants";
import { dinero, fechaCorta, sumarDias, telefonoProlijo } from "@/lib/format";
import VentaPaso, { pasoDe } from "@/components/VentaPaso";
import type { Oportunidad, Producto } from "@/lib/types";

/** Tablero de ventas: Vendido → Preparar → Facturar → Entregado. */
export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string }>;
}) {
  const { ver } = await searchParams;
  const verTodas = ver === "todas";
  const supabase = await createClient();

  const [{ data }, { data: prods }] = await Promise.all([
    supabase
      .from("oportunidades")
      .select("*, cliente:clientes(*), producto:productos(*)")
      .eq("etapa", "ganada")
      .order("closed_at", { ascending: false })
      .limit(300),
    supabase.from("productos").select("id, nombre"),
  ]);
  let ventas = (data ?? []) as unknown as Oportunidad[];
  const productos = (prods ?? []) as Pick<Producto, "id" | "nombre">[];

  // Entregadas: solo las del último mes, salvo que se pida ver todas
  const hace30 = sumarDias(-30);
  if (!verTodas)
    ventas = ventas.filter(
      (o) => pasoDe(o.pedido_estado) < 3 || (o.entregado_at ?? o.closed_at ?? "") >= hace30
    );

  const ids = ventas.map((o) => o.id);
  const { data: equiposData } = ids.length
    ? await supabase
        .from("equipos")
        .select("oportunidad_id, numero_serie")
        .in("oportunidad_id", ids)
        .is("deleted_at", null)
    : { data: [] };
  const serieFaltante = new Set(
    ((equiposData ?? []) as { oportunidad_id: string; numero_serie: string | null }[])
      .filter((e) => !e.numero_serie)
      .map((e) => e.oportunidad_id)
  );

  const nombreProductos = (o: Oportunidad) => {
    const extra = (o.productos_extra ?? [])
      .map((pid) => productos.find((p) => p.id === pid)?.nombre)
      .filter(Boolean) as string[];
    return (
      [o.producto?.nombre, ...extra].filter(Boolean).join(", ") ||
      o.mensaje_inicial ||
      "Venta"
    );
  };

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Ventas</h1>
        <Link
          href="/pedidos/nuevo"
          className="inline-flex items-center gap-1.5 rounded-xl bg-tinta px-3.5 py-2 text-sm font-semibold text-white shadow-sm"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} /> Nueva venta
        </Link>
      </div>
      <p className="mb-4 text-sm text-piedra">
        Cada venta avanza con un botón: vendido, preparar, facturar, entregado.{" "}
        <Link href={verTodas ? "/pedidos" : "/pedidos?ver=todas"} className="underline">
          {verTodas ? "Ver solo el último mes" : "Ver todas las entregadas"}
        </Link>
      </p>

      {ventas.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-borde p-6 text-center text-sm text-piedra">
          No hay ventas en curso. Cargá una con “Nueva venta” o desde la ficha
          del contacto con “Le vendí”.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-4 lg:gap-3">
          {VENTA_PASOS.map((col, i) => {
            const items = ventas.filter((o) => pasoDe(o.pedido_estado) === i);
            return (
              <section key={col.key}>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-piedra">
                  {col.label} ({items.length})
                </h2>
                <div className="space-y-2">
                  {items.map((o) => (
                    <div
                      key={o.id}
                      className="rounded-2xl border border-borde bg-white p-3 shadow-sm"
                    >
                      <Link href={`/clientes/${o.cliente_id}`} className="block">
                        <p className="truncate text-sm font-semibold hover:underline">
                          {o.cliente?.nombre_comercial}
                        </p>
                        <p className="text-sm text-tinta/80">{nombreProductos(o)}</p>
                        <p className="mt-0.5 text-xs text-piedra">
                          {o.monto_estimado ? `${dinero(o.monto_estimado, o.moneda)} · ` : ""}
                          {fechaCorta(o.closed_at ?? o.created_at)}
                          {o.cliente?.telefono ? ` · ${telefonoProlijo(o.cliente.telefono)}` : ""}
                        </p>
                      </Link>
                      <div className="mt-2">
                        <VentaPaso
                          oportunidadId={o.id}
                          estado={o.pedido_estado}
                          nroFactura={o.nro_factura}
                          entregaEstimada={o.entrega_estimada}
                          pedirSerie={serieFaltante.has(o.id)}
                          compacto
                        />
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && (
                    <p className="rounded-2xl border border-dashed border-borde p-3 text-center text-xs text-piedra/60">
                      Nada acá
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
