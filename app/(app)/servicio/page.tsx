import Link from "next/link";
import { CalendarPlus, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { hoyISO, fechaCorta, dinero } from "@/lib/format";
import { ESTADOS_OT_ACTIVOS } from "@/lib/constants";
import { EstadoOTBadge } from "@/components/Badges";
import type { OrdenTrabajo, Usuario } from "@/lib/types";

const TIPO: Record<string, string> = {
  correctivo: "Reparación",
  preventivo: "Mantenimiento",
  instalacion: "Instalación",
  garantia: "Garantía",
};

const HECHOS = [
  "finalizado_tecnico",
  "revision_admin",
  "aprobado_facturar",
  "facturado",
  "cerrado",
] as const;

/** Services: los próximos, los hechos y (para administración) los que hay que cobrar. */
export default async function ServiciosPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string }>;
}) {
  const { f } = await searchParams;
  const supabase = await createClient();
  const hoy = hoyISO();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: yo } = await supabase
    .from("usuarios")
    .select("*")
    .eq("id", user!.id)
    .single();
  const rol = (yo as Usuario | null)?.rol ?? "comercial";
  const esGestor = ["direccion", "admin"].includes(rol);

  const FILTROS = [
    { key: "proximos", label: "Próximos" },
    { key: "hechos", label: "Hechos" },
    ...(esGestor ? [{ key: "cobrar", label: "Revisar y cobrar" }] : []),
    { key: "todos", label: "Todos" },
  ];
  const filtro = FILTROS.some((x) => x.key === f) ? f! : "proximos";

  let query = supabase
    .from("ordenes_trabajo")
    .select(
      "*, cliente:clientes(*), equipo:equipos(*, producto:productos(*)), tecnico:usuarios!ordenes_trabajo_tecnico_id_fkey(id, nombre)"
    )
    .limit(150);

  if (filtro === "proximos") {
    query = query
      .in("estado", [
        "solicitud_recibida",
        "pendiente_revision",
        "pendiente_asignacion",
        ...ESTADOS_OT_ACTIVOS,
      ])
      .order("fecha_programada", { ascending: true, nullsFirst: false });
    if (rol === "tecnico") query = query.or(`tecnico_id.eq.${user!.id},tecnico_id.is.null`);
  } else if (filtro === "hechos") {
    query = query.in("estado", [...HECHOS]).order("cerrada_tecnico_at", { ascending: false });
    if (rol === "tecnico") query = query.eq("tecnico_id", user!.id);
  } else if (filtro === "cobrar") {
    query = query
      .in("estado", ["revision_admin", "aprobado_facturar"])
      .order("cerrada_tecnico_at", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data } = await query;
  const ordenes = (data ?? []) as unknown as OrdenTrabajo[];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Services</h1>
        <div className="flex gap-2">
          <Link
            href="/servicio/nueva"
            className="inline-flex items-center gap-1.5 rounded-xl border border-borde bg-white px-3 py-2 text-sm font-medium shadow-sm"
          >
            <CalendarPlus className="h-4 w-4" /> Programar
          </Link>
          <Link
            href="/servicio/cargar"
            className="inline-flex items-center gap-1.5 rounded-xl bg-tinta px-3.5 py-2 text-sm font-semibold text-white shadow-sm"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} /> Cargar hecho
          </Link>
        </div>
      </div>

      <div className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
        {FILTROS.map((x) => (
          <Link
            key={x.key}
            href={`/servicio?f=${x.key}`}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${
              filtro === x.key ? "bg-tinta text-white" : "border border-borde bg-white text-piedra"
            }`}
          >
            {x.label}
          </Link>
        ))}
      </div>

      {ordenes.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-borde p-6 text-center text-sm text-piedra">
          {filtro === "proximos"
            ? "Nada programado. Cuando termines uno, cargalo con “Cargar hecho”."
            : "No hay services acá."}
        </p>
      ) : (
        <div className="grid gap-2 lg:grid-cols-2">
          {ordenes.map((ot) => {
            const atrasada =
              ot.fecha_programada &&
              ot.fecha_programada < hoy &&
              (ESTADOS_OT_ACTIVOS as readonly string[]).includes(ot.estado);
            return (
              <Link
                key={ot.id}
                href={`/servicio/${ot.id}`}
                className="block rounded-2xl border border-borde bg-white p-3 shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-semibold">{ot.cliente?.nombre_comercial}</span>
                  <EstadoOTBadge estado={ot.estado} />
                  {atrasada && (
                    <span className="text-xs font-medium text-amber-700">pasó la fecha</span>
                  )}
                </div>
                <p className="mt-1 text-sm text-tinta/80">
                  {TIPO[ot.tipo] ?? ot.tipo}
                  {ot.equipo
                    ? ` · ${ot.equipo.producto?.nombre ?? ot.equipo.marca_modelo_libre}${
                        ot.equipo.numero_serie ? ` (${ot.equipo.numero_serie})` : ""
                      }`
                    : ""}
                </p>
                {(ot.trabajo_realizado || ot.problema) && (
                  <p className="truncate text-xs text-piedra">
                    {ot.trabajo_realizado ?? ot.problema}
                  </p>
                )}
                <p className="mt-0.5 text-xs text-piedra">
                  {fechaCorta(ot.cerrada_tecnico_at ?? ot.fecha_programada ?? ot.created_at)}
                  {ot.tecnico ? ` · ${ot.tecnico.nombre}` : " · sin técnico"}
                  {ot.total != null ? ` · ${dinero(ot.total)}` : ""}
                  {` · N° ${ot.numero}`}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
