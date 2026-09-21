import Link from "next/link";
import { ChevronDown, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PEDIDO_ESTADOS } from "@/lib/constants";
import { dinero, fechaCorta, telefonoProlijo } from "@/lib/format";
import { pasoDe } from "@/lib/ventas";
import { infoStockPorProducto, textoStock } from "@/lib/stock";
import ConPanel from "@/components/ficha/ConPanel";
import LinkContacto from "@/components/LinkContacto";
import VentaPaso from "@/components/VentaPaso";
import type { Oportunidad, Producto } from "@/lib/types";

const COLOR_PASO = ["bg-azul-soft text-azul", "bg-ambar-soft text-ambar", "bg-violeta-soft text-violeta", "bg-verde-soft text-verde"];

/** Ventas: una lista, un botón por venta (el paso que sigue). Las entregadas, plegadas. */
export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; interes?: string }>;
}) {
  const { c, interes } = await searchParams;
  const supabase = await createClient();
  const [{ data }, { data: prods }, stockInfo] = await Promise.all([
    supabase
      .from("oportunidades")
      .select("*, cliente:clientes(*), producto:productos(*)")
      .eq("etapa", "ganada")
      .order("closed_at", { ascending: false })
      .limit(300),
    supabase.from("productos").select("id, nombre"),
    infoStockPorProducto(supabase),
  ]);
  const ventas = (data ?? []) as unknown as Oportunidad[];
  const productos = (prods ?? []) as Pick<Producto, "id" | "nombre">[];
  const enCurso = ventas.filter((o) => pasoDe(o.pedido_estado) < 3);
  const entregadas = ventas.filter((o) => pasoDe(o.pedido_estado) >= 3).slice(0, 50);

  const ids = ventas.map((o) => o.id);
  const { data: equiposData } = ids.length
    ? await supabase.from("equipos").select("oportunidad_id, numero_serie").in("oportunidad_id", ids).is("deleted_at", null)
    : { data: [] };
  const serieFaltante = new Set(
    ((equiposData ?? []) as { oportunidad_id: string; numero_serie: string | null }[]).filter((e) => !e.numero_serie).map((e) => e.oportunidad_id)
  );

  const nombreProductos = (o: Oportunidad) => {
    const extra = (o.productos_extra ?? []).map((pid) => productos.find((p) => p.id === pid)?.nombre).filter(Boolean) as string[];
    return [o.producto?.nombre, ...extra].filter(Boolean).join(", ") || o.mensaje_inicial || "Venta";
  };

  const Tarjeta = ({ o }: { o: Oportunidad }) => {
    const paso = pasoDe(o.pedido_estado);
    const label = PEDIDO_ESTADOS.find((p) => p.value === (o.pedido_estado ?? "comprometido"))?.label ?? "Vendido";
    const sinStock = o.producto_id && stockInfo[o.producto_id] && stockInfo[o.producto_id].stock <= 0 && paso < 3;
    return (
      <div className="rounded-2xl bg-white p-3.5 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <LinkContacto id={o.cliente_id} className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-extrabold hover:underline">{o.cliente?.nombre_comercial}</p>
            <p className="text-[15px] text-tinta/80">
              {nombreProductos(o)}
              {o.monto_estimado ? ` · ${dinero(o.monto_estimado, o.moneda)}` : ""}
            </p>
            <p className="text-xs text-piedra">
              vendido {fechaCorta(o.closed_at ?? o.created_at)}
              {o.cliente?.telefono ? ` · ${telefonoProlijo(o.cliente.telefono)}` : ""}
              {o.nro_factura ? ` · factura ${o.nro_factura}` : ""}
            </p>
            {sinStock && <p className="text-xs font-bold text-ambar">{textoStock(stockInfo[o.producto_id!], fechaCorta)}</p>}
          </LinkContacto>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-extrabold ${COLOR_PASO[paso] ?? COLOR_PASO[0]}`}>{label}</span>
        </div>
        {paso < 3 && (
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
        )}
      </div>
    );
  };

  return (
    <ConPanel c={c} interes={interes} cerrarHref="/pedidos">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Ventas</h1>
            <p className="text-[15px] text-piedra">En curso · {enCurso.length}</p>
          </div>
          <Link href="/pedidos/nuevo" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-marino px-4 text-[15px] font-extrabold text-white shadow-sm">
            <Plus className="h-4 w-4" strokeWidth={2.6} /> Nueva venta
          </Link>
        </div>

        {enCurso.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-borde p-6 text-center text-[15px] text-piedra">
            No hay ventas en curso. Se cargan con “Me compró” desde el embudo o la ficha, o con Nueva venta.
          </p>
        ) : (
          <div className="grid gap-2 lg:grid-cols-2">
            {enCurso.map((o) => (
              <Tarjeta key={o.id} o={o} />
            ))}
          </div>
        )}

        {entregadas.length > 0 && (
          <details className="group">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-[15px] font-bold text-piedra [&::-webkit-details-marker]:hidden">
              Ver entregadas ({entregadas.length})
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-2 grid gap-2 lg:grid-cols-2">
              {entregadas.map((o) => (
                <Tarjeta key={o.id} o={o} />
              ))}
            </div>
          </details>
        )}
      </div>
    </ConPanel>
  );
}
