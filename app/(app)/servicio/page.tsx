import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { hoyISO, fechaCorta, dinero } from "@/lib/format";
import { TIPOS_OT } from "@/lib/constants";
import { EstadoOTBadge } from "@/components/Badges";
import type { OrdenTrabajo, Usuario } from "@/lib/types";

const FILTROS = [
  { key: "agenda", label: "Agenda" },
  { key: "abiertas", label: "Abiertas" },
  { key: "revisar", label: "Para revisar" },
  { key: "facturar", label: "Para facturar" },
  { key: "todas", label: "Todas" },
] as const;

export default async function ServicioPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string }>;
}) {
  const { f } = await searchParams;
  const filtro = f ?? "agenda";
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
  const rol = (yo as Usuario | null)?.rol ?? "vendedor";

  let query = supabase
    .from("ordenes_trabajo")
    .select(
      "*, cliente:clientes(*), equipo:equipos_instalados(*, producto:productos(*)), tecnico:usuarios!ordenes_trabajo_tecnico_id_fkey(id, nombre)"
    )
    .order("fecha_programada", { ascending: true, nullsFirst: false })
    .limit(200);

  if (filtro === "agenda") {
    query = query
      .in("estado", ["abierta", "en_proceso"])
      .or(`fecha_programada.lte.${hoy},fecha_programada.is.null`);
  } else if (filtro === "abiertas") {
    query = query.in("estado", ["abierta", "en_proceso"]);
  } else if (filtro === "revisar") {
    query = query.eq("estado", "cerrada_tecnico");
  } else if (filtro === "facturar") {
    query = query.eq("estado", "facturable");
  }
  // Técnico ve lo suyo (salvo en "todas")
  if (rol === "tecnico" && filtro !== "todas") {
    query = query.eq("tecnico_id", user!.id);
  }

  const { data } = await query;
  const ordenes = (data ?? []) as unknown as OrdenTrabajo[];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Servicio técnico</h1>
        <Link
          href="/servicio/nueva"
          className="rounded-2xl bg-tinta px-3 py-2 text-sm font-medium text-white"
        >
          + Nueva orden
        </Link>
      </div>

      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
        {FILTROS.map((x) => (
          <Link
            key={x.key}
            href={`/servicio?f=${x.key}`}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
              filtro === x.key
                ? "bg-tinta text-white"
                : "border border-borde text-piedra"
            }`}
          >
            {x.label}
          </Link>
        ))}
      </div>

      {ordenes.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-borde p-6 text-center text-sm text-piedra">
          {filtro === "agenda"
            ? "Nada pendiente para hoy."
            : "No hay órdenes acá."}
        </p>
      ) : (
        <div className="space-y-2">
          {ordenes.map((ot) => {
            const atrasada =
              ot.fecha_programada &&
              ot.fecha_programada < hoy &&
              ["abierta", "en_proceso"].includes(ot.estado);
            return (
              <Link
                key={ot.id}
                href={`/servicio/${ot.id}`}
                className="block rounded-2xl border border-borde bg-white shadow-sm p-3"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-semibold">OT-{ot.numero}</span>
                  <EstadoOTBadge estado={ot.estado} />
                  <span className="rounded-full border border-borde px-2 py-0.5 text-xs text-piedra">
                    {TIPOS_OT.find((t) => t.value === ot.tipo)?.label}
                  </span>
                  {atrasada && (
                    <span className="text-xs font-medium text-red-600">
                      atrasada
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm font-medium">
                  {ot.cliente?.nombre_comercial}
                </p>
                <p className="text-xs text-piedra">
                  {ot.equipo
                    ? (ot.equipo.producto?.nombre ?? ot.equipo.marca_modelo) +
                      (ot.equipo.numero_serie ? ` · ${ot.equipo.numero_serie}` : "")
                    : "Sin equipo asignado"}
                  {ot.fecha_programada ? ` · ${fechaCorta(ot.fecha_programada)}` : ""}
                  {ot.tecnico ? ` · ${ot.tecnico.nombre}` : ""}
                  {ot.total != null ? ` · ${dinero(ot.total)}` : ""}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
