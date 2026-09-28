import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { horaCorta, masMeses, nombreMes, semanasDelMes } from "@/lib/agenda";
import { estiloTipo } from "@/components/agenda/estilo";

/** Lo mínimo para mostrar algo en el calendario (tareas, reposiciones). */
export type ItemCalendario = { id: string; fecha: string; titulo: string; hora: string | null; tipo: string; hechaYo: boolean };

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/** Calendario del mes: cada día muestra lo que hay; tocar un día muestra su lista abajo. */
export default function CalendarioMes({
  mes,
  hoy,
  diaElegido,
  items,
  href,
}: {
  /** Cualquier fecha del mes (YYYY-MM-DD). */
  mes: string;
  hoy: string;
  diaElegido: string | null;
  items: ItemCalendario[];
  /** Arma el link conservando los filtros: href({ mes, dia }). */
  href: (p: { mes?: string; dia?: string }) => string;
}) {
  const semanas = semanasDelMes(mes);
  const delMes = mes.slice(0, 7);
  const porDia = new Map<string, ItemCalendario[]>();
  for (const i of items) porDia.set(i.fecha, [...(porDia.get(i.fecha) ?? []), i]);

  return (
    <section className="rounded-2xl bg-white p-2 shadow-sm sm:p-3">
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <Link href={href({ mes: masMeses(`${delMes}-01`, -1).slice(0, 7) })} aria-label="Mes anterior" className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-crema">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <p className="text-[17px] font-extrabold capitalize">{nombreMes(`${delMes}-01`)}</p>
        <div className="flex items-center gap-1">
          {delMes !== hoy.slice(0, 7) && (
            <Link href={href({ mes: hoy.slice(0, 7), dia: hoy })} className="rounded-xl px-2.5 py-1.5 text-[14px] font-bold text-marino hover:bg-crema">
              Hoy
            </Link>
          )}
          <Link href={href({ mes: masMeses(`${delMes}-01`, 1).slice(0, 7) })} aria-label="Mes siguiente" className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-crema">
            <ChevronRight className="h-5 w-5" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-borde bg-borde text-center">
        {DIAS.map((d) => (
          <div key={d} className="bg-crema py-1 text-xs font-bold uppercase tracking-wide text-piedra">
            {d}
          </div>
        ))}
        {semanas.flat().map((d) => {
          const lista = porDia.get(d) ?? [];
          const fuera = d.slice(0, 7) !== delMes;
          const esHoy = d === hoy;
          const elegido = d === diaElegido;
          return (
            <Link
              key={d}
              href={href({ mes: delMes, dia: d })}
              className={`flex min-h-14 flex-col items-stretch gap-0.5 bg-white p-1 text-left hover:bg-celeste-soft sm:min-h-24 ${fuera ? "bg-white/60 text-piedra/60" : ""} ${
                elegido ? "ring-2 ring-inset ring-marino" : ""
              }`}
            >
              <span
                className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full text-[13px] font-bold sm:mx-0 ${
                  esHoy ? "bg-marino text-white" : ""
                }`}
              >
                {Number(d.slice(8))}
              </span>
              {/* Celular: puntitos */}
              {lista.length > 0 && (
                <span className="flex flex-wrap justify-center gap-0.5 sm:hidden">
                  {lista.slice(0, 4).map((i) => (
                    <span key={i.id} className={`h-1.5 w-1.5 rounded-full ${estiloTipo(i.tipo).punto} ${i.hechaYo ? "opacity-40" : ""}`} />
                  ))}
                </span>
              )}
              {/* Computadora: títulos */}
              {lista.slice(0, 3).map((i) => (
                <span
                  key={i.id}
                  className={`hidden truncate rounded px-1 text-[12px] font-bold sm:block ${estiloTipo(i.tipo).chip} ${i.hechaYo ? "line-through opacity-50" : ""}`}
                >
                  {i.hora ? `${horaCorta(i.hora)} ` : ""}
                  {i.titulo}
                </span>
              ))}
              {lista.length > 3 && <span className="hidden text-[12px] font-bold text-piedra sm:block">+{lista.length - 3} más</span>}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
