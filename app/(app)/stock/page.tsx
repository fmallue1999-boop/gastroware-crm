import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIAS_PRODUCTO } from "@/lib/constants";
import { fechaCorta, linkWhatsApp } from "@/lib/format";
import { BotonLlego, IngresosProducto, StockEditable } from "@/components/StockAdmin";
import { PuntoNivel } from "@/components/PuntoNivel";
import type { IngresoStock, Producto } from "@/lib/types";

type Esperando = { id: string; nombre: string; telefono: string | null; nivel: string | null };

/**
 * Stock para todo el equipo (Etapa 1, 1.6): por producto, Hay / Llega /
 * Esperan. Administración carga cantidades e ingresos previstos y toca
 * "Llegó" cuando entra la mercadería: los que esperan pasan a Hoy.
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
        .select("producto_id, temperatura, cliente:clientes(id, nombre_comercial, telefono)")
        .eq("etapa", "espera"),
      supabase.rpc("fn_rol"),
    ]);
  const productos = (prods ?? []) as Producto[];
  const ingresos = (ingresosData ?? []) as IngresoStock[];
  const esGestor = ["direccion", "admin"].includes((rol as string) ?? "");
  const recibe = ["administrativa", "servicio", "tecnico"].includes((rol as string) ?? "");

  const esperaPor = new Map<string, Esperando[]>();
  for (const o of (esperas ?? []) as unknown as {
    producto_id: string | null;
    temperatura: string | null;
    cliente: { id: string; nombre_comercial: string; telefono: string | null } | null;
  }[]) {
    if (!o.producto_id || !o.cliente) continue;
    if (!esperaPor.has(o.producto_id)) esperaPor.set(o.producto_id, []);
    esperaPor.get(o.producto_id)!.push({
      id: o.cliente.id,
      nombre: o.cliente.nombre_comercial,
      telefono: o.cliente.telefono,
      nivel: o.temperatura,
    });
  }

  const grupos = Object.entries(CATEGORIAS_PRODUCTO)
    .map(([cat, label]) => ({ label, items: productos.filter((p) => p.categoria === cat) }))
    .filter((g) => g.items.length > 0);
  const totalEspera = Array.from(esperaPor.values()).reduce((s, l) => s + l.length, 0);
  const etiqueta = "text-[11px] font-semibold uppercase tracking-wide text-piedra";

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Stock</h1>
      <p className="mb-4 text-[15px] text-piedra">
        Qué hay, qué llega y quién espera.
        {totalEspera > 0 && (
          <>
            {" "}
            <Link href="/clientes?vista=espera#contactos" className="underline">
              {totalEspera} en lista de espera
            </Link>
            .
          </>
        )}
        {esGestor &&
          " Cuando entra la mercadería, tocá Llegó: los que esperan pasan a Hoy en el inicio de su vendedor."}
      </p>

      <div className="space-y-5">
        {grupos.map((g) => (
          <section key={g.label}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-piedra">{g.label}</h2>
            <div className="overflow-hidden rounded-2xl border border-borde bg-white shadow-sm">
              {g.items.map((p) => {
                const ing = ingresos.filter((i) => i.producto_id === p.id);
                const esperando = esperaPor.get(p.id) ?? [];
                return (
                  <div key={p.id} className="border-b border-borde/60 px-3.5 py-3 last:border-0">
                    <p className="text-[15px] font-semibold">{p.nombre}</p>
                    <div className="mt-1.5 grid grid-cols-3 gap-2">
                      <div>
                        <p className={etiqueta}>Hay</p>
                        {esGestor ? (
                          <StockEditable productoId={p.id} stock={p.stock} />
                        ) : (
                          <p className={`text-2xl font-bold ${p.stock > 0 ? "text-verde" : "text-ambar"}`}>
                            {p.stock}
                          </p>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className={etiqueta}>Llega</p>
                        {esGestor ? (
                          <IngresosProducto productoId={p.id} ingresos={ing} />
                        ) : ing.length > 0 ? (
                          ing.map((i) => (
                            <p key={i.id} className="text-[15px]">
                              {i.cantidad}
                              {i.fecha_estimada ? ` el ${fechaCorta(i.fecha_estimada)}` : " (fecha a confirmar)"}
                              {i.nota ? <span className="text-piedra"> · {i.nota}</span> : null}
                              {recibe && (
                                <span className="ml-2">
                                  <BotonLlego ingresoId={i.id} />
                                </span>
                              )}
                            </p>
                          ))
                        ) : (
                          <p className="text-[15px] text-piedra">sin ingreso previsto</p>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className={etiqueta}>Esperan</p>
                        {esperando.length === 0 ? (
                          <p className="text-[15px] text-piedra">nadie</p>
                        ) : (
                          <details className="group">
                            <summary className="min-h-9 cursor-pointer list-none text-[15px] font-semibold text-naranja underline [&::-webkit-details-marker]:hidden">
                              {esperando.length}
                            </summary>
                            <div className="mt-1 space-y-1">
                              {esperando.map((c) => (
                                <div key={c.id} className="flex items-center gap-1.5 text-sm">
                                  <PuntoNivel nivel={c.nivel} />
                                  <Link href={`/clientes/${c.id}`} className="min-w-0 flex-1 truncate underline">
                                    {c.nombre}
                                  </Link>
                                  {c.telefono && (
                                    <a
                                      href={linkWhatsApp(c.telefono)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      aria-label={`WhatsApp a ${c.nombre}`}
                                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-verde text-white"
                                    >
                                      <MessageCircle className="h-4 w-4" />
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    </div>
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
