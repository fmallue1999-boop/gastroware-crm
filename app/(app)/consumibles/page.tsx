import Link from "next/link";
import { CalendarDays, List, Plus, Rows3 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { hoyISO } from "@/lib/format";
import { esGestor } from "@/lib/puestos";
import { cuando, masDias, semanasDelMes } from "@/lib/agenda";
import { agruparPorCliente } from "@/lib/consumibles";
import { cargarPlanes, numerosConsumibles, type PlanVista } from "@/lib/servidor/consumibles";
import GrupoReposicion from "@/components/consumibles/GrupoReposicion";
import CalendarioMes from "@/components/agenda/CalendarioMes";
import AyudaLink from "@/components/guia/AyudaLink";

export const metadata = { title: "Consumibles" };

type Params = { ver?: string; mes?: string; dia?: string; quien?: string };

/**
 * Consumibles: a quién contactar para la reposición (agrupado por cliente),
 * el calendario de reposiciones y todos los planes. Cada venta reinicia el
 * plazo del producto para ese cliente; el aviso no manda nada solo.
 */
export default async function ConsumiblesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const p = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const yo = user?.id ?? "";
  const hoy = hoyISO();
  const ver = p.ver === "calendario" ? "calendario" : p.ver === "todos" ? "todos" : "contactar";
  const soloMios = p.quien === "mios";
  const mes = /^\d{4}-\d{2}$/.test(p.mes ?? "") ? `${p.mes}-01` : `${hoy.slice(0, 7)}-01`;

  const href = (c: Partial<Params>) => {
    const s = new URLSearchParams();
    const t = { ver, quien: soloMios ? "mios" : undefined, ...c };
    if (t.ver && t.ver !== "contactar") s.set("ver", t.ver);
    if (t.quien) s.set("quien", t.quien);
    if (t.mes) s.set("mes", t.mes);
    if (t.dia) s.set("dia", t.dia);
    const q = s.toString();
    return q ? `/consumibles?${q}` : "/consumibles";
  };

  const semanas = semanasDelMes(mes);
  const [planes, numeros, { data: usuarios }] = await Promise.all([
    ver === "contactar"
      ? cargarPlanes(supabase, { hasta: masDias(hoy, 14), responsable: soloMios ? yo : null })
      : ver === "calendario"
        ? cargarPlanes(supabase, { desde: semanas[0][0], hasta: semanas[semanas.length - 1][6], responsable: soloMios ? yo : null })
        : cargarPlanes(supabase, { incluirSuspendidos: true, responsable: soloMios ? yo : null }),
    numerosConsumibles(supabase, hoy),
    supabase.from("usuarios").select("id, nombre, rol").eq("activo", true).order("nombre"),
  ]);
  const equipo = ((usuarios ?? []) as { id: string; nombre: string; rol: string }[]).map(({ id, nombre }) => ({ id, nombre }));
  const puedeEliminar = esGestor(((usuarios ?? []) as { id: string; rol: string }[]).find((u) => u.id === yo)?.rol);

  const grupos = agruparPorCliente(planes);
  const vencidos = grupos.filter((g) => g[0].proxima_alerta < hoy);
  const deHoy = grupos.filter((g) => g[0].proxima_alerta === hoy);
  const proximos = grupos.filter((g) => g[0].proxima_alerta > hoy);

  const diaElegido = /^\d{4}-\d{2}-\d{2}$/.test(p.dia ?? "") ? p.dia! : mes.slice(0, 7) === hoy.slice(0, 7) ? hoy : mes;
  const itemsCalendario = planes.map((x) => ({
    id: x.id,
    fecha: x.proxima_alerta,
    titulo: `${x.cliente?.nombre_comercial ?? "Cliente"} · ${x.producto?.nombre ?? ""}`,
    hora: null,
    tipo: "consumible",
    hechaYo: false,
  }));

  const bloque = (titulo: string, lista: PlanVista[][], clase = "text-piedra") =>
    lista.length > 0 && (
      <section className="space-y-2">
        <h2 className={`text-xs font-bold uppercase tracking-wide ${clase}`}>
          {titulo} ({lista.length})
        </h2>
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {lista.map((g) => (
            <GrupoReposicion key={g.map((x) => x.id).join("-")} planes={g} hoy={hoy} usuarios={equipo} puedeEliminar={puedeEliminar} />
          ))}
        </div>
      </section>
    );

  const pestana = (valor: string, etiqueta: string, Icono: typeof List) => (
    <Link
      href={href({ ver: valor, mes: undefined, dia: undefined })}
      className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-[15px] font-bold ${ver === valor ? "bg-marino text-white" : "text-tinta/80 hover:bg-crema"}`}
    >
      <Icono className="h-4 w-4" /> {etiqueta}
    </Link>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="flex flex-wrap items-center gap-x-2 text-2xl font-extrabold tracking-tight">
            Consumibles <AyudaLink tarea="consumibles" />
          </h1>
          <p className="text-[15px] text-piedra">A quién contactar para reponer. Cada compra reinicia el plazo del producto para ese cliente.</p>
        </div>
        <Link href="/consumibles/venta" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-verde px-4 text-[15px] font-extrabold text-white">
          <Plus className="h-5 w-5" /> Registrar venta
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-white p-3 shadow-sm">
          <p className="text-2xl font-extrabold">{numeros.ventasMes}</p>
          <p className="text-xs text-piedra">ventas este mes</p>
        </div>
        <div className="rounded-2xl bg-white p-3 shadow-sm">
          <p className={`text-2xl font-extrabold ${numeros.paraContactar ? "text-ambar" : ""}`}>{numeros.paraContactar}</p>
          <p className="text-xs text-piedra">para contactar hoy o atrasadas</p>
        </div>
        <div className="rounded-2xl bg-white p-3 shadow-sm">
          <p className="text-2xl font-extrabold">{numeros.proximos}</p>
          <p className="text-xs text-piedra">reposiciones en 30 días</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-2xl bg-white p-1 shadow-sm">
          {pestana("contactar", "A contactar", List)}
          {pestana("calendario", "Calendario", CalendarDays)}
          {pestana("todos", "Todos", Rows3)}
        </div>
        <div className="flex gap-1 rounded-2xl bg-white p-1 shadow-sm">
          <Link href={href({ quien: undefined })} className={`min-h-10 rounded-xl px-3 py-2 text-[15px] font-bold ${!soloMios ? "bg-marino text-white" : "text-tinta/80"}`}>
            Todos
          </Link>
          <Link href={href({ quien: "mios" })} className={`min-h-10 rounded-xl px-3 py-2 text-[15px] font-bold ${soloMios ? "bg-marino text-white" : "text-tinta/80"}`}>
            A mi cargo
          </Link>
        </div>
      </div>

      {ver === "contactar" && (
        <div className="space-y-5">
          {grupos.length === 0 && (
            <div className="rounded-2xl bg-white px-4 py-8 text-center shadow-sm">
              <p className="text-lg font-bold">Nada para contactar en los próximos 14 días.</p>
              <p className="mt-1 text-[15px] text-piedra">Cuando registres ventas de consumibles, acá aparecen las reposiciones.</p>
            </div>
          )}
          {bloque("Atrasadas", vencidos, "text-red-600")}
          {bloque("Hoy", deHoy, "text-marino")}
          {bloque("Próximos 14 días", proximos)}
        </div>
      )}

      {ver === "calendario" && (
        <>
          <CalendarioMes mes={mes} hoy={hoy} diaElegido={diaElegido} items={itemsCalendario} href={({ mes: m, dia }) => href({ ver: "calendario", mes: m, dia })} />
          <section className="space-y-2">
            <h2 className="text-[17px] font-extrabold first-letter:uppercase">{cuando(diaElegido, hoy)}</h2>
            {agruparPorCliente(planes.filter((x) => x.proxima_alerta === diaElegido)).map((g) => (
              <GrupoReposicion key={g.map((x) => x.id).join("-")} planes={g} hoy={hoy} usuarios={equipo} puedeEliminar={puedeEliminar} />
            ))}
            {!planes.some((x) => x.proxima_alerta === diaElegido) && (
              <p className="rounded-2xl bg-white px-4 py-4 text-center text-[15px] text-piedra shadow-sm">Nada para contactar este día.</p>
            )}
          </section>
        </>
      )}

      {ver === "todos" && (
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {planes.length === 0 && <p className="rounded-2xl bg-white px-4 py-6 text-center text-[15px] text-piedra shadow-sm">Todavía no hay planes de reposición.</p>}
          {agruparPorCliente(planes, 100000)
            .sort((a, b) => (a[0].cliente?.nombre_comercial ?? "").localeCompare(b[0].cliente?.nombre_comercial ?? ""))
            .map((g) => (
              <GrupoReposicion key={g.map((x) => x.id).join("-")} planes={g} hoy={hoy} usuarios={equipo} puedeEliminar={puedeEliminar} />
            ))}
        </div>
      )}
    </div>
  );
}
