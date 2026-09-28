import Link from "next/link";
import { CalendarDays, List, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { hoyISO } from "@/lib/format";
import { esGestor } from "@/lib/puestos";
import { cuando, masDias, semanasDelMes } from "@/lib/agenda";
import { atrasadasMias, cargarAgenda, nombresUsuarios, type Alcance, type ItemAgenda } from "@/lib/servidor/agenda";
import FilaAgenda from "@/components/agenda/FilaAgenda";
import CalendarioMes from "@/components/agenda/CalendarioMes";
import AyudaLink from "@/components/guia/AyudaLink";

export const metadata = { title: "Tareas" };

type Params = { ver?: string; vista?: string; mes?: string; dia?: string; persona?: string };

function Dia({ fecha, hoy, items, progreso }: { fecha: string; hoy: string; items: ItemAgenda[]; progreso: boolean }) {
  return (
    <section>
      <h2 className={`mb-2 text-xs font-bold uppercase tracking-wide ${fecha === hoy ? "text-marino" : "text-piedra"}`}>{cuando(fecha, hoy)}</h2>
      <div className="space-y-2">
        {items.map((i) => (
          <FilaAgenda key={i.id} item={i} hoy={hoy} progreso={progreso} />
        ))}
      </div>
    </section>
  );
}

/**
 * Tareas y agenda: tareas sueltas, reuniones, capacitaciones y pagos. Mi
 * agenda (lo que tengo), lo que asigné (para seguirlo) y, para dirección,
 * la de todo el equipo. En lista o en el calendario del mes.
 */
export default async function TareasPage({ searchParams }: { searchParams: Promise<Params> }) {
  const p = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const yo = user?.id ?? "";
  const { data: rolData } = await supabase.rpc("fn_rol");
  const gestor = esGestor(rolData as string);
  const q = { yo, gestor };
  const hoy = hoyISO();

  const ver: Alcance = p.ver === "asigne" ? "asigne" : p.ver === "equipo" && gestor ? "equipo" : "mia";
  const vista = p.vista === "mes" ? "mes" : "lista";
  const mes = /^\d{4}-\d{2}$/.test(p.mes ?? "") ? `${p.mes}-01` : `${hoy.slice(0, 7)}-01`;
  const persona = ver === "equipo" ? p.persona ?? null : null;
  const nombres = await nombresUsuarios(supabase);

  const href = (cambio: Partial<Params>) => {
    const s = new URLSearchParams();
    const todo = { ver, vista, persona: persona ?? undefined, ...cambio };
    if (todo.ver && todo.ver !== "mia") s.set("ver", todo.ver);
    if (todo.vista && todo.vista !== "lista") s.set("vista", todo.vista);
    if (todo.persona) s.set("persona", todo.persona);
    if (todo.mes) s.set("mes", todo.mes);
    if (todo.dia) s.set("dia", todo.dia);
    const t = s.toString();
    return t ? `/tareas?${t}` : "/tareas";
  };

  // Datos según la vista
  let atrasadas: ItemAgenda[] = [];
  let items: ItemAgenda[] = [];
  let diaElegido: string | null = null;
  if (vista === "mes") {
    const semanas = semanasDelMes(mes);
    items = await cargarAgenda(supabase, q, { desde: semanas[0][0], hasta: semanas[semanas.length - 1][6], alcance: ver, persona, nombres });
    diaElegido = /^\d{4}-\d{2}-\d{2}$/.test(p.dia ?? "") ? p.dia! : mes.slice(0, 7) === hoy.slice(0, 7) ? hoy : mes;
  } else {
    const desde = ver === "asigne" ? masDias(hoy, -30) : hoy;
    [items, atrasadas] = await Promise.all([
      cargarAgenda(supabase, q, { desde, hasta: masDias(hoy, 90), alcance: ver, persona, nombres }),
      ver === "mia" ? atrasadasMias(supabase, q, hoy, nombres) : Promise.resolve([]),
    ]);
  }

  const porDia = new Map<string, ItemAgenda[]>();
  for (const i of items) porDia.set(i.fecha, [...(porDia.get(i.fecha) ?? []), i]);
  const dias = [...porDia.keys()].sort();
  const progreso = ver !== "mia";

  const pestanas: { valor: Alcance; label: string }[] = [
    { valor: "mia", label: "Mi agenda" },
    { valor: "asigne", label: "Lo que asigné" },
    ...(gestor ? [{ valor: "equipo" as Alcance, label: "Equipo" }] : []),
  ];
  const personas = [...nombres.entries()].sort((a, b) => a[1].localeCompare(b[1]));

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="flex flex-wrap items-center gap-x-2 text-2xl font-extrabold tracking-tight">
            Tareas y agenda <AyudaLink tarea="agenda" />
          </h1>
          <p className="text-[15px] text-piedra">Tareas, reuniones, capacitaciones y pagos. Lo de hoy aparece también en Mi día.</p>
        </div>
        <Link
          href={diaElegido && diaElegido >= hoy ? `/tareas/nueva?fecha=${diaElegido}` : "/tareas/nueva"}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-marino px-4 text-[15px] font-extrabold text-white"
        >
          <Plus className="h-5 w-5" /> Nueva
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1 rounded-2xl bg-white p-1 shadow-sm">
          {pestanas.map((t) => (
            <Link
              key={t.valor}
              href={href({ ver: t.valor, persona: undefined })}
              className={`min-h-10 rounded-xl px-3.5 py-2 text-[15px] font-bold ${ver === t.valor ? "bg-marino text-white" : "text-tinta/80 hover:bg-crema"}`}
            >
              {t.label}
            </Link>
          ))}
        </div>
        <div className="flex gap-1 rounded-2xl bg-white p-1 shadow-sm">
          <Link
            href={href({ vista: "lista", mes: undefined, dia: undefined })}
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-[15px] font-bold ${vista === "lista" ? "bg-marino text-white" : "text-tinta/80 hover:bg-crema"}`}
          >
            <List className="h-4 w-4" /> Lista
          </Link>
          <Link
            href={href({ vista: "mes" })}
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-[15px] font-bold ${vista === "mes" ? "bg-marino text-white" : "text-tinta/80 hover:bg-crema"}`}
          >
            <CalendarDays className="h-4 w-4" /> Mes
          </Link>
        </div>
      </div>

      {ver === "equipo" && (
        <div className="flex flex-wrap gap-1.5">
          <Link
            href={href({ persona: undefined })}
            className={`rounded-full border px-3 py-1.5 text-[14px] font-bold ${!persona ? "border-marino bg-marino text-white" : "border-borde bg-white"}`}
          >
            Todos
          </Link>
          {personas.map(([id, nombre]) => (
            <Link
              key={id}
              href={href({ persona: id })}
              className={`rounded-full border px-3 py-1.5 text-[14px] font-bold ${persona === id ? "border-marino bg-marino text-white" : "border-borde bg-white"}`}
            >
              {nombre}
            </Link>
          ))}
        </div>
      )}

      {vista === "mes" ? (
        <>
          <CalendarioMes mes={mes} hoy={hoy} diaElegido={diaElegido} items={items} href={({ mes: m, dia }) => href({ vista: "mes", mes: m, dia })} />
          {diaElegido && (
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[17px] font-extrabold first-letter:uppercase">{cuando(diaElegido, hoy)}</h2>
                {diaElegido >= hoy && (
                  <Link href={`/tareas/nueva?fecha=${diaElegido}`} className="inline-flex items-center gap-1 text-[15px] font-bold text-marino">
                    <Plus className="h-4 w-4" /> Agregar este día
                  </Link>
                )}
              </div>
              {(porDia.get(diaElegido) ?? []).length === 0 ? (
                <p className="rounded-2xl bg-white px-4 py-4 text-center text-[15px] text-piedra shadow-sm">Nada este día.</p>
              ) : (
                (porDia.get(diaElegido) ?? []).map((i) => <FilaAgenda key={i.id} item={i} hoy={hoy} progreso={progreso} />)
              )}
            </section>
          )}
        </>
      ) : (
        <div className="space-y-5">
          {atrasadas.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-red-600">Atrasadas ({atrasadas.length})</h2>
              <div className="space-y-2">
                {atrasadas.map((i) => (
                  <FilaAgenda key={i.id} item={i} hoy={hoy} />
                ))}
              </div>
            </section>
          )}
          {dias.length === 0 && atrasadas.length === 0 && (
            <div className="rounded-2xl bg-white px-4 py-8 text-center shadow-sm">
              <p className="text-lg font-bold">
                {ver === "asigne" ? "Todavía no asignaste nada." : ver === "equipo" ? "Nada en la agenda del equipo." : "Tu agenda está vacía."}
              </p>
              <p className="mt-1 text-[15px] text-piedra">Cargá una tarea, una reunión o un recordatorio de pago con “Nueva”.</p>
            </div>
          )}
          {dias.map((d) => (
            <Dia key={d} fecha={d} hoy={hoy} items={porDia.get(d) ?? []} progreso={progreso} />
          ))}
        </div>
      )}
    </div>
  );
}
