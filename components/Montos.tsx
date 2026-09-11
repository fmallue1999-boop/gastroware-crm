import { dinero } from "@/lib/format";
import { ordenarMonedas } from "@/lib/dinero";

/**
 * Muestra totales por moneda sin mezclarlas: una línea por moneda
 * (o en una sola línea separadas por "·" con `inline`).
 */
export default function Montos({
  por,
  inline = false,
}: {
  por: Record<string, number>;
  inline?: boolean;
}) {
  const partes = ordenarMonedas(por);
  if (partes.length === 0) return <span>{dinero(0)}</span>;
  if (inline)
    return (
      <span>
        {partes.map(([m, n], i) => (
          <span key={m}>
            {i > 0 ? " · " : ""}
            {dinero(n, m)}
          </span>
        ))}
      </span>
    );
  return (
    <span className="flex flex-col">
      {partes.map(([m, n]) => (
        <span key={m}>{dinero(n, m)}</span>
      ))}
    </span>
  );
}
