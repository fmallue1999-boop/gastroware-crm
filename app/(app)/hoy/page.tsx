import Link from "next/link";
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
      `vendedor_id.eq.${user.id},vendedor_id.is.null`
    );
  }

  const [{ data }, { data: guionesData }] = await Promise.all([
    queryTareas,
    supabase
      .from("plantillas")
      .select("*")
      .in("uso", ["diagnostico:gx", "diagnostico:zumex", "precio:gx", "precio:zumex"])
      .order("nombre"),
  ]);

  const tareas = (data ?? []) as unknown as Tarea[];
  const guiones = (guionesData ?? []) as Plantilla[];
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
          <h1 className="text-xl font-semibold">Hoy</h1>
          <p className="text-sm text-piedra capitalize">{fecha}</p>
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

      {guiones.length > 0 && (
        <details className="group mt-3">
          <summary className="flex cursor-pointer items-center justify-between rounded-xl border border-borde bg-white px-4 py-2.5 text-sm font-medium list-none [&::-webkit-details-marker]:hidden">
            <span>💬 Guiones rápidos para el chat</span>
            <span className="text-piedra transition-transform group-open:rotate-90">▸</span>
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
          <p className="text-sm text-piedra/80 rounded-xl border border-dashed border-borde p-4 text-center">
            Nada pendiente para hoy. Cargá un lead nuevo desde ➕.
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
