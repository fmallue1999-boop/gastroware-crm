import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { productosDeLinea } from "@/lib/precios";
import { cuitProlijo, datosFiscalesDe } from "@/lib/datos-cotizar";
import { nombreLinea } from "@/lib/actividad";
import CotizacionForm, { type CotizacionPrevia } from "@/components/CotizacionForm";
import type { CotizacionItem, CotizacionVersion, Producto, Sucursal } from "@/lib/types";

/**
 * Cotizar un interés (v1.9), en pantalla propia: los datos del cliente
 * (obligatorios), los productos y las condiciones. Si ya hay una cotización,
 * la nueva versión arranca desde la anterior; si no, con los productos del
 * interés a precio de lista.
 */
export default async function CotizarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();

  const [{ data: opp }, { data: productosData }, { data: cot }] = await Promise.all([
    supabase
      .from("oportunidades")
      .select(
        "id, cliente_id, linea, etapa, moneda, producto_id, productos_extra, mensaje_inicial, producto:productos(nombre, moneda), cliente:clientes(id, nombre_comercial, razon_social, cuit, email, condicion_fiscal, sucursales(*))"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("productos").select("*").eq("activo", true).order("nombre"),
    supabase
      .from("cotizaciones")
      .select("id, numero, versiones:cotizacion_versiones(*)")
      .eq("oportunidad_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!opp) notFound();

  const cliente = opp.cliente as unknown as {
    id: string;
    nombre_comercial: string;
    razon_social: string | null;
    cuit: string | null;
    email: string | null;
    condicion_fiscal: string | null;
    sucursales: Sucursal[] | null;
  } | null;
  if (!cliente) notFound();
  const producto = opp.producto as unknown as { nombre: string; moneda: string } | null;
  const productos = productosDeLinea((productosData ?? []) as Producto[], opp.linea as string | null);

  // La última versión (si hay) para arrancar la nueva desde ahí
  const versiones = ((cot?.versiones ?? []) as CotizacionVersion[]).sort((a, b) => b.version - a.version);
  const ultima = versiones[0] ?? null;
  let previa: CotizacionPrevia | null = null;
  if (ultima) {
    const { data: items } = await supabase.from("cotizacion_items").select("*").eq("version_id", ultima.id).order("id");
    previa = {
      moneda: ultima.moneda === "USD" ? "USD" : "ARS",
      items: ((items ?? []) as CotizacionItem[]).map((i) => ({
        productoId: i.producto_id,
        descripcion: i.descripcion,
        cantidad: Number(i.cantidad),
        precioUnit: Number(i.precio_unit),
      })),
      formaPago: ultima.forma_pago,
      ivaPct: ultima.iva_pct ?? null,
      plazoEntrega: ultima.plazo_entrega ?? null,
      condicionEntrega: ultima.condicion_entrega ?? null,
      vigenciaDias: ultima.vigencia_dias,
      condiciones: ultima.condiciones,
      tipoCambio: ultima.tipo_cambio != null ? Number(ultima.tipo_cambio) : null,
      descuentoPct: ultima.descuento_pct != null ? Number(ultima.descuento_pct) : null,
      descuentoMotivo: ultima.descuento_motivo ?? null,
    };
  }

  const fiscal = datosFiscalesDe(cliente);
  const principal = (cliente.sucursales ?? []).find((s) => s.es_principal) ?? (cliente.sucursales ?? [])[0];
  const volverHref = `/clientes/${cliente.id}?interes=${opp.id}`;
  const queCotiza =
    [producto?.nombre, (opp.productos_extra as string[] | null)?.length ? `y ${(opp.productos_extra as string[]).length} más` : null].filter(Boolean).join(" ") ||
    (opp.mensaje_inicial as string | null) ||
    "Interés";

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header className="flex items-start gap-2">
        <Link href={volverHref} aria-label="Volver a la ficha" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-borde bg-white">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-piedra">
            {ultima ? `Nueva versión de la cotización N° ${cot?.numero}` : "Nueva cotización"}
            {opp.linea && opp.linea !== "equipos" ? ` · ${nombreLinea(opp.linea as string)}` : ""}
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight">Cotizar a {cliente.nombre_comercial}</h1>
          <p className="text-[15px] text-piedra">{queCotiza}</p>
        </div>
      </header>

      <CotizacionForm
        oportunidadId={opp.id as string}
        clienteId={cliente.id}
        cliente={{
          razonSocial: fiscal.razon_social ?? "",
          cuit: cuitProlijo(fiscal.cuit),
          condicionFiscal: cliente.condicion_fiscal ?? "",
          email: fiscal.email ?? "",
          direccion: fiscal.direccion ?? "",
          ciudad: fiscal.ciudad ?? "",
          provincia: principal?.provincia ?? "",
        }}
        monedaDefault={(opp.moneda as string | null) ?? producto?.moneda ?? "ARS"}
        productos={productos}
        productosIniciales={[opp.producto_id as string | null, ...((opp.productos_extra as string[] | null) ?? [])].filter((x): x is string => Boolean(x))}
        previa={previa}
        volverHref={volverHref}
      />
    </div>
  );
}
