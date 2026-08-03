import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fechaCorta, dinero } from "@/lib/format";
import { TIPOS_OT } from "@/lib/constants";
import BotonImprimir from "@/components/BotonImprimir";
import type { OrdenTrabajo, OTItem } from "@/lib/types";

export default async function ComprobantePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data }, { data: items }, { data: cfg }] = await Promise.all([
    supabase
      .from("ordenes_trabajo")
      .select(
        "*, cliente:clientes(*), equipo:equipos_instalados(*, producto:productos(*)), tecnico:usuarios!ordenes_trabajo_tecnico_id_fkey(id, nombre)"
      )
      .eq("id", id)
      .single(),
    supabase.from("ot_items").select("*").eq("ot_id", id).order("created_at"),
    supabase.from("config").select("valor").eq("clave", "tarifa_hora").single(),
  ]);
  if (!data) notFound();
  const ot = data as unknown as OrdenTrabajo;
  const listaItems = (items ?? []) as OTItem[];
  const tarifa = Number(cfg?.valor) || 0;
  const manoObra = ot.es_garantia ? 0 : (Number(ot.horas) || 0) * tarifa;

  return (
    <div className="mx-auto max-w-xl bg-white p-8 text-tinta print:p-0">
      <div className="mb-4 flex items-start justify-between border-b-2 border-tinta pb-4">
        <div>
          <h1 className="text-xl font-bold">GastroWare</h1>
          <p className="text-sm text-piedra">Comprobante de servicio técnico</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold">OT-{ot.numero}</p>
          <p className="text-sm text-piedra">
            {fechaCorta(ot.cerrada_at ?? ot.created_at)}
          </p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="font-semibold">Cliente</p>
          <p>{ot.cliente?.nombre_comercial}</p>
          {ot.cliente?.telefono && <p className="text-piedra">{ot.cliente.telefono}</p>}
        </div>
        <div>
          <p className="font-semibold">Equipo</p>
          <p>
            {ot.equipo
              ? (ot.equipo.producto?.nombre ?? ot.equipo.marca_modelo)
              : "—"}
          </p>
          {ot.equipo?.numero_serie && (
            <p className="text-piedra">Serie {ot.equipo.numero_serie}</p>
          )}
        </div>
        <div>
          <p className="font-semibold">Tipo de servicio</p>
          <p>
            {TIPOS_OT.find((t) => t.value === ot.tipo)?.label}
            {ot.es_garantia ? " (en garantía)" : ""}
          </p>
        </div>
        <div>
          <p className="font-semibold">Técnico</p>
          <p>{ot.tecnico?.nombre ?? "—"}</p>
        </div>
      </div>

      {ot.problema && (
        <div className="mb-3 text-sm">
          <p className="font-semibold">Problema reportado</p>
          <p>{ot.problema}</p>
        </div>
      )}

      <div className="mb-4 text-sm">
        <p className="font-semibold">Trabajo realizado</p>
        <p className="whitespace-pre-wrap">{ot.trabajo_realizado ?? "—"}</p>
      </div>

      <table className="mb-4 w-full text-sm">
        <thead>
          <tr className="border-b border-tinta text-left">
            <th className="py-1">Detalle</th>
            <th className="py-1 text-right">Cant.</th>
            <th className="py-1 text-right">Importe</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-borde">
            <td className="py-1.5">
              Mano de obra ({ot.horas ?? 0} h)
              {ot.es_garantia ? " — sin cargo por garantía" : ""}
            </td>
            <td className="py-1.5 text-right">{ot.horas ?? 0}</td>
            <td className="py-1.5 text-right">{dinero(manoObra)}</td>
          </tr>
          {listaItems.map((i) => (
            <tr key={i.id} className="border-b border-borde">
              <td className="py-1.5">
                {i.descripcion}
                {!i.refacturable ? " — sin cargo" : ""}
              </td>
              <td className="py-1.5 text-right">{i.cantidad}</td>
              <td className="py-1.5 text-right">
                {i.refacturable
                  ? dinero(Number(i.cantidad) * Number(i.precio_unit))
                  : dinero(0)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-bold">
            <td className="py-2" colSpan={2}>
              Total
            </td>
            <td className="py-2 text-right">
              {dinero(
                ot.total ??
                  manoObra +
                    listaItems
                      .filter((i) => i.refacturable)
                      .reduce(
                        (s, i) => s + Number(i.cantidad) * Number(i.precio_unit),
                        0
                      )
              )}
            </td>
          </tr>
        </tfoot>
      </table>

      {ot.firma_url && (
        <div className="mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ot.firma_url} alt="Firma del cliente" className="h-20" />
          <p className="border-t border-tinta pt-1 text-sm">
            Firma: {ot.firmante ?? "Cliente"}
          </p>
        </div>
      )}

      <p className="text-xs text-piedra">
        GastroWare · Servicio técnico oficial · Este comprobante no es una
        factura.
        {ot.nro_factura ? ` Facturado: ${ot.nro_factura}.` : ""}
      </p>

      <BotonImprimir />
    </div>
  );
}
