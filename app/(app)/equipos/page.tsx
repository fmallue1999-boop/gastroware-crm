import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fechaCorta, hoyISO } from "@/lib/format";
import type { Equipo } from "@/lib/types";

const inputCls =
  "rounded-2xl border border-borde bg-white shadow-sm px-3 py-2.5 text-sm outline-none focus:border-tinta";

const ESTADOS_EQUIPO: Record<string, { label: string; cls: string }> = {
  activo: { label: "Activo", cls: "bg-green-100 text-green-700" },
  en_reparacion: { label: "En reparación", cls: "bg-amber-100 text-amber-800" },
  baja: { label: "De baja", cls: "bg-crema-deep text-piedra" },
};

export default async function EquiposPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string; origen?: string }>;
}) {
  const { q, estado, origen } = await searchParams;
  const hoy = hoyISO();
  const supabase = await createClient();

  let query = supabase
    .from("equipos")
    .select(
      "*, cliente:clientes(id, nombre_comercial), producto:productos(nombre), modelo:modelos(marca, nombre)"
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(300);
  if (q) query = query.or(`numero_serie.ilike.%${q}%,marca_modelo_libre.ilike.%${q}%`);
  if (estado) query = query.eq("estado", estado);
  if (origen) query = query.eq("origen", origen);

  const { data } = await query;
  let equipos = (data ?? []) as unknown as Equipo[];

  // Si la búsqueda no encontró por serie/modelo, buscar también por nombre de cliente
  if (q && equipos.length === 0) {
    const { data: porCliente } = await supabase
      .from("equipos")
      .select(
        "*, cliente:clientes!inner(id, nombre_comercial), producto:productos(nombre), modelo:modelos(marca, nombre)"
      )
      .is("deleted_at", null)
      .ilike("cliente.nombre_comercial", `%${q}%`)
      .limit(100);
    equipos = (porCliente ?? []) as unknown as Equipo[];
  }

  const nombreEquipo = (e: Equipo) =>
    e.producto?.nombre ??
    (e.modelo ? `${e.modelo.marca} ${e.modelo.nombre}` : null) ??
    e.marca_modelo_libre ??
    "Equipo";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">
          Equipos{" "}
          <span className="text-base font-medium text-piedra">
            ({equipos.length})
          </span>
        </h1>
      </div>

      <form className="mb-4 flex flex-wrap gap-2" method="get">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por serie, modelo o cliente"
          className={`${inputCls} min-w-48 flex-1`}
        />
        <select name="estado" defaultValue={estado ?? ""} className={inputCls}>
          <option value="">Todos los estados</option>
          <option value="activo">Activos</option>
          <option value="en_reparacion">En reparación</option>
          <option value="baja">De baja</option>
        </select>
        <select name="origen" defaultValue={origen ?? ""} className={inputCls}>
          <option value="">Todos</option>
          <option value="vendido">Vendidos por GastroWare</option>
          <option value="externo">De otra marca</option>
        </select>
        <button className="rounded-2xl bg-tinta px-4 py-2.5 text-sm text-white">
          Filtrar
        </button>
      </form>

      {equipos.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-borde p-6 text-center text-sm text-piedra">
          Sin equipos. Se cargan desde la ficha de cada cliente.
        </p>
      ) : (
        <>
          {/* Tabla escritorio */}
          <div className="hidden overflow-hidden rounded-2xl border border-borde bg-white shadow-sm lg:block">
            <table className="w-full text-sm">
              <thead className="border-b border-borde bg-crema/60">
                <tr>
                  {["Equipo", "Serie", "Cliente", "Estado", "Garantía", "Alta"].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-piedra"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {equipos.map((e) => {
                  const est = ESTADOS_EQUIPO[e.estado] ?? ESTADOS_EQUIPO.activo;
                  const vigente = e.garantia_hasta && e.garantia_hasta >= hoy;
                  return (
                    <tr
                      key={e.id}
                      className="border-b border-borde/60 transition-colors last:border-0 hover:bg-crema/50"
                    >
                      <td className="px-3 py-2.5">
                        <Link
                          href={`/equipos/${e.id}`}
                          className="font-medium hover:underline"
                        >
                          {nombreEquipo(e)}
                        </Link>
                        {e.origen === "externo" && (
                          <span className="ml-1.5 rounded-full border border-borde px-2 py-0.5 text-xs text-piedra">
                            otra marca
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-piedra">
                        {e.numero_serie ?? "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        {e.cliente ? (
                          <Link
                            href={`/clientes/${e.cliente.id}`}
                            className="text-piedra hover:underline"
                          >
                            {e.cliente.nombre_comercial}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${est.cls}`}
                        >
                          {est.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        {e.garantia_hasta ? (
                          <span className={vigente ? "text-green-700" : "text-red-600"}>
                            {vigente ? "Vigente" : "Vencida"} ·{" "}
                            {fechaCorta(e.garantia_hasta)}
                          </span>
                        ) : (
                          <span className="text-piedra">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-piedra">
                        {fechaCorta(e.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Tarjetas mobile */}
          <div className="space-y-2 lg:hidden">
            {equipos.map((e) => {
              const est = ESTADOS_EQUIPO[e.estado] ?? ESTADOS_EQUIPO.activo;
              return (
                <Link
                  key={e.id}
                  href={`/equipos/${e.id}`}
                  className="block rounded-2xl border border-borde bg-white p-3 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{nombreEquipo(e)}</p>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${est.cls}`}
                    >
                      {est.label}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-piedra">
                    {e.numero_serie ? `Serie ${e.numero_serie} · ` : ""}
                    {e.cliente?.nombre_comercial ?? ""}
                  </p>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
