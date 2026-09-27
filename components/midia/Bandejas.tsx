import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Bandeja } from "@/lib/servidor/midia";

const TONO: Record<Bandeja["tono"], string> = {
  rojo: "bg-red-100 text-red-700",
  ambar: "bg-ambar-soft text-ambar",
  azul: "bg-azul-soft text-azul",
  verde: "bg-verde-soft text-verde",
  violeta: "bg-violeta-soft text-violeta",
  gris: "bg-crema-deep text-piedra",
};

/**
 * Las bandejas de "Mi día": lo que le toca al puesto hoy, cada una con sus
 * primeros casos y el link a la pantalla donde se resuelve. Las vacías se
 * juntan en una línea "al día".
 */
export default function Bandejas({ bandejas }: { bandejas: Bandeja[] }) {
  const conTrabajo = bandejas.filter((b) => b.cantidad > 0);
  const alDia = bandejas.filter((b) => b.cantidad === 0);
  return (
    <div className="space-y-3">
      {conTrabajo.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {conTrabajo.map((b) => (
            <section key={b.clave} className="rounded-2xl bg-white p-3.5 shadow-sm">
              <Link href={b.href} className="flex items-start justify-between gap-2">
                <span className="min-w-0">
                  <span className="block text-[16px] font-extrabold leading-tight">{b.titulo}</span>
                  {b.ayuda && <span className="block text-xs text-piedra">{b.ayuda}</span>}
                </span>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-sm font-extrabold ${TONO[b.tono]}`}>{b.cantidad}</span>
              </Link>
              <ul className="mt-2 divide-y divide-borde/60">
                {b.items.map((it) => (
                  <li key={it.id}>
                    <Link href={it.href} className="flex min-h-11 items-center justify-between gap-2 py-1.5">
                      <span className="min-w-0">
                        <span className="block truncate text-[15px] font-bold">{it.titulo}</span>
                        {it.detalle && <span className="block truncate text-xs text-piedra">{it.detalle}</span>}
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-piedra/60" />
                    </Link>
                  </li>
                ))}
              </ul>
              {b.cantidad > b.items.length && (
                <Link href={b.href} className="mt-1 inline-block text-[14px] font-bold text-marino underline">
                  Ver los {b.cantidad}
                </Link>
              )}
            </section>
          ))}
        </div>
      )}
      {alDia.length > 0 && (
        <p className="rounded-2xl bg-white px-4 py-3 text-[14px] text-piedra shadow-sm">
          <span className="font-bold text-verde">Al día:</span> {alDia.map((b) => b.titulo.toLowerCase()).join(" · ")}
        </p>
      )}
    </div>
  );
}
