import Link from "next/link";
import { HardHat, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { dinero, fechaCorta, telefonoProlijo } from "@/lib/format";
import { ESTADOS_OT } from "@/lib/constants";
import type { OrdenTrabajo } from "@/lib/types";

type Gasto = {
  ot_id: string;
  descripcion: string;
  cantidad: number;
  precio_unit: number;
  estado: string;
};

/**
 * Tablero de instalaciones: todas las órdenes tipo "instalación" con sus
 * gastos (flete, materiales), el equipo con su serie y el estado del cobro.
 */
export default async function InstalacionesPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("ordenes_trabajo")
    .select(
      "*, cliente:clientes(*), equipo:equipos(id, numero_serie, fecha_instalacion, marca_modelo_libre, producto:productos(nombre)), tecnico:usuarios!ordenes_trabajo_tecnico_id_fkey(id, nombre)"
    )
    .eq("tipo", "instalacion")
    .order("created_at", { ascending: false })
    .limit(200);

  const ots = (data ?? []) as unknown as (OrdenTrabajo & {
    equipo?: {
      id: string;
      numero_serie: string | null;
      fecha_instalacion: string | null;
      marca_modelo_libre: string | null;
      producto?: { nombre: string } | null;
    } | null;
  })[];

  // Gastos/presupuestos cargados en cada instalación
  const ids = ots.map((o) => o.id);
  const { data: itemsData } = ids.length
    ? await supabase
        .from("ot_items")
        .select("ot_id, descripcion, cantidad, precio_unit, estado")
        .in("ot_id", ids)
    : { data: [] };
  const gastosPorOT = new Map<string, Gasto[]>();
  for (const g of (itemsData ?? []) as Gasto[]) {
    const lista = gastosPorOT.get(g.ot_id) ?? [];
    lista.push(g);
    gastosPorOT.set(g.ot_id, lista);
  }

  const enCurso = ots.filter((o) => !o.cerrada_tecnico_at);
  const porCobrar = ots.filter((o) => o.cerrada_tecnico_at && !o.facturada_at);
  const cobradas = ots.filter((o) => !!o.facturada_at);

  const columnas: { titulo: string; items: typeof ots; vacio: string }[] = [
    {
      titulo: `En curso (${enCurso.length})`,
      items: enCurso,
      vacio: "Nada en curso.",
    },
    {
      titulo: `Instaladas — por cobrar (${porCobrar.length})`,
      items: porCobrar,
      vacio: "Ninguna esperando cobro.",
    },
    {
      titulo: `Cobradas (${cobradas.length})`,
      items: cobradas,
      vacio: "Todavía no hay cobradas.",
    },
  ];

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">
          Instalaciones{" "}
          <span className="text-base font-medium text-piedra">
            ({ots.length})
          </span>
        </h1>
        <Link
          href="/servicio/nueva?tipo=instalacion"
          className="inline-flex items-center gap-1.5 rounded-xl bg-tinta px-3.5 py-2 text-sm font-medium text-white shadow-sm"
        >
          <Plus className="h-4 w-4" /> Nueva instalación
        </Link>
      </div>
      <p className="mb-4 text-sm text-piedra">
        Cada instalación lleva su equipo con serie, los gastos (flete,
        materiales) y el circuito de cobro. Los gastos se cargan dentro de la
        orden.
      </p>

      {ots.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-borde p-8 text-center text-sm text-piedra">
          <HardHat className="mx-auto mb-2 h-6 w-6" />
          Sin instalaciones todavía. Creá la primera con el botón de arriba:
          elegís el cliente, le cargás el equipo (ej: Rational iCombi Pro) y
          adentro anotás flete y materiales.
        </div>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4">
          <div className="flex gap-3 pb-2" style={{ minWidth: "max-content" }}>
            {columnas.map((col) => (
              <div key={col.titulo} className="w-80 shrink-0">
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-piedra">
                  {col.titulo}
                </h2>
                <div className="space-y-2">
                  {col.items.map((o) => {
                    const gastos = gastosPorOT.get(o.id) ?? [];
                    const totalGastos = gastos.reduce(
                      (s, g) => s + Number(g.cantidad) * Number(g.precio_unit),
                      0
                    );
                    const est = ESTADOS_OT.find((e) => e.value === o.estado);
                    const nombreEquipo =
                      o.equipo?.producto?.nombre ??
                      o.equipo?.marca_modelo_libre ??
                      "Equipo sin asignar";
                    return (
                      <Link
                        key={o.id}
                        href={`/servicio/${o.id}`}
                        className="block rounded-2xl border border-borde bg-white p-3 shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold">
                            {o.cliente?.nombre_comercial}
                          </p>
                          <span className="shrink-0 text-xs text-piedra">
                            OT-{o.numero}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-tinta/80">
                          {nombreEquipo}
                          {o.equipo?.numero_serie ? (
                            <span className="text-piedra">
                              {" "}
                              · Serie {o.equipo.numero_serie}
                            </span>
                          ) : (
                            <span className="font-medium text-amber-700">
                              {" "}
                              · falta serie
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 text-xs text-piedra">
                          {o.equipo?.fecha_instalacion
                            ? `Instalado ${fechaCorta(o.equipo.fecha_instalacion)}`
                            : o.fecha_programada
                              ? `Programada ${fechaCorta(o.fecha_programada)}`
                              : "Sin fecha"}
                          {o.tecnico?.nombre ? ` · ${o.tecnico.nombre}` : ""}
                          {o.cliente?.telefono
                            ? ` · ${telefonoProlijo(o.cliente.telefono)}`
                            : ""}
                        </p>

                        {gastos.length > 0 && (
                          <div className="mt-1.5 rounded-lg bg-crema/70 px-2 py-1.5 text-xs">
                            {gastos.slice(0, 3).map((g, i) => (
                              <p key={i} className="flex justify-between gap-2">
                                <span className="truncate text-piedra">
                                  {g.descripcion}
                                </span>
                                <span className="shrink-0">
                                  {dinero(
                                    Number(g.cantidad) * Number(g.precio_unit)
                                  )}
                                </span>
                              </p>
                            ))}
                            {gastos.length > 3 && (
                              <p className="text-piedra">
                                +{gastos.length - 3} más…
                              </p>
                            )}
                            <p className="mt-0.5 flex justify-between gap-2 border-t border-borde/60 pt-0.5 font-semibold">
                              <span>Gastos</span>
                              <span>{dinero(totalGastos)}</span>
                            </p>
                          </div>
                        )}

                        <div className="mt-1.5 flex items-center justify-between gap-2">
                          <span className="rounded-full bg-celeste-soft px-2 py-0.5 text-[11px] font-medium text-sky-800">
                            {est?.label ?? o.estado}
                          </span>
                          {o.total != null && (
                            <span className="text-xs font-bold">
                              {o.facturada_at ? "Cobrada " : "A cobrar "}
                              {dinero(o.total)}
                            </span>
                          )}
                        </div>
                        {o.nro_factura && (
                          <p className="mt-0.5 text-right text-[11px] text-piedra">
                            Factura {o.nro_factura}
                          </p>
                        )}
                      </Link>
                    );
                  })}
                  {col.items.length === 0 && (
                    <p className="rounded-2xl border border-dashed border-borde p-3 text-center text-xs text-piedra/60">
                      {col.vacio}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
