import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIAS_PRODUCTO } from "@/lib/constants";
import { fechaCorta } from "@/lib/format";
import { IngresosProducto, StockEditable } from "@/components/StockAdmin";
import type { IngresoStock, Producto } from "@/lib/types";

/**
 * Stock para todo el equipo: qué hay, qué va a entrar y cuándo, y quiénes
 * están esperando cada producto. Administración lo edita acá mismo.
 */
export default async function StockPage() {
  const supabase = await createClient();
  const [{ data: prods }, { data: ingresosData }, { data: esperas }, { data: rol }] =
    await Promise.all([
      supabase
        .from("productos")
        .select("*")
        .eq("activo", true)
        .eq("es_consumible", false)
        .order("categoria")
        .order("nombre"),
      supabase
        .from("ingresos_stock")
        .select("*")
        .is("recibido_at", null)
        .order("fecha_estimada", { ascending: true, nullsFirst: false }),
      supabase
        .from("oportunidades")
        .select("producto_id, cliente:clientes(id, nombre_comercial, telefono)")
        .eq("etapa", "espera"),
      supabase.rpc("fn_rol"),
    ]);
  const productos = (prods ?? []) as Producto[];
  const ingresos = (ingresosData ?? []) as IngresoStock[];
  const esGestor = ["direccion", "admin"].includes((rol as string) ?? "");

  const esperaPor = new Map<string, { id: string; nombre: string }[]>();
  for (const o of (esperas ?? []) as unknown as {
    producto_id: string | null;
    cliente: { id: string; nombre_comercial: string } | null;
  }[]) {
    if (!o.producto_id || !o.cliente) continue;
    if (!esperaPor.has(o.producto_id)) esperaPor.set(o.producto_id, []);
    esperaPor.get(o.producto_id)!.push({ id: o.cliente.id, nombre: o.cliente.nombre_comercial });
  }

  const grupos = Object.entries(CATEGORIAS_PRODUCTO)
    .map(([cat, label]) => ({
      label,
      items: productos.filter((p) => p.categoria === cat),
    }))
    .filter((g) => g.items.length > 0);

  const totalEspera = Array.from(esperaPor.values()).reduce((s, l) => s + l.length, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Stock</h1>
      <p className="mb-4 text-sm text-piedra">
        Qué hay, qué llega y cuándo.
        {totalEspera > 0 && (
          <>
            {" "}
            <Link href="/clientes?vista=espera" className="underline">
              {totalEspera} en lista de espera
            </Link>
            .
          </>
        )}
        {esGestor && " Administración carga el stock y los ingresos acá mismo."}
      </p>

      <div className="space-y-5">
        {grupos.map((g) => (
          <section key={g.label}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-piedra">
              {g.label}
            </h2>
            <div className="overflow-hidden rounded-2xl border border-borde bg-white shadow-sm">
              {g.items.map((p) => {
                const ing = ingresos.filter((i) => i.producto_id === p.id);
                const esperando = esperaPor.get(p.id) ?? [];
                const proximo = ing[0];
                return (
                  <div
                    key={p.id}
                    className="border-b border-borde/60 px-3.5 py-3 last:border-0"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium">{p.nombre}</p>
                        <p className="text-xs text-piedra">
                          {p.stock > 0 ? (
                            <span className="font-medium text-green-700">Hay {p.stock}</span>
                          ) : (
                            <span className="font-medium text-amber-700">Sin stock</span>
                          )}
                          {proximo
                            ? ` · llegan ${proximo.cantidad}${
                                proximo.fecha_estimada
                                  ? ` el ${fechaCorta(proximo.fecha_estimada)}`
                                  : " (fecha a confirmar)"
                              }`
                            : p.stock > 0
                              ? ""
                              : " · sin ingreso previsto"}
                          {esperando.length > 0 && (
                            <>
                              {" · "}
                              <Link
                                href={`/clientes?vista=espera&producto=${p.id}`}
                                className="font-medium text-orange-700 underline"
                              >
                                {esperando.length} esperando
                              </Link>
                            </>
                          )}
                        </p>
                      </div>
                      {esGestor ? (
                        <StockEditable productoId={p.id} stock={p.stock} />
                      ) : (
                        <span
                          className={`rounded-full px-3 py-1 text-sm font-semibold ${
                            p.stock > 0
                              ? "bg-green-100 text-green-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {p.stock}
                        </span>
                      )}
                    </div>
                    {(esGestor || ing.length > 0) && (
                      <div className="mt-2">
                        {esGestor ? (
                          <IngresosProducto productoId={p.id} ingresos={ing} />
                        ) : (
                          ing.map((i) => (
                            <p key={i.id} className="text-xs text-piedra">
                              Llegan {i.cantidad}
                              {i.fecha_estimada
                                ? ` el ${fechaCorta(i.fecha_estimada)}`
                                : " (fecha a confirmar)"}
                              {i.nota ? ` · ${i.nota}` : ""}
                            </p>
                          ))
                        )}
                      </div>
                    )}
                    {esperando.length > 0 && (
                      <p className="mt-1.5 truncate text-xs text-piedra">
                        Esperan:{" "}
                        {esperando.slice(0, 4).map((c, i) => (
                          <span key={c.id}>
                            {i > 0 ? ", " : ""}
                            <Link href={`/clientes/${c.id}`} className="underline">
                              {c.nombre}
                            </Link>
                          </span>
                        ))}
                        {esperando.length > 4 ? ` y ${esperando.length - 4} más` : ""}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
