import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fechaCorta, dinero, hoyISO } from "@/lib/format";
import { TIPOS_OT } from "@/lib/constants";
import { EstadoOTBadge } from "@/components/Badges";
import OTTrabajo from "@/components/OTTrabajo";
import OTAdminControl from "@/components/OTAdminControl";
import type { OrdenTrabajo, OTFoto, OTItem, Producto, Usuario } from "@/lib/types";

export default async function OTPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const hoy = hoyISO();

  const { data } = await supabase
    .from("ordenes_trabajo")
    .select(
      "*, cliente:clientes(*), equipo:equipos_instalados(*, producto:productos(*)), tecnico:usuarios!ordenes_trabajo_tecnico_id_fkey(id, nombre)"
    )
    .eq("id", id)
    .single();
  if (!data) notFound();
  const ot = data as unknown as OrdenTrabajo;

  const [
    { data: items },
    { data: fotos },
    { data: refacciones },
    { data: cfg },
    {
      data: { user },
    },
  ] = await Promise.all([
    supabase.from("ot_items").select("*").eq("ot_id", id).order("created_at"),
    supabase.from("ot_fotos").select("*").eq("ot_id", id).order("created_at"),
    supabase
      .from("productos")
      .select("*")
      .eq("categoria", "refaccion")
      .eq("activo", true)
      .order("nombre"),
    supabase.from("config").select("valor").eq("clave", "tarifa_hora").single(),
    supabase.auth.getUser(),
  ]);
  const { data: yo } = await supabase
    .from("usuarios")
    .select("*")
    .eq("id", user!.id)
    .single();

  const rol = (yo as Usuario | null)?.rol ?? "vendedor";
  const tarifa = Number(cfg?.valor) || 0;
  const listaItems = (items ?? []) as OTItem[];
  const listaFotos = (fotos ?? []) as OTFoto[];

  const editable = ["abierta", "en_proceso"].includes(ot.estado);
  const garantiaVigente =
    ot.equipo?.garantia_hasta && ot.equipo.garantia_hasta >= hoy;

  const manoObra = ot.es_garantia ? 0 : (Number(ot.horas) || 0) * tarifa;
  const totalItems = listaItems
    .filter((i) => i.refacturable)
    .reduce((s, i) => s + Number(i.cantidad) * Number(i.precio_unit), 0);
  const totalEstimado = manoObra + totalItems;

  return (
    <div className="space-y-3">
      <header className="rounded-xl border border-borde bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold">OT-{ot.numero}</h1>
          <EstadoOTBadge estado={ot.estado} />
          <span className="rounded-full border border-borde px-2 py-0.5 text-xs text-piedra">
            {TIPOS_OT.find((t) => t.value === ot.tipo)?.label}
          </span>
        </div>
        <Link
          href={`/clientes/${ot.cliente_id}`}
          className="mt-1 block text-sm font-medium text-sky-700"
        >
          {ot.cliente?.nombre_comercial} →
        </Link>
        <p className="text-xs text-piedra">
          {ot.equipo
            ? `${ot.equipo.producto?.nombre ?? ot.equipo.marca_modelo}${ot.equipo.numero_serie ? ` · serie ${ot.equipo.numero_serie}` : ""}`
            : "Sin equipo asignado"}
          {ot.equipo?.garantia_hasta && (
            <span className={garantiaVigente ? "text-green-700" : "text-red-600"}>
              {" "}· garantía {garantiaVigente ? "vigente" : "vencida"} (
              {fechaCorta(ot.equipo.garantia_hasta)})
            </span>
          )}
        </p>
        <p className="text-xs text-piedra">
          {ot.fecha_programada ? `Programada ${fechaCorta(ot.fecha_programada)}` : "Sin fecha"}
          {ot.tecnico ? ` · Técnico: ${ot.tecnico.nombre}` : ""}
          {ot.cliente?.telefono ? ` · ${ot.cliente.telefono}` : ""}
        </p>
        {ot.problema && (
          <p className="mt-2 rounded-lg bg-crema p-3 text-sm text-tinta/80">
            <span className="font-medium">Problema:</span> {ot.problema}
          </p>
        )}
      </header>

      <OTTrabajo
        ot={ot}
        items={listaItems}
        fotos={listaFotos}
        refacciones={(refacciones ?? []) as Producto[]}
        editable={editable}
      />

      <section className="rounded-xl border border-borde bg-white p-4">
        <h2 className="text-sm font-semibold mb-2">Cuenta</h2>
        <div className="space-y-1 text-sm">
          <p className="flex justify-between">
            <span className="text-piedra">
              Mano de obra ({ot.horas ?? 0} h × {dinero(tarifa)})
              {ot.es_garantia ? " — garantía" : ""}
            </span>
            <span>{dinero(manoObra)}</span>
          </p>
          <p className="flex justify-between">
            <span className="text-piedra">Refacciones y gastos refacturables</span>
            <span>{dinero(totalItems)}</span>
          </p>
          <p className="flex justify-between border-t border-borde pt-1 font-semibold">
            <span>Total {ot.estado === "facturable" || ot.estado === "facturada" ? "" : "estimado"}</span>
            <span>{dinero(ot.total ?? totalEstimado)}</span>
          </p>
          {tarifa === 0 && !ot.es_garantia && (
            <p className="text-xs text-amber-700">
              ⚠️ La tarifa por hora está en $0 — configurala en Más.
            </p>
          )}
        </div>
      </section>

      <OTAdminControl ot={ot} rol={rol} />

      {(ot.estado === "cerrada_tecnico" ||
        ot.estado === "facturable" ||
        ot.estado === "facturada") && (
        <Link
          href={`/comprobante/${ot.id}`}
          className="block rounded-xl border border-borde bg-white py-3 text-center text-sm font-medium"
        >
          📄 Ver comprobante de service
        </Link>
      )}
    </div>
  );
}
