import Link from "next/link";
import { ArrowUpDown, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { RUBROS } from "@/lib/constants";
import { fechaCorta } from "@/lib/format";
import type { Cliente } from "@/lib/types";

const inputCls =
  "rounded-2xl border border-borde bg-white shadow-sm px-3 py-2.5 text-sm outline-none focus:border-tinta";

const ORDENES: Record<string, { col: string; asc: boolean }> = {
  reciente: { col: "created_at", asc: false },
  nombre: { col: "nombre_comercial", asc: true },
  rubro: { col: "rubro", asc: true },
  estado: { col: "estado", asc: true },
};

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; rubro?: string; estado?: string; orden?: string }>;
}) {
  const { q, rubro, estado, orden } = await searchParams;
  const ord = ORDENES[orden ?? "reciente"] ?? ORDENES.reciente;
  const supabase = await createClient();

  let query = supabase
    .from("clientes")
    .select("*, sucursales(ciudad, es_principal)")
    .is("deleted_at", null)
    .order(ord.col, { ascending: ord.asc })
    .limit(300);

  if (q) query = query.or(`nombre_comercial.ilike.%${q}%,telefono.ilike.%${q}%`);
  if (rubro) query = query.eq("rubro", rubro);
  if (estado) query = query.eq("estado", estado);

  const { data } = await query;
  type Fila = Cliente & {
    sucursales?: { ciudad: string | null; es_principal: boolean }[];
  };
  const clientes = ((data ?? []) as Fila[]).map(({ sucursales, ...c }) => {
    const principal =
      (sucursales ?? []).find((s) => s.es_principal) ?? (sucursales ?? [])[0];
    return { ...c, ciudad: principal?.ciudad ?? null } as Cliente;
  });

  const linkOrden = (o: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (rubro) p.set("rubro", rubro);
    if (estado) p.set("estado", estado);
    p.set("orden", o);
    return `/clientes?${p.toString()}`;
  };

  const Th = ({ campo, children }: { campo: string; children: React.ReactNode }) => (
    <th className="px-3 py-2.5 text-left">
      <Link
        href={linkOrden(campo)}
        className={`inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide ${
          (orden ?? "reciente") === campo ? "text-tinta" : "text-piedra"
        }`}
      >
        {children}
        <ArrowUpDown className="h-3 w-3" />
      </Link>
    </th>
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">
          Clientes{" "}
          <span className="text-base font-medium text-piedra">
            ({clientes.length})
          </span>
        </h1>
        <a
          href="/api/export?tipo=clientes"
          className="inline-flex items-center gap-1.5 rounded-xl border border-borde bg-white px-3.5 py-2 text-sm shadow-sm"
        >
          <Download className="h-4 w-4" /> Exportar CSV
        </a>
      </div>

      <form className="mb-4 flex flex-wrap gap-2" method="get">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar nombre o teléfono"
          className={`${inputCls} min-w-40 flex-1`}
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
        <p className="rounded-2xl border border-dashed border-borde p-6 text-center text-sm text-piedra">
          Sin resultados.
        </p>
      ) : (
        <>
          {/* Tabla de escritorio */}
          <div className="hidden overflow-hidden rounded-2xl border border-borde bg-white shadow-sm lg:block">
            <table className="w-full text-sm">
              <thead className="border-b border-borde bg-crema/60">
                <tr>
                  <Th campo="nombre">Nombre</Th>
                  <Th campo="rubro">Rubro</Th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-piedra">
                    Ciudad
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-piedra">
                    Teléfono
                  </th>
                  <Th campo="estado">Estado</Th>
                  <Th campo="reciente">Alta</Th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-borde/60 transition-colors last:border-0 hover:bg-crema/50"
                  >
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/clientes/${c.id}`}
                        className="font-medium hover:underline"
                      >
                        {c.nombre_comercial}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-piedra">{c.rubro}</td>
                    <td className="px-3 py-2.5 text-piedra">{c.ciudad ?? "—"}</td>
                    <td className="px-3 py-2.5 text-piedra">{c.telefono ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      {c.estado === "cliente_activo" ? (
                        <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                          Cliente
                        </span>
                      ) : c.estado === "inactivo" ? (
                        <span className="rounded-full bg-crema-deep px-2.5 py-0.5 text-xs text-piedra">
                          Inactivo
                        </span>
                      ) : (
                        <span className="rounded-full bg-celeste-soft px-2.5 py-0.5 text-xs font-medium text-sky-800">
                          Prospecto
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-piedra">
                      {fechaCorta(c.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tarjetas mobile */}
          <div className="space-y-2 lg:hidden">
            {clientes.map((c) => (
              <Link
                key={c.id}
                href={`/clientes/${c.id}`}
                className="block rounded-2xl border border-borde bg-white p-3 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">
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
        </>
      )}
    </div>
  );
}
