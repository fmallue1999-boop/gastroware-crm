import Link from "next/link";
import { notFound } from "next/navigation";
import { Bell, CheckCircle2, Circle, ExternalLink, MapPin, Repeat, Video } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { dinero, hoyISO } from "@/lib/format";
import { esGestor } from "@/lib/puestos";
import { AVISOS, cuando, esEvento, esLink, estadoAgenda, horario, linkGoogleCalendar, nombreTipo, REPETICIONES, textoHecha, type TipoAgenda } from "@/lib/agenda";
import { unaDeAgenda } from "@/lib/servidor/agenda";
import AccionesAgenda from "@/components/agenda/AccionesAgenda";
import AgendaForm from "@/components/agenda/AgendaForm";
import { estiloTipo } from "@/components/agenda/estilo";

export const metadata = { title: "Tarea" };

/** Detalle de una tarea, reunión, capacitación o pago (?editar=1 para cambiarla). */
export default async function TareaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ editar?: string }> }) {
  const [{ id }, { editar }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    { data: rol },
  ] = await Promise.all([supabase.auth.getUser(), supabase.rpc("fn_rol")]);
  const yo = user?.id ?? "";
  const q = { yo, gestor: esGestor(rol as string) };
  const item = /^[0-9a-f-]{36}$/i.test(id) ? await unaDeAgenda(supabase, q, id) : null;
  if (!item) notFound();
  const hoy = hoyISO();

  if (editar && item.puedeEditar) {
    const { data: usuarios } = await supabase.from("usuarios").select("id, nombre, rol").eq("activo", true).order("nombre");
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-2xl font-extrabold tracking-tight">Cambiar</h1>
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <AgendaForm
            usuarios={(usuarios ?? []) as { id: string; nombre: string; rol: string }[]}
            yo={yo}
            hoy={hoy}
            editar={{
              id: item.id,
              siguientes: item.siguientes,
              puedeGestionar: item.puedeGestionar,
              valores: {
                titulo: item.titulo,
                tipo: item.tipo as TipoAgenda,
                descripcion: item.descripcion,
                fecha: item.fecha,
                hora: item.hora,
                horaFin: item.hora_fin,
                lugar: item.lugar,
                links: item.links,
                monto: item.monto,
                moneda: item.moneda === "USD" ? "USD" : "ARS",
                avisoDias: item.aviso_dias,
                personas: item.personas.map((p) => p.id),
              },
            }}
          />
        </section>
      </div>
    );
  }

  const estilo = estiloTipo(item.tipo);
  const Icono = estilo.icono;
  const estado = estadoAgenda(item, hoy, item.hechaYo);
  const evento = esEvento(item.tipo);
  const hechas = item.personas.filter((p) => p.hecha_at).length;
  const aviso = AVISOS.find((a) => a.value === item.aviso_dias)?.label ?? `${item.aviso_dias} días antes`;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/tareas" className="text-[15px] font-bold text-marino">
        ← Tareas y agenda
      </Link>

      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-extrabold ${estilo.chip}`}>
            <Icono className="h-4 w-4" /> {nombreTipo(item.tipo)}
          </span>
          {estado === "atrasada" && <span className="rounded-full bg-red-100 px-2.5 py-1 text-[13px] font-extrabold text-red-700">Atrasada</span>}
          {estado === "hecha" && (
            <span className="rounded-full bg-verde-soft px-2.5 py-1 text-[13px] font-extrabold text-verde">{textoHecha(item.tipo)}</span>
          )}
          {item.repite && (
            <span className="inline-flex items-center gap-1 rounded-full bg-crema px-2.5 py-1 text-[13px] font-bold text-piedra">
              <Repeat className="h-3.5 w-3.5" /> {REPETICIONES.find((r) => r.value === item.repite)?.label}
            </span>
          )}
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight">{item.titulo}</h1>
        <p className="text-[17px] font-bold first-letter:uppercase">
          {cuando(item.fecha, hoy)}
          {item.hora ? ` · ${horario(item.hora, item.hora_fin)}` : ""}
        </p>
        {item.tipo === "pago" && item.monto != null && <p className="text-2xl font-extrabold">{dinero(item.monto, item.moneda)}</p>}
        {item.lugar &&
          (esLink(item.lugar) ? (
            <a
              href={item.lugar}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-violeta px-4 text-[15px] font-extrabold text-white"
            >
              <Video className="h-4 w-4" /> Unirse a la videollamada
            </a>
          ) : (
            <p className="flex items-center gap-1.5 text-[15px]">
              <MapPin className="h-4 w-4 text-piedra" /> {item.lugar}
            </p>
          ))}
        {item.descripcion && <p className="whitespace-pre-wrap text-[15px]">{item.descripcion}</p>}
        {item.links.length > 0 && (
          <div className="space-y-1.5">
            {item.links.map((l, i) => (
              <a
                key={i}
                href={l.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-xl border border-borde px-3 py-2 text-[15px] font-bold text-marino hover:bg-celeste-soft"
              >
                <ExternalLink className="h-4 w-4 shrink-0" />
                <span className="min-w-0 truncate">{l.texto || l.url}</span>
              </a>
            ))}
          </div>
        )}
        <p className="flex items-center gap-1.5 text-[14px] text-piedra">
          <Bell className="h-4 w-4" /> Aviso: {item.aviso_dias ? `${aviso} y el mismo día` : "el mismo día"}, 8:30 · Cargada por {item.creador}
        </p>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-piedra">
          {evento ? `Van (${item.personas.length})` : `Quiénes (${hechas} de ${item.personas.length} ${item.tipo === "pago" ? "pagado" : "hechas"})`}
        </h2>
        <ul className="space-y-1.5">
          {item.personas.map((p) => (
            <li key={p.id} className="flex items-center gap-2 text-[15px]">
              {evento ? (
                <Circle className="h-4 w-4 text-piedra/50" />
              ) : p.hecha_at ? (
                <CheckCircle2 className="h-5 w-5 text-verde" />
              ) : (
                <Circle className="h-5 w-5 text-piedra/50" />
              )}
              <span className={p.id === yo ? "font-bold" : ""}>{p.id === yo ? `${p.nombre} (vos)` : p.nombre}</span>
            </li>
          ))}
        </ul>
      </section>

      <AccionesAgenda
        id={item.id}
        tipo={item.tipo}
        fecha={item.fecha}
        hoy={hoy}
        mia={item.mia}
        hechaYo={item.hechaYo}
        puedeEditar={item.puedeEditar}
        puedeGestionar={item.puedeGestionar}
        siguientes={item.siguientes}
        linkGoogle={linkGoogleCalendar(item)}
      />
    </div>
  );
}
