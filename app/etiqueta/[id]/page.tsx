import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import BotonImprimir from "@/components/BotonImprimir";
import type { Equipo } from "@/lib/types";

export default async function EtiquetaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("equipos")
    .select(
      "*, cliente:clientes(nombre_comercial), producto:productos(nombre), modelo:modelos(marca, nombre)"
    )
    .eq("id", id)
    .single();
  if (!data) notFound();
  const e = data as unknown as Equipo;

  const nombre =
    e.producto?.nombre ??
    (e.modelo ? `${e.modelo.marca} ${e.modelo.nombre}` : null) ??
    e.marca_modelo_libre ??
    "Equipo";

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://gastroware-crm.vercel.app";
  const urlQR = e.numero_serie
    ? `${base}/e/${encodeURIComponent(e.numero_serie)}`
    : `${base}/equipos/${e.id}`;
  const qrDataUrl = await QRCode.toDataURL(urlQR, { margin: 1, width: 400 });

  return (
    <div className="mx-auto max-w-xs bg-white p-6 text-center text-tinta print:p-2">
      <div className="rounded-2xl border-2 border-tinta p-5 print:rounded-lg">
        <p className="text-lg font-bold tracking-tight">GastroWare</p>
        <p className="text-xs text-piedra">Servicio técnico oficial</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrDataUrl} alt="QR del equipo" className="mx-auto my-3 h-44 w-44" />
        <p className="text-sm font-semibold">{nombre}</p>
        {e.numero_serie && (
          <p className="text-sm">Serie {e.numero_serie}</p>
        )}
        {e.cliente && (
          <p className="mt-1 text-xs text-piedra">{e.cliente.nombre_comercial}</p>
        )}
      </div>
      <BotonImprimir />
    </div>
  );
}
