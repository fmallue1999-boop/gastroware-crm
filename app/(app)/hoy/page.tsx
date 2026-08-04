import Link from "next/link";
import { MessageCircle, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { hoyISO, sumarDias } from "@/lib/format";
import TareaItem from "@/components/TareaItem";
import PlantillaCopiar from "@/components/PlantillaCopiar";
import type { Plantilla, Tarea } from "@/lib/types";

const SELECT_TAREA =
  "*, cliente:clientes(*), oportunidad:oportunidades(*, producto:productos(*)), plantilla:plantillas(*)";

export default async function HoyPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string }>;
}) {
  const { vista } = await searchParams;
  const supabase = await createClient();
  const hoy = hoyISO();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let queryTareas = supabase
    .from("tareas")
    .select(SELECT_TAREA)
    .is("completada_at", null)
    .eq("cancelada", false)
    .lte("vence_el", sumarDias(7))
    .order("vence_el", { ascending: true })
    .limit(100);
  // "Mías" (default): las asignadas a mí + las sin asignar
  if (vista !== "todas" && user) {
    queryTareas = queryTareas.or(
      `usuario_id.eq.${user.id},usuario_id.is.null`
    );
  }

  const inicioMes = hoy.slice(0, 8) + "01";
  const [
    { data },
    { data: guionesData },
    { data: abiertasData },
    { data: ganadasMes },
    vencidasGlobal,
    otsHoy,
    { data: facturables },
  ] = await Promise.all([
    queryTareas,
    supabase
      .from("plantillas")
      .select("*")
      .in("uso", ["diagnostico:gx", "diagnostico:zumex", "precio:gx", "precio:zumex"])
      .order("nombre"),
    supabase
      .from("oportunidades")
      .select("monto_estimado")
      .in("etapa", ["nueva", "cotizada", "seguimiento"]),
    supabase
      .from("oportunidades")
      .select("monto_estimado")
      .eq("etapa", "ganada")
      .gte("closed_at", inicioMes),
    supabase
      .from("tareas")
      .select("id", { count: "exact", head: true })
      .is("completada_at", null)
      .eq("cancelada", false)
      .lt("vence_el", hoy),
    supabase
      .from("ordenes_trabajo")
      .select("id", { count: "exact", head: true })
      .in("estado", [
        "programado",
        "asignado",
        "en_camino",
        "en_proceso",
        "esperando_repuesto",
        "esperando_cliente",
        "devuelto_tecnico",
      ])
      .or(`fecha_programada.lte.${hoy},fecha_programada.is.null`),
    supabase
      .from("ordenes_trabajo")
      .select("total")
      .eq("estado", "aprobado_facturar"),
  ]);

  const tareas = (data ?? []) as unknown as Tarea[];
  const guiones = (guionesData ?? []) as Plantilla[];

  const fmtMonto = (n: number) =>
    n >= 1000000
      ? "$" + (Math.round(n / 100000) / 10).toLocaleString("es-AR") + " M"
      : "$" + new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(n);

  const kpis = [
    {
      label: "Pipeline abierto",
      valor: fmtMonto((abiertasData ?? []).reduce((s, o) => s + (o.monto_estimado ?? 0), 0)),
      detalle: `${(abiertasData ?? []).length} oportunidades`,
      href: "/pipeline",
    },
    {
      label: "Vendido este mes",
      valor: fmtMonto((ganadasMes ?? []).reduce((s, o) => s + (o.monto_estimado ?? 0), 0)),
      detalle: `${(ganadasMes ?? []).length} ventas`,
      href: "/reportes",
    },
    {
      label: "Seguimientos vencidos",
      valor: String(vencidasGlobal.count ?? 0),
      detalle: "de todo el equipo",
      href: "/hoy?vista=todas",
      alerta: (vencidasGlobal.count ?? 0) > 0,
    },
    {
      label: "Services de hoy",
      valor: String(otsHoy.count ?? 0),
      detalle: "abiertas o en proceso",
      href: "/servicio",
    },
    {
      label: "Por facturar",
      valor: fmtMonto((facturables ?? []).reduce((s, o) => s + (o.total ?? 0), 0)),
      detalle: `${(facturables ?? []).length} órdenes`,
      href: "/servicio?f=facturar",
      alerta: (facturables ?? []).length > 0,
    },
  ];
  const orden = { caliente: 0, tibio: 1, frio: 2 } as Record<string, number>;
  const porTemp = (a: Tarea, b: Tarea) =>
    (orden[a.oportunidad?.temperatura ?? "frio"] ?? 3) -
    (orden[b.oportunidad?.temperatura ?? "frio"] ?? 3);

  const vencidas = tareas.filter((t) => t.vence_el < hoy).sort(porTemp);
  const deHoy = tareas.filter((t) => t.vence_el === hoy).sort(porTemp);
  const proximas = tareas.filter((t) => t.vence_el > hoy);

  const fecha = new Date().toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Argentina/Buenos_Aires",
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inicio</h1>
          <p className="text-sm text-piedra">
            {fecha.charAt(0).toUpperCase() + fecha.slice(1)}
          </p>
        </div>
        <div className="flex gap-1">
          <Link
            href="/hoy"
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              vista !== "todas"
                ? "bg-tinta text-white"
                : "border border-borde text-piedra"
            }`}
          >
            Mías
          </Link>
          <Link
            href="/hoy?vista=todas"
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              vista === "todas"
                ? "bg-tinta text-white"
                : "border border-borde text-piedra"
            }`}
          >
            Todas
          </Link>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 lg:gap-3">
        {kpis.map((k) => (
          <Link
            key={k.label}
            href={k.href}
            className="rounded-2xl border border-borde bg-white p-3.5 shadow-sm transition-colors hover:border-celeste"
          >
            <p className="text-xs text-piedra">{k.label}</p>
            <p
              className={`mt-1 text-xl font-bold tracking-tight ${
                k.alerta ? "text-red-600" : ""
              }`}
            >
              {k.valor}
            </p>
            <p className="mt-0.5 text-[11px] text-piedra/80">{k.detalle}</p>
          </Link>
        ))}
      </div>

      {guiones.length > 0 && (
        <details className="group mt-3">
          <summary className="flex cursor-pointer items-center justify-between rounded-2xl border border-borde bg-white shadow-sm px-4 py-2.5 text-sm font-medium list-none [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-piedra" /> Guiones rápidos
              para el chat
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-piedra transition-transform group-open:rotate-90" />
          </summary>
          <div className="mt-2 space-y-2">
            {guiones.map((g) => (
              <PlantillaCopiar
                key={g.id}
                nombre={g.nombre}
                texto={g.contenido.replace("{monto}", "$X")}
                telefono={null}
              />
            ))}
          </div>
        </details>
      )}

      {vencidas.length > 0 && (
        <section className="mt-5">
          <h2 className="text-sm font-semibold text-red-600 mb-2">
            Vencidas ({vencidas.length})
          </h2>
          <div className="space-y-2">
            {vencidas.map((t) => (
              <TareaItem key={t.id} tarea={t} vencida />
            ))}
          </div>
        </section>
      )}

      <section className="mt-5">
        <h2 className="text-sm font-semibold text-tinta/80 mb-2">
          Para hoy ({deHoy.length})
        </h2>
        {deHoy.length === 0 ? (
          <p className="text-sm text-piedra/80 rounded-2xl border border-dashed border-borde p-4 text-center">
            Nada pendiente para hoy. Cargá un lead nuevo con el botón central.
          </p>
        ) : (
          <div className="space-y-2">
            {deHoy.map((t) => (
              <TareaItem key={t.id} tarea={t} />
            ))}
          </div>
        )}
      </section>

      {proximas.length > 0 && (
        <section className="mt-5">
          <h2 className="text-sm font-semibold text-piedra/80 mb-2">
            Próximos 7 días ({proximas.length})
          </h2>
          <div className="space-y-2 opacity-70">
            {proximas.map((t) => (
              <TareaItem key={t.id} tarea={t} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
