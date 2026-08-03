import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { firmarUrl } from "@/lib/core/storage";
import { fechaCorta, dinero } from "@/lib/format";
import { TIPOS_OT, ESTADOS_ITEM_OT } from "@/lib/constants";
import BotonImprimir from "@/components/BotonImprimir";
import type { OrdenTrabajo, OTItem, OTTiempo } from "@/lib/types";

export default async function ComprobantePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data }, { data: items }, { data: tiempos }, { data: cfg }] =
    await Promise.all([
      supabase
        .from("ordenes_trabajo")
        .select(
          "*, cliente:clientes(*), equipo:equipos(*, producto:productos(*)), tecnico:usuarios!ordenes_trabajo_tecnico_id_fkey(id, nombre)"
        )
        .eq("id", id)
        .single(),
      supabase.from("ot_items").select("*").eq("ot_id", id).order("created_at"),
      supabase.from("ot_tiempos").select("*").eq("ot_id", id),
      supabase.from("config").select("valor").eq("clave", "tarifa_hora").single(),
    ]);
  if (!data) notFound();
  const ot = data as unknown as OrdenTrabajo;
  const listaItems = (items ?? []) as OTItem[];
  const listaTiempos = (tiempos ?? []) as OTTiempo[];
  const tarifa = Number(cfg?.valor) || 0;

  const minutos = listaTiempos.reduce((s, t) => s + (t.minutos ?? 0), 0);
  const horas = minutos / 60;
  const esGarantia = ot.cobertura === "garantia";
  const manoObra = esGarantia ? 0 : horas * tarifa;
  const totalItems = listaItems
    .filter((i) => i.estado === "facturable" && i.aprobado_admin)
    .reduce((s, i) => s + Number(i.cantidad) * Number(i.precio_unit), 0);

  const firmaUrl = await firmarUrl("servicio", ot.firma_path);

  return (
    <div className="mx-auto max-w-xl bg-white p-8 text-tinta print:p-0">
      <div className="mb-4 flex items-start justify-between border-b-2 border-tinta pb-4">
        <div>
          <h1 className="text-xl font-bold">GastroWare</h1>
          <p className="text-sm text-piedra">Informe de servicio técnico</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold">OT-{ot.numero}</p>
          <p className="text-sm text-piedra">
            {fechaCorta(ot.cerrada_tecnico_at ?? ot.created_at)}
          </p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="font-semibold">Cliente</p>
          <p>{ot.cliente?.razon_social ?? ot.cliente?.nombre_comercial}</p>
          {ot.cliente?.cuit && <p className="text-piedra">CUIT {ot.cliente.cuit}</p>}
          {ot.cliente?.telefono && <p className="text-piedra">{ot.cliente.telefono}</p>}
        </div>
        <div>
          <p className="font-semibold">Equipo</p>
          <p>
            {ot.equipo
              ? (ot.equipo.producto?.nombre ?? ot.equipo.marca_modelo_libre)
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
            {esGarantia ? " (en garantía)" : ""}
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

      {ot.diagnostico && (
        <div className="mb-3 text-sm">
          <p className="font-semibold">Diagnóstico</p>
          <p className="whitespace-pre-wrap">{ot.diagnostico}</p>
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
              Mano de obra ({horas.toFixed(1)} h)
              {esGarantia ? " — sin cargo por garantía" : ""}
            </td>
            <td className="py-1.5 text-right">{horas.toFixed(1)}</td>
            <td className="py-1.5 text-right">{dinero(manoObra)}</td>
          </tr>
          {listaItems.map((i) => {
            const cobra = i.estado === "facturable" && i.aprobado_admin;
            const etiqueta = ESTADOS_ITEM_OT.find((x) => x.value === i.estado)?.label;
            return (
              <tr key={i.id} className="border-b border-borde">
                <td className="py-1.5">
                  {i.descripcion}
                  {!cobra ? ` — ${etiqueta?.toLowerCase() ?? "sin cargo"}` : ""}
                </td>
                <td className="py-1.5 text-right">{i.cantidad}</td>
                <td className="py-1.5 text-right">
                  {cobra
                    ? dinero(Number(i.cantidad) * Number(i.precio_unit))
                    : dinero(0)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="font-bold">
            <td className="py-2" colSpan={2}>
              Total
            </td>
            <td className="py-2 text-right">
              {dinero(ot.total ?? manoObra + totalItems)}
            </td>
          </tr>
        </tfoot>
      </table>

      {firmaUrl && (
        <div className="mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={firmaUrl} alt="Firma del cliente" className="h-20" />
          <p className="border-t border-tinta pt-1 text-sm">
            Firma y conformidad: {ot.firmante ?? "Cliente"}
          </p>
        </div>
      )}

      <p className="text-xs text-piedra">
        GastroWare · Servicio técnico oficial · Este informe no es una factura.
        {ot.nro_factura ? ` Facturado: ${ot.nro_factura}.` : ""}
      </p>

      <BotonImprimir />
    </div>
  );
}
