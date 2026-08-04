import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fechaCorta, dinero, sumarDias, telefonoProlijo } from "@/lib/format";
import BotonImprimir from "@/components/BotonImprimir";
import type { Cliente, CotizacionItem, CotizacionVersion } from "@/lib/types";

export default async function CotizacionPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const { id } = await params;
  const { v } = await searchParams;
  const supabase = await createClient();

  const { data: cot } = await supabase
    .from("cotizaciones")
    .select(
      "id, numero, created_at, oportunidad:oportunidades(id, cliente:clientes(*), comercial:usuarios!oportunidades_comercial_id_fkey(nombre))"
    )
    .eq("id", id)
    .single();
  if (!cot) notFound();

  let queryVer = supabase
    .from("cotizacion_versiones")
    .select("*")
    .eq("cotizacion_id", id)
    .order("version", { ascending: false })
    .limit(1);
  if (v) queryVer = supabase
    .from("cotizacion_versiones")
    .select("*")
    .eq("cotizacion_id", id)
    .eq("version", Number(v))
    .limit(1);

  const { data: versiones } = await queryVer;
  const version = (versiones?.[0] ?? null) as CotizacionVersion | null;
  if (!version) notFound();

  const { data: itemsData } = await supabase
    .from("cotizacion_items")
    .select("*")
    .eq("version_id", version.id)
    .order("descripcion");
  const items = (itemsData ?? []) as CotizacionItem[];

  const opp = cot.oportunidad as unknown as {
    cliente: Cliente | null;
    comercial: { nombre: string } | null;
  } | null;
  const cliente = opp?.cliente ?? null;

  const fechaEmision = version.created_at;
  const validaHasta = version.vigencia_dias
    ? sumarDias(version.vigencia_dias, fechaEmision.slice(0, 10))
    : null;

  return (
    <div className="mx-auto max-w-xl bg-white p-8 text-tinta print:p-0">
      <div className="mb-4 flex items-start justify-between border-b-2 border-tinta pb-4">
        <div>
          <h1 className="text-xl font-bold">GastroWare</h1>
          <p className="text-sm text-piedra">Equipamiento gastronómico</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold">
            COT-{cot.numero}
            {version.version > 1 ? ` · v${version.version}` : ""}
          </p>
          <p className="text-sm text-piedra">{fechaCorta(fechaEmision)}</p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="font-semibold">Cliente</p>
          <p>{cliente?.razon_social ?? cliente?.nombre_comercial ?? "—"}</p>
          {cliente?.cuit && <p className="text-piedra">CUIT {cliente.cuit}</p>}
          {cliente?.telefono && (
            <p className="text-piedra">{telefonoProlijo(cliente.telefono)}</p>
          )}
        </div>
        <div className="text-right">
          <p className="font-semibold">Atendido por</p>
          <p>{opp?.comercial?.nombre ?? "Equipo comercial"}</p>
          <p className="text-piedra">info@gastroware.com.ar</p>
        </div>
      </div>

      {items.length > 0 ? (
        <table className="mb-4 w-full text-sm">
          <thead>
            <tr className="border-b border-tinta text-left">
              <th className="py-1">Detalle</th>
              <th className="py-1 text-right">Cant.</th>
              <th className="py-1 text-right">Precio unit.</th>
              <th className="py-1 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-b border-borde">
                <td className="py-1.5">{i.descripcion}</td>
                <td className="py-1.5 text-right">{i.cantidad}</td>
                <td className="py-1.5 text-right">
                  {dinero(Number(i.precio_unit), version.moneda)}
                </td>
                <td className="py-1.5 text-right">
                  {dinero(
                    Number(i.cantidad) * Number(i.precio_unit),
                    version.moneda
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-bold">
              <td className="py-2" colSpan={3}>
                Total
              </td>
              <td className="py-2 text-right">
                {dinero(Number(version.total ?? 0), version.moneda)}
              </td>
            </tr>
          </tfoot>
        </table>
      ) : (
        <p className="mb-4 text-sm">
          <span className="font-semibold">Total cotizado:</span>{" "}
          {dinero(Number(version.total ?? 0), version.moneda)}
        </p>
      )}

      <div className="mb-4 space-y-1 text-sm">
        {version.forma_pago && (
          <p>
            <span className="font-semibold">Forma de pago:</span>{" "}
            {version.forma_pago}
          </p>
        )}
        {validaHasta && (
          <p>
            <span className="font-semibold">Válida hasta:</span>{" "}
            {fechaCorta(validaHasta)} ({version.vigencia_dias} días)
          </p>
        )}
        {version.condiciones && (
          <p className="whitespace-pre-wrap">
            <span className="font-semibold">Condiciones:</span>{" "}
            {version.condiciones}
          </p>
        )}
      </div>

      <p className="text-xs text-piedra">
        GastroWare · Precios sujetos a cambio pasada la vigencia · Este
        documento no es una factura.
      </p>

      <BotonImprimir />
    </div>
  );
}
