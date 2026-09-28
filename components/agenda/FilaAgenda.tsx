"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Repeat, Video } from "lucide-react";
import { marcarAgenda } from "@/lib/actions";
import { esEvento, esLink, estadoAgenda, horario, nombreTipo, textoFaltan, textoHecha } from "@/lib/agenda";
import { dinero, fechaCorta } from "@/lib/format";
import type { ItemAgenda } from "@/lib/servidor/agenda";
import { estiloTipo } from "@/components/agenda/estilo";

/**
 * Un renglón de la agenda: tildar hecha (o pagado), a qué hora, con quién,
 * el monto de un pago y el link de la reunión. Tocar el título abre el detalle.
 */
export default function FilaAgenda({
  item,
  hoy,
  verFecha = false,
  progreso = false,
}: {
  item: ItemAgenda;
  hoy: string;
  /** Mostrar la fecha (en listas que mezclan días). */
  verFecha?: boolean;
  /** Mostrar cuántos la terminaron (para lo que asigné). */
  progreso?: boolean;
}) {
  const router = useRouter();
  const [hecha, setHecha] = useState(item.hechaYo);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const estilo = estiloTipo(item.tipo);
  const Icono = estilo.icono;
  const estado = estadoAgenda(item, hoy, hecha);
  const tilde = item.mia && !esEvento(item.tipo);

  function alternar() {
    const nuevo = !hecha;
    setHecha(nuevo);
    setError(null);
    startTransition(async () => {
      const r = await marcarAgenda(item.id, nuevo);
      if (r && "error" in r && r.error) {
        setHecha(!nuevo);
        setError(r.error);
      } else router.refresh();
    });
  }

  const conQuien =
    item.personas.length > 1 || !item.mia
      ? item.personas.length <= 3
        ? item.personas.map((p) => p.nombre.split(" ")[0]).join(", ")
        : `${item.personas.length} personas`
      : null;
  const hechas = item.personas.filter((p) => p.hecha_at).length;

  const detalle = [
    verFecha || estado === "atrasada" ? (estado === "atrasada" ? `Era para el ${fechaCorta(item.fecha)}` : fechaCorta(item.fecha)) : null,
    estado === "aviso" ? `${textoFaltan(item.fecha, hoy)} (${fechaCorta(item.fecha)})` : null,
    item.tipo === "pago" && item.monto != null ? dinero(item.monto, item.moneda) : null,
    conQuien ? `Con ${conQuien}` : null,
    progreso && !esEvento(item.tipo) && item.personas.length ? `${hechas} de ${item.personas.length} ${item.tipo === "pago" ? "pagado" : "hechas"}` : null,
  ].filter(Boolean);

  return (
    <div className={`flex items-start gap-3 rounded-2xl bg-white p-3 shadow-sm ${hecha ? "opacity-60" : ""}`}>
      {tilde ? (
        <button
          type="button"
          onClick={alternar}
          disabled={pending}
          aria-label={hecha ? "Volver a pendiente" : `Marcar ${textoHecha(item.tipo).toLowerCase()}`}
          title={hecha ? "Volver a pendiente" : textoHecha(item.tipo)}
          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${
            hecha ? "border-verde bg-verde text-white" : estado === "atrasada" ? "border-red-400" : "border-borde hover:border-verde"
          }`}
        >
          {hecha && <Check className="h-4 w-4" strokeWidth={3} />}
        </button>
      ) : (
        <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${estilo.chip}`}>
          <Icono className="h-4 w-4" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          {item.hora && <span className="text-[15px] font-extrabold tabular-nums">{horario(item.hora, item.hora_fin)}</span>}
          <Link href={`/tareas/${item.id}`} className={`min-w-0 text-[16px] font-bold hover:underline ${hecha ? "line-through" : ""}`}>
            {item.titulo}
          </Link>
        </div>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[14px] text-piedra">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${estilo.chip}`}>
            {tilde && <Icono className="h-3 w-3" />}
            {nombreTipo(item.tipo)}
          </span>
          {item.repite && <Repeat className="h-3.5 w-3.5" aria-label="Se repite" />}
          {detalle.map((d, i) => (
            <span key={i} className={i === 0 && estado === "atrasada" ? "font-bold text-red-600" : ""}>
              {d}
            </span>
          ))}
        </p>
        {error && <p className="text-[14px] font-bold text-red-600">{error}</p>}
      </div>
      {esLink(item.lugar) && !hecha && (
        <a
          href={item.lugar!}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-xl bg-violeta px-3 text-[14px] font-bold text-white"
        >
          <Video className="h-4 w-4" /> Unirse
        </a>
      )}
    </div>
  );
}
