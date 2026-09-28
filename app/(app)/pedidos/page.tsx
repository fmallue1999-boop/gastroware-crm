import Link from "next/link";
import { ChevronDown, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { VENTA_PASOS } from "@/lib/constants";
import { dinero, fechaCorta, hoyISO, telefonoProlijo } from "@/lib/format";
import { pasoDe, proximoPasoVenta } from "@/lib/ventas";
import { infoStockPorProducto, textoStock } from "@/lib/stock";
import ConPanel from "@/components/ficha/ConPanel";
import LinkContacto from "@/components/LinkContacto";
import VentaPaso, { type FacturaDatos } from "@/components/VentaPaso";
import type { Oportunidad, Producto } from "@/lib/types";
import AyudaLink from "@/components/guia/AyudaLink";

const COLOR_PASO = [
  "bg-ambar-soft text-ambar",
  "bg-violeta-soft text-violeta",
  "bg-azul-soft text-azul",
  "bg-celeste-soft text-marino",
  "bg-verde-soft text-verde",
];

/**
 * Ventas: el circuito después de vender, en columnas (manual 1.1): para
 * facturar, esperando cobro, a preparar, despachadas. Las entregadas,
 * plegadas. Cada tarjeta muestra el botón del paso que le toca a quien mira.
 */
export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; interes?: string }>;
}) {
  const { c, interes } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const hoy = hoyISO();
  const [{ data }, { data: prods }, stockInfo, { data: yo }] = await Promise.all([
    supabase
      .from("oportunidades")
      .select("*, cliente:clientes(*), producto:productos(*)")
      .eq("etapa", "ganada")
      .is("deleted_at", null)
      .order("closed_at", { ascending: false })
      .limit(400),
    supabase.from("productos").select("id, nombre"),
    infoStockPorProducto(supabase),
    supabase.from("usuarios").select("rol").eq("id", user?.id ?? "").maybeSingle(),
  ]);
  const rol = (yo?.rol as string | undefined) ?? "comercial";
  const ventas = (data ?? []) as unknown as Oportunidad[];
  const productos = (prods ?? []) as Pick<Producto, "id" | "nombre">[];
  const ids = ventas.map((o) => o.id);
  const [{ data: equiposData }, { data: facturasData }] = ids.length
    ? await Promise.all([
        supabase.from("equipos").select("oportunidad_id, numero_serie").in("oportunidad_id", ids).is("deleted_at", null),
        supabase
          .from("facturas")
          .select("id, oportunidad_id, numero, vencimiento, monto, moneda, cobro_estado, promesa_fecha, condicion_aprobada_at")
          .in("oportunidad_id", ids)
          .order("created_at", { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }];
  const serieFaltante = new Set(
    ((equiposData ?? []) as { oportunidad_id: string; numero_serie: string | null }[])
      .filter((e) => !e.numero_serie)
      .map((e) => e.oportunidad_id)
  );
  const facturaDe = new Map<string, FacturaDatos>();
  for (const f of (facturasData ?? []) as (FacturaDatos & { oportunidad_id: string })[])
    if (!facturaDe.has(f.oportunidad_id)) facturaDe.set(f.oportunidad_id, f);

  const nombreProductos = (o: Oportunidad) => {
    const extra = (o.productos_extra ?? []).map((pid) => productos.find((p) => p.id === pid)?.nombre).filter(Boolean) as string[];
    return [o.producto?.nombre, ...extra].filter(Boolean).join(", ") || o.mensaje_inicial || "Venta";
  };

  const porPaso = VENTA_PASOS.map((_, i) =>
    ventas
      .filter((o) => pasoDe(o.pedido_estado) === i)
      .sort((a, b) => (a.prioridad_despacho ?? 9) - (b.prioridad_despacho ?? 9))
  );
  const entregadas = porPaso[4].slice(0, 60);
  const enCurso = porPaso.slice(0, 4).reduce((s, l) => s + l.length, 0);

  const Tarjeta = ({ o }: { o: Oportunidad }) => {
    const paso = pasoDe(o.pedido_estado);
    const factura = facturaDe.get(o.id) ?? null;
    const sigue = proximoPasoVenta(o, factura);
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
              vendido {fechaCorta(o.vendido_at ?? o.closed_at ?? o.created_at)}
              {o.cliente?.telefono ? ` · ${telefonoProlijo(o.cliente.telefono)}` : ""}
            </p>
            {sinStock && <p className="text-xs font-bold text-ambar">{textoStock(stockInfo[o.producto_id!], fechaCorta)}</p>}
          </LinkContacto>
          {paso < 4 && (
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-extrabold ${COLOR_PASO[paso]}`}>{sigue.texto}</span>
          )}
        </div>
        <div className="mt-2">
          <VentaPaso
            venta={o}
            rol={rol}
            hoy={hoy}
            factura={factura}
            pedirSerie={serieFaltante.has(o.id)}
            videoUrl={o.producto?.video_url ?? null}
            compacto
          />
        </div>
      </div>
    );
  };

  return (
    <ConPanel c={c} interes={interes} cerrarHref="/pedidos">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="flex flex-wrap items-center gap-x-2 text-2xl font-extrabold tracking-tight">
          Ventas <AyudaLink tarea="datos-venta" />
        </h1>
            <p className="text-[15px] text-piedra">En curso · {enCurso}. Nada se prepara sin factura y cobro.</p>
          </div>
          <Link href="/pedidos/nuevo" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-marino px-4 text-[15px] font-extrabold text-white shadow-sm">
            <Plus className="h-4 w-4" strokeWidth={2.6} /> Nueva venta
          </Link>
        </div>

        {enCurso === 0 && (
          <p className="rounded-2xl border border-dashed border-borde p-6 text-center text-[15px] text-piedra">
            No hay ventas en curso. Se cargan con “Me compró” desde el embudo o la ficha, o con Nueva venta.
          </p>
        )}

        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-4">
          {VENTA_PASOS.slice(0, 4).map((p, i) =>
            porPaso[i].length ? (
              <section key={p.key} className="min-w-0">
                <h2 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-piedra">
                  <span className={`rounded-full px-2 py-0.5 ${COLOR_PASO[i]}`}>{porPaso[i].length}</span>
                  {i === 0 ? "Vendido · para facturar" : i === 1 ? "Facturado · esperando cobro" : i === 2 ? "A preparar y despachar" : "Despachado · por entregar"}
                </h2>
                <div className="space-y-2">
                  {porPaso[i].map((o) => (
                    <Tarjeta key={o.id} o={o} />
                  ))}
                </div>
              </section>
            ) : null
          )}
        </div>

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
