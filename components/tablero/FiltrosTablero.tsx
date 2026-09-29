"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const sel =
  "min-h-11 rounded-xl border border-borde bg-white px-3 text-[15px] font-bold text-tinta outline-none focus:border-marino disabled:opacity-60";

/** Apartado, período, vendedor y producto del tablero: desplegables que cambian la URL. */
export default function FiltrosTablero({
  periodos,
  vendedores,
  productos,
}: {
  periodos: { key: string; label: string }[];
  vendedores: { id: string; nombre: string }[];
  productos: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function cambiar(clave: string, valor: string) {
    const p = new URLSearchParams(params.toString());
    if (valor) p.set(clave, valor);
    else p.delete(clave);
    p.delete("ver");
    p.delete("vv");
    const q = p.toString();
    startTransition(() => router.push(q ? `${pathname}?${q}` : pathname));
  }

  return (
    <div className="flex flex-wrap gap-2">
      <select aria-label="Apartado" value={params.get("l") ?? ""} disabled={pending} onChange={(e) => cambiar("l", e.target.value)} className={sel}>
        <option value="">Consolidado (todo)</option>
        <option value="equipos">Venta de equipos</option>
        <option value="consumibles">Consumibles</option>
        <option value="repuestos">Repuestos</option>
      </select>
      <select aria-label="Período" value={params.get("p") ?? "mes"} disabled={pending} onChange={(e) => cambiar("p", e.target.value === "mes" ? "" : e.target.value)} className={sel}>
        {periodos.map((p) => (
          <option key={p.key} value={p.key}>
            {p.label}
          </option>
        ))}
      </select>
      <select aria-label="Vendedor" value={params.get("v") ?? ""} disabled={pending} onChange={(e) => cambiar("v", e.target.value)} className={sel}>
        <option value="">Todos los vendedores</option>
        {vendedores.map((v) => (
          <option key={v.id} value={v.id}>
            {v.nombre}
          </option>
        ))}
        <option value="sin">Sin asignar</option>
      </select>
      <select aria-label="Producto" value={params.get("prod") ?? ""} disabled={pending} onChange={(e) => cambiar("prod", e.target.value)} className={`${sel} max-w-full`}>
        <option value="">Todos los productos</option>
        {productos.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nombre}
          </option>
        ))}
      </select>
      {pending && <span className="self-center text-sm text-piedra">Actualizando…</span>}
    </div>
  );
}
