import { Sparkles } from "lucide-react";
import { VERSIONES, versionCorta } from "@/lib/novedades";

export const metadata = { title: "Novedades" };

/** Qué cambió en cada versión de GastroWare OS. */
export default function NovedadesPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <Sparkles className="h-6 w-6 text-marino" /> Novedades
        </h1>
        <p className="text-[15px] text-piedra">Qué cambió en cada versión de GastroWare OS. La más nueva, arriba.</p>
      </div>
      {VERSIONES.map((v, i) => (
        <section key={v.version} className={`rounded-2xl p-5 shadow-sm ${i === 0 ? "bg-marino text-white" : "bg-white"}`}>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className={`rounded-md px-2 py-0.5 text-[14px] font-extrabold ${i === 0 ? "bg-celeste text-marino" : "bg-crema text-tinta"}`}>
              {versionCorta(v.version)}
            </span>
            <h2 className="text-lg font-extrabold">{v.titulo}</h2>
            <span className={`text-[14px] ${i === 0 ? "text-white/70" : "text-piedra"}`}>
              {new Date(v.fecha + "T12:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}
              {i === 0 ? " · versión actual" : ""}
            </span>
          </div>
          <ul className="mt-3 space-y-1.5">
            {v.cambios.map((c) => (
              <li key={c} className="flex gap-2 text-[15px]">
                <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${i === 0 ? "bg-celeste" : "bg-marino"}`} />
                {c}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
