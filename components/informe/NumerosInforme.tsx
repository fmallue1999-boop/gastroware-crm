import { textoMontos } from "@/lib/dinero";
import { ETAPAS } from "@/lib/constants";
import type { NumerosInforme as Numeros } from "@/lib/semana";

/** Los números de la semana del vendedor (los pone el CRM). */
export default function NumerosInforme({ n }: { n: Numeros }) {
  const celda = "rounded-xl bg-crema px-3 py-2";
  const etiqueta = "text-[11px] font-bold uppercase tracking-wide text-piedra";
  const valor = "text-xl font-extrabold";
  const etapas = Object.entries(n.abiertosPorEtapa ?? {})
    .map(([e, c]) => `${ETAPAS.find((x) => x.value === e)?.label ?? e}: ${c}`)
    .join(" · ");
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className={celda}>
          <p className={etiqueta}>Consultas nuevas</p>
          <p className={valor}>{n.consultasNuevas}</p>
        </div>
        <div className={celda}>
          <p className={etiqueta}>Propuestas</p>
          <p className={valor}>{n.cotizaciones}</p>
        </div>
        <div className={celda}>
          <p className={etiqueta}>Ventas</p>
          <p className={valor}>{n.ventas}</p>
          <p className="truncate text-xs text-piedra">{Object.keys(n.montoVentas ?? {}).length ? textoMontos(n.montoVentas) : "—"}</p>
        </div>
        <div className={celda}>
          <p className={etiqueta}>Movimientos</p>
          <p className={valor}>{n.movimientos}</p>
        </div>
      </div>
      <p className="text-[14px] text-tinta/80">
        Abiertos: {etapas || "ninguno"} · No se dio: {n.perdidas} · Casos abiertos: {n.casosAbiertos} (cerrados en la semana: {n.casosCerrados})
        {n.sinPrimerContacto ? ` · ${n.sinPrimerContacto} consultas sin primer contacto` : ""}
      </p>
    </div>
  );
}
