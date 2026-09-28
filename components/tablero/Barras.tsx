import type { Barra } from "@/lib/tablero";

/**
 * Barras horizontales de una sola serie (sin leyenda: el título la nombra).
 * El número va al lado de cada barra, así la tabla y el gráfico son lo mismo.
 */
export default function Barras({
  titulo,
  datos,
  vacio = "Nada en este período.",
  tope = 8,
}: {
  titulo: string;
  datos: Barra[];
  vacio?: string;
  tope?: number;
}) {
  const max = Math.max(1, ...datos.map((d) => d.valor));
  const visibles = datos.slice(0, tope);
  const resto = datos.slice(tope).reduce((s, d) => s + d.valor, 0);
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-[15px] font-extrabold">{titulo}</h3>
      {datos.length === 0 ? (
        <p className="text-[15px] text-piedra">{vacio}</p>
      ) : (
        <div className="space-y-2.5">
          {visibles.map((d) => (
            <div key={d.nombre} title={`${d.nombre}: ${d.valor}${d.detalle ? ` · ${d.detalle}` : ""}`}>
              <div className="flex items-baseline justify-between gap-2 text-[14px]">
                <span className="min-w-0 truncate">{d.nombre}</span>
                <span className="shrink-0 tabular-nums">
                  <b>{d.valor}</b>
                  {d.detalle ? <span className="text-piedra"> · {d.detalle}</span> : null}
                </span>
              </div>
              <div className="mt-1 h-2 rounded-r bg-crema-deep/60">
                <div className="h-2 rounded-r bg-azul" style={{ width: `${Math.max(2, (d.valor / max) * 100)}%` }} />
              </div>
            </div>
          ))}
          {resto > 0 && <p className="text-xs text-piedra">Y {resto} más en otros.</p>}
        </div>
      )}
    </section>
  );
}
