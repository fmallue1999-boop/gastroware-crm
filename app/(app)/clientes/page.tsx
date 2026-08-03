import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { RUBROS } from "@/lib/constants";
import type { Cliente } from "@/lib/types";

const inputCls =
  "rounded-2xl border border-borde bg-white shadow-sm px-3 py-2.5 text-sm outline-none focus:border-tinta";

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; rubro?: string; estado?: string }>;
}) {
  const { q, rubro, estado } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("clientes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (q) query = query.or(`nombre_comercial.ilike.%${q}%,telefono.ilike.%${q}%`);
  if (rubro) query = query.eq("rubro", rubro);
  if (estado) query = query.eq("estado", estado);

  const { data } = await query;
  const clientes = (data ?? []) as Cliente[];

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-4">Clientes</h1>

      <form className="flex flex-wrap gap-2 mb-4" method="get">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar nombre o teléfono"
          className={`${inputCls} flex-1 min-w-40`}
        />
        <select name="rubro" defaultValue={rubro ?? ""} className={inputCls}>
          <option value="">Todos los rubros</option>
          {RUBROS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select name="estado" defaultValue={estado ?? ""} className={inputCls}>
          <option value="">Todos</option>
          <option value="prospecto">Prospectos</option>
          <option value="cliente_activo">Clientes activos</option>
          <option value="inactivo">Inactivos</option>
        </select>
        <button className="rounded-2xl bg-tinta px-4 py-2.5 text-sm text-white">
          Filtrar
        </button>
      </form>

      {clientes.length === 0 ? (
        <p className="text-sm text-piedra/80 rounded-2xl border border-dashed border-borde p-6 text-center">
          Sin resultados. Cargá el primero con el botón central.
        </p>
      ) : (
        <div className="space-y-2">
          {clientes.map((c) => (
            <Link
              key={c.id}
              href={`/clientes/${c.id}`}
              className="block rounded-2xl border border-borde bg-white shadow-sm p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-sm truncate">
                  {c.nombre_comercial}
                </p>
                {c.estado === "cliente_activo" && (
                  <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                    Cliente
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-piedra">
                {c.rubro}
                {c.ciudad ? ` · ${c.ciudad}` : ""}
                {c.telefono ? ` · ${c.telefono}` : ""}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
