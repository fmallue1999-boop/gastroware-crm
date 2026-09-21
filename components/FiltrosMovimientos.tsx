"use client";

import { useRouter, useSearchParams } from "next/navigation";

const chip = (activo: boolean) =>
  `min-h-11 shrink-0 rounded-full px-3.5 py-2 text-[15px] font-medium ${
    activo ? "bg-marino text-white" : "border border-borde bg-white text-piedra"
  }`;

export const TIPOS_MOVIMIENTO = [
  { key: "interes", label: "Intereses" },
  { key: "cotizacion", label: "Cotizaciones" },
  { key: "venta", label: "Ventas" },
  { key: "service", label: "Services" },
  { key: "nota", label: "Notas" },
] as const;

/**
 * Filtros de Movimientos: Míos / De todos / Por vendedor / Por técnico
 * (gestores) y por tipo. Todo va por la URL, así se puede compartir.
 */
export default function FiltrosMovimientos({
  esGestor,
  vendedores,
  tecnicos,
}: {
  esGestor: boolean;
  vendedores: { id: string; nombre: string }[];
  tecnicos: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const quien = params.get("quien") ?? "todos";
  const tipo = params.get("tipo") ?? "";
  const esVendedor = vendedores.some((v) => v.id === quien);
  const esTecnico = tecnicos.some((t) => t.id === quien);

  function ir(cambios: Record<string, string>) {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(cambios)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    const q = p.toString();
    router.push(q ? `/movimientos?${q}` : "/movimientos");
  }

  return (
    <div className="space-y-2">
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
        <button type="button" onClick={() => ir({ quien: "yo" })} className={chip(quien === "yo")}>
          Míos
        </button>
        <button type="button" onClick={() => ir({ quien: "" })} className={chip(quien === "todos")}>
          De todos
        </button>
        {esGestor && (
          <>
            <select
              value={esVendedor ? quien : ""}
              onChange={(e) => e.target.value && ir({ quien: e.target.value })}
              aria-label="Por vendedor"
              className={`${chip(esVendedor)} appearance-none pr-6`}
            >
              <option value="">Por vendedor…</option>
              {vendedores.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nombre}
                </option>
              ))}
            </select>
            <select
              value={esTecnico ? quien : ""}
              onChange={(e) => e.target.value && ir({ quien: e.target.value })}
              aria-label="Por técnico"
              className={`${chip(esTecnico)} appearance-none pr-6`}
            >
              <option value="">Por técnico…</option>
              {tecnicos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </>
        )}
      </div>
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
        <button type="button" onClick={() => ir({ tipo: "" })} className={chip(!tipo)}>
          Todo
        </button>
        {TIPOS_MOVIMIENTO.map((t) => (
          <button key={t.key} type="button" onClick={() => ir({ tipo: t.key })} className={chip(tipo === t.key)}>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
