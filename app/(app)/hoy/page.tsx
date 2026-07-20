import { createClient } from "@/lib/supabase/server";
import { hoyISO, sumarDias } from "@/lib/format";
import TareaItem from "@/components/TareaItem";
import type { Tarea } from "@/lib/types";

const SELECT_TAREA =
  "*, cliente:clientes(*), oportunidad:oportunidades(*, producto:productos(*)), plantilla:plantillas(*)";

export default async function HoyPage() {
  const supabase = await createClient();
  const hoy = hoyISO();

  const { data } = await supabase
    .from("tareas")
    .select(SELECT_TAREA)
    .is("completada_at", null)
    .eq("cancelada", false)
    .lte("vence_el", sumarDias(7))
    .order("vence_el", { ascending: true })
    .limit(100);

  const tareas = (data ?? []) as unknown as Tarea[];
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
      <h1 className="text-xl font-semibold">Hoy</h1>
      <p className="text-sm text-piedra capitalize">{fecha}</p>

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
