import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, History } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { firmarUrl, firmarUrls } from "@/lib/core/storage";
import { fechaCorta, dinero, hoyISO } from "@/lib/format";
import { TIPOS_OT, COBERTURAS_OT, ESTADOS_OT } from "@/lib/constants";
import { EstadoOTBadge, PrioridadBadge } from "@/components/Badges";
import OTTrabajo from "@/components/OTTrabajo";
import OTAdminControl from "@/components/OTAdminControl";
import type {
  OrdenTrabajo,
  OTFoto,
  OTItem,
  OTTiempo,
  OTTransicion,
  Repuesto,
  StatusHistory,
  Usuario,
} from "@/lib/types";

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
      "*, cliente:clientes(*), equipo:equipos(*, producto:productos(*)), tecnico:usuarios!ordenes_trabajo_tecnico_id_fkey(id, nombre)"
    )
    .eq("id", id)
    .single();
  if (!data) notFound();
  const ot = data as unknown as OrdenTrabajo;

  const [
    { data: items },
    { data: fotos },
    { data: tiempos },
    { data: transiciones },
    { data: historial },
    { data: repuestos },
    { data: cfg },
    {
      data: { user },
    },
  ] = await Promise.all([
    supabase.from("ot_items").select("*").eq("ot_id", id).order("created_at"),
    supabase.from("ot_fotos").select("*").eq("ot_id", id).order("created_at"),
    supabase.from("ot_tiempos").select("*").eq("ot_id", id).order("inicio"),
    supabase.from("ot_transiciones").select("*").eq("desde", ot.estado),
    supabase
      .from("status_history")
      .select("*")
      .eq("ot_id", id)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("repuestos")
      .select("*")
      .eq("activo", true)
      .is("deleted_at", null)
      .order("descripcion"),
    supabase.from("config").select("valor").eq("clave", "tarifa_hora").single(),
    supabase.auth.getUser(),
  ]);
  const { data: yo } = await supabase
    .from("usuarios")
    .select("rol")
    .eq("id", user!.id)
    .single();

  const rol = (yo as Usuario | null)?.rol ?? "comercial";
  const esGestor = ["direccion", "admin"].includes(rol);
  const esTecnicoAsignado = rol === "tecnico" && ot.tecnico_id === user!.id;

  const listaTrans = (transiciones ?? []) as OTTransicion[];
  const transicionesGestor = esGestor
    ? listaTrans.map((t) => t.hacia)
    : [];
  const transicionesTecnico = (esTecnicoAsignado || esGestor)
    ? listaTrans
        .filter((t) => t.requiere_rol !== "gestor" || esGestor)
        .map((t) => t.hacia)
        .filter((h) =>
          ["en_camino", "en_proceso", "esperando_repuesto", "esperando_cliente", "finalizado_tecnico"].includes(h)
        )
    : [];

  const listaItems = (items ?? []) as OTItem[];
  const listaTiempos = (tiempos ?? []) as OTTiempo[];
  const tarifa = Number(cfg?.valor) || 0;

  // URLs firmadas (storage privado)
  const listaFotos = (fotos ?? []) as OTFoto[];
  const fotoUrls = await firmarUrls("servicio", listaFotos.map((f) => f.path));
  const fotosConUrl = listaFotos.map((f, i) => ({
    id: f.id,
    momento: f.momento,
    url: fotoUrls[i],
  }));
  const firmaUrl = await firmarUrl("servicio", ot.firma_path);

  const editable =
    ["programado", "asignado", "en_camino", "en_proceso", "esperando_repuesto", "esperando_cliente", "devuelto_tecnico"].includes(ot.estado) &&
    (esTecnicoAsignado || esGestor);

  const garantiaVigente =
    ot.equipo?.garantia_hasta && ot.equipo.garantia_hasta >= hoy;
  const minutos = listaTiempos.reduce((s, t) => s + (t.minutos ?? 0), 0);
  const manoObra = ot.cobertura === "garantia" ? 0 : (minutos / 60) * tarifa;
  const itemsAprobados = listaItems
    .filter((i) => i.estado === "facturable" && i.aprobado_admin)
    .reduce((s, i) => s + Number(i.cantidad) * Number(i.precio_unit), 0);

  return (
    <div className="space-y-3">
      <header className="rounded-2xl border border-borde bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold">OT-{ot.numero}</h1>
          <EstadoOTBadge estado={ot.estado} />
          <PrioridadBadge prioridad={ot.prioridad} />
          <span className="rounded-full border border-borde px-2 py-0.5 text-xs text-piedra">
            {TIPOS_OT.find((t) => t.value === ot.tipo)?.label}
          </span>
          <span className="rounded-full border border-borde px-2 py-0.5 text-xs text-piedra">
            {COBERTURAS_OT.find((c) => c.value === ot.cobertura)?.label}
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
            ? `${ot.equipo.producto?.nombre ?? ot.equipo.marca_modelo_libre}${ot.equipo.numero_serie ? ` · serie ${ot.equipo.numero_serie}` : ""}`
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
          {ot.tecnico ? ` · Técnico: ${ot.tecnico.nombre}` : " · Sin técnico"}
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
        fotos={fotosConUrl}
        tiempos={listaTiempos}
        repuestos={(repuestos ?? []) as Repuesto[]}
        editable={editable}
        firmaUrl={firmaUrl}
        transicionesTecnico={transicionesTecnico}
      />

      <section className="rounded-2xl border border-borde bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold">Cuenta</h2>
        <div className="space-y-1 text-sm">
          <p className="flex justify-between">
            <span className="text-piedra">
              Mano de obra ({(minutos / 60).toFixed(1)} h × {dinero(tarifa)})
              {ot.cobertura === "garantia" ? " — por garantía" : ""}
            </span>
            <span>{dinero(manoObra)}</span>
          </p>
          <p className="flex justify-between">
            <span className="text-piedra">Ítems facturables aprobados</span>
            <span>{dinero(itemsAprobados)}</span>
          </p>
          <p className="flex justify-between border-t border-borde pt-1 font-semibold">
            <span>
              Total {ot.total != null ? "" : "estimado"}
            </span>
            <span>{dinero(ot.total ?? manoObra + itemsAprobados)}</span>
          </p>
          {tarifa === 0 && ot.cobertura !== "garantia" && (
            <p className="text-xs text-amber-700">
              La tarifa por hora está en $0 — configurala en Administración.
            </p>
          )}
        </div>
      </section>

      <OTAdminControl
        ot={ot}
        items={listaItems}
        esGestor={esGestor}
        transicionesGestor={transicionesGestor}
      />

      {(ot.firma_path || ot.cerrada_tecnico_at) && (
        <Link
          href={`/comprobante/${ot.id}`}
          className="flex items-center justify-center gap-2 rounded-2xl border border-borde bg-white py-3 text-center text-sm font-medium shadow-sm"
        >
          <FileText className="h-4 w-4" /> Ver informe de service
        </Link>
      )}

      {(historial ?? []).length > 0 && (
        <details className="group">
          <summary className="flex cursor-pointer items-center justify-between rounded-2xl border border-borde bg-white px-4 py-3 text-sm font-medium shadow-sm list-none [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2">
              <History className="h-4 w-4 text-piedra" /> Historial de estados
            </span>
            <span className="text-piedra">▾</span>
          </summary>
          <div className="mt-2 space-y-1.5 rounded-2xl border border-borde bg-white p-4 shadow-sm">
            {((historial ?? []) as StatusHistory[]).map((h) => (
              <p key={h.id} className="text-sm">
                <span className="text-piedra">{fechaCorta(h.created_at)}:</span>{" "}
                {ESTADOS_OT.find((e) => e.value === h.desde)?.label ?? h.desde ?? "—"} →{" "}
                <span className="font-medium">
                  {ESTADOS_OT.find((e) => e.value === h.hacia)?.label ?? h.hacia}
                </span>
                {h.observacion ? (
                  <span className="text-piedra"> · {h.observacion}</span>
                ) : null}
              </p>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
