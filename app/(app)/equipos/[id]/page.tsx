import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { Printer, Wrench } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { firmarUrls } from "@/lib/core/storage";
import { fechaCorta, hoyISO } from "@/lib/format";
import { ESTADOS_OT } from "@/lib/constants";
import EquipoEditForm from "@/components/EquipoEditForm";
import FotosEquipo from "@/components/FotosEquipo";
import DocumentosEntidad from "@/components/DocumentosEntidad";
import type { Equipo, EquipoFoto, Sucursal } from "@/lib/types";

export default async function EquipoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const hoy = hoyISO();
  const supabase = await createClient();

  const { data } = await supabase
    .from("equipos")
    .select(
      "*, cliente:clientes(id, nombre_comercial, telefono), producto:productos(nombre), modelo:modelos(marca, nombre, categoria), sucursal:sucursales(id, nombre, ciudad)"
    )
    .eq("id", id)
    .single();
  if (!data) notFound();
  const e = data as unknown as Equipo;

  const [fotosRes, docsRes, otsRes, sucursalesRes] = await Promise.all([
    supabase
      .from("equipo_fotos")
      .select("*")
      .eq("equipo_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("documentos")
      .select("*")
      .eq("entidad", "equipo")
      .eq("entidad_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("ordenes_trabajo")
      .select("id, numero, estado, tipo, problema, fecha_programada, created_at")
      .eq("equipo_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("sucursales")
      .select("*")
      .eq("cliente_id", e.cliente_id)
      .is("deleted_at", null),
  ]);

  const fotosRaw = (fotosRes.data ?? []) as EquipoFoto[];
  const urlsFotos = await firmarUrls(
    "servicio",
    fotosRaw.map((f) => f.path)
  );
  const fotos = fotosRaw.map((f, i) => ({ id: f.id, url: urlsFotos[i] }));

  const docsRaw = (docsRes.data ?? []) as {
    id: string;
    tipo: string;
    nombre: string;
    path: string;
    created_at: string;
  }[];
  const urlsDocs = await firmarUrls(
    "documentos",
    docsRaw.map((d) => d.path)
  );
  const documentos = docsRaw.map((d, i) => ({
    id: d.id,
    tipo: d.tipo,
    nombre: d.nombre,
    created_at: d.created_at,
    url: urlsDocs[i],
  }));

  const ots = (otsRes.data ?? []) as {
    id: string;
    numero: number;
    estado: string;
    tipo: string;
    problema: string | null;
    fecha_programada: string | null;
    created_at: string;
  }[];
  const sucursales = (sucursalesRes.data ?? []) as Sucursal[];

  const nombre =
    e.producto?.nombre ??
    (e.modelo ? `${e.modelo.marca} ${e.modelo.nombre}` : null) ??
    e.marca_modelo_libre ??
    "Equipo";
  const vigente = e.garantia_hasta && e.garantia_hasta >= hoy;

  // QR: apunta a la ruta corta por serie (o a la ficha por id si no hay serie)
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://gastroware-crm.vercel.app";
  const urlQR = e.numero_serie
    ? `${base}/e/${encodeURIComponent(e.numero_serie)}`
    : `${base}/equipos/${e.id}`;
  const qrDataUrl = await QRCode.toDataURL(urlQR, { margin: 1, width: 240 });

  const filas = [
    { k: "Serie", v: e.numero_serie ?? "Sin serie" },
    { k: "Origen", v: e.origen === "vendido" ? "Vendido por GastroWare" : "Otra marca" },
    { k: "Comprado", v: e.fecha_venta ? fechaCorta(e.fecha_venta) : "—" },
    { k: "Instalado", v: e.fecha_instalacion ? fechaCorta(e.fecha_instalacion) : "—" },
    { k: "Próximo service", v: e.proximo_service ? fechaCorta(e.proximo_service) : "—" },
    {
      k: "Sucursal",
      v: e.sucursal ? `${e.sucursal.nombre}${e.sucursal.ciudad ? ` (${e.sucursal.ciudad})` : ""}` : "—",
    },
  ];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{nombre}</h1>
          <p className="text-sm text-piedra">
            {e.cliente && (
              <>
                de{" "}
                <Link
                  href={`/clientes/${e.cliente.id}`}
                  className="text-sky-700 hover:underline"
                >
                  {e.cliente.nombre_comercial}
                </Link>
              </>
            )}
            {e.estado === "en_reparacion" && " · En reparación"}
            {e.estado === "baja" && " · De baja"}
          </p>
        </div>
        <Link
          href={`/servicio/nueva?cliente=${e.cliente_id}&equipo=${e.id}`}
          className="inline-flex items-center gap-1.5 rounded-2xl bg-tinta px-4 py-2.5 text-sm font-medium text-white"
        >
          <Wrench className="h-4 w-4" /> Nueva orden de servicio
        </Link>
      </header>

      <section className="rounded-2xl border border-borde bg-white shadow-sm p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Datos del equipo</h2>
          {e.garantia_hasta && (
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                vigente ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
              }`}
            >
              Garantía {vigente ? "vigente" : "vencida"} ·{" "}
              {fechaCorta(e.garantia_hasta)}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
          {filas.map((f) => (
            <div key={f.k}>
              <p className="text-xs text-piedra">{f.k}</p>
              <p>{f.v}</p>
            </div>
          ))}
        </div>
        {e.observaciones && (
          <p className="mt-2 text-sm text-tinta/70">{e.observaciones}</p>
        )}
        <div className="mt-3">
          <EquipoEditForm equipo={e} sucursales={sucursales} />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-borde bg-white shadow-sm p-4">
          <h2 className="mb-2 text-sm font-semibold">Fotos</h2>
          <FotosEquipo equipoId={e.id} fotos={fotos} />
        </section>

        <section className="rounded-2xl border border-borde bg-white shadow-sm p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Etiqueta QR</h2>
            <Link
              href={`/etiqueta/${e.id}`}
              className="inline-flex items-center gap-1 rounded-xl border border-borde px-3 py-1.5 text-xs text-piedra hover:bg-crema"
            >
              <Printer className="h-3 w-3" /> Imprimir etiqueta
            </Link>
          </div>
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="QR del equipo" className="h-28 w-28" />
            <p className="text-xs text-piedra">
              Pegala en el equipo: escaneando el QR el técnico abre esta ficha
              directo desde el teléfono
              {e.numero_serie ? "" : " (cargale el número de serie para un QR por serie)"}
              .
            </p>
          </div>
        </section>
      </div>

      <DocumentosEntidad
        entidad="equipo"
        entidadId={e.id}
        documentos={documentos}
        puedeBorrar
      />

      <section>
        <h2 className="mb-2 text-sm font-semibold">
          Historial de servicio ({ots.length})
        </h2>
        {ots.length === 0 ? (
          <p className="text-sm text-piedra/80">
            Este equipo todavía no tuvo órdenes de servicio.
          </p>
        ) : (
          <div className="space-y-1.5">
            {ots.map((o) => {
              const est = ESTADOS_OT.find((x) => x.value === o.estado);
              return (
                <Link
                  key={o.id}
                  href={`/servicio/${o.id}`}
                  className="flex items-center justify-between gap-2 rounded-2xl border border-borde bg-white px-3 py-2.5 text-sm shadow-sm"
                >
                  <span>
                    <span className="font-medium">OT-{o.numero}</span>
                    {o.problema && (
                      <span className="text-piedra"> · {o.problema.slice(0, 60)}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-piedra">
                    {est?.label ?? o.estado} ·{" "}
                    {fechaCorta(o.fecha_programada ?? o.created_at)}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
