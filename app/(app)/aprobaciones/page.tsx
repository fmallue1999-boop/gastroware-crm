import Link from "next/link";
import { redirect } from "next/navigation";
import { precioEn } from "@/lib/precios";
import { createClient } from "@/lib/supabase/server";
import { dinero, fechaCorta } from "@/lib/format";
import { esGestor } from "@/lib/puestos";
import DecidirPropuesta from "@/components/DecidirPropuesta";
import ConversacionCotizacion from "@/components/ConversacionCotizacion";
import { resumenConversaciones } from "@/lib/servidor/conversaciones";
import DecidirContenido from "@/components/contenidos/DecidirContenido";
import { firmarUrls } from "@/lib/core/storage";
import { CUENTAS, TIPOS, fechaDMY } from "@/lib/contenidos";
import AyudaLink from "@/components/guia/AyudaLink";

type Pendiente = {
  id: string;
  version: number;
  total: number | null;
  moneda: string;
  forma_pago: string | null;
  condiciones: string | null;
  aprobacion_motivo: string | null;
  created_at: string;
  creado_por: string | null;
  cotizacion: {
    id: string;
    numero: number;
    oportunidad: { id: string; cliente_id: string; cliente: { nombre_comercial: string } | null } | null;
  } | null;
  items: { descripcion: string; cantidad: number; precio_unit: number; producto: { precio_referencia: number | null; moneda: string; precio_ars: number | null; precio_usd: number | null } | null }[];
};

/**
 * Aprobaciones de dirección (manual, reglas generales): propuestas fuera de
 * lista, el mismo día. Un toque para aprobar o rechazar con el motivo.
 * v1.15: también los contenidos del calendario que carga marketing.
 */
export default async function AprobacionesPage() {
  const supabase = await createClient();
  const { data: rol } = await supabase.rpc("fn_rol");
  if (!esGestor(rol as string)) redirect("/");

  const [{ data }, { data: usuarios }, { data: resueltasData }, { data: contenidosData }, { data: pedidosData }] = await Promise.all([
    supabase
      .from("cotizacion_versiones")
      .select(
        "id, version, total, moneda, forma_pago, condiciones, aprobacion_motivo, created_at, creado_por, cotizacion:cotizaciones(id, numero, oportunidad:oportunidades(id, cliente_id, cliente:clientes(nombre_comercial))), items:cotizacion_items(descripcion, cantidad, precio_unit, producto:productos(precio_referencia, moneda, precio_ars, precio_usd))"
      )
      .eq("aprobacion", "pendiente")
      .order("created_at"),
    supabase.from("usuarios").select("id, nombre"),
    supabase
      .from("cotizacion_versiones")
      .select("id, version, aprobacion, aprobado_at, aprobacion_nota, total, moneda, cotizacion:cotizaciones(numero, oportunidad:oportunidades(cliente:clientes(nombre_comercial)))")
      .in("aprobacion", ["aprobada", "rechazada"])
      .order("aprobado_at", { ascending: false })
      .limit(15),
    supabase
      .from("contenidos")
      .select("id, nombre, cuenta, fecha, tipo, objetivo, copy, correccion, created_by, archivos:contenido_archivos(path, mime, nombre)")
      .eq("estado", "pendiente")
      .order("fecha"),
    supabase.from("pedidos_material").select("id, titulo, detalle, pedido_por, tomado_por, enviado_at").eq("estado", "para_aprobar").order("enviado_at"),
  ]);
  const pedidosAprobar = (pedidosData ?? []) as { id: string; titulo: string; detalle: string | null; pedido_por: string | null; tomado_por: string | null; enviado_at: string | null }[];
  const { data: archivosPed } = pedidosAprobar.length
    ? await supabase.from("material_archivos").select("dueno_id").eq("dueno", "pedido").in("dueno_id", pedidosAprobar.map((x) => x.id))
    : { data: [] };
  const archivosDePedido = new Map<string, number>();
  for (const a of (archivosPed ?? []) as { dueno_id: string }[]) archivosDePedido.set(a.dueno_id, (archivosDePedido.get(a.dueno_id) ?? 0) + 1);
  type ContenidoPendiente = {
    id: string;
    nombre: string;
    cuenta: string;
    fecha: string;
    tipo: string;
    objetivo: string | null;
    copy: string | null;
    correccion: string | null;
    created_by: string | null;
    archivos: { path: string; mime: string | null; nombre: string }[];
  };
  const contenidos = (contenidosData ?? []) as unknown as ContenidoPendiente[];
  // La primera imagen de cada uno, para ver de qué se trata sin abrirlo
  const primeraImagen = contenidos.map((c) => [...c.archivos].sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { numeric: true })).find((a) => (a.mime ?? "").startsWith("image/"))?.path ?? null);
  const miniaturas = await firmarUrls("contenidos", primeraImagen);
  const pendientes = (data ?? []) as unknown as Pendiente[];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const charlas = await resumenConversaciones(supabase, pendientes.map((p) => p.cotizacion?.id ?? "").filter(Boolean), user?.id ?? "");
  const nombre = new Map(((usuarios ?? []) as { id: string; nombre: string }[]).map((u) => [u.id, u.nombre]));
  const resueltas = (resueltasData ?? []) as unknown as {
    id: string;
    version: number;
    aprobacion: string;
    aprobado_at: string | null;
    aprobacion_nota: string | null;
    total: number | null;
    moneda: string;
    cotizacion: { numero: number; oportunidad: { cliente: { nombre_comercial: string } | null } | null } | null;
  }[];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex flex-wrap items-center gap-x-2 text-2xl font-extrabold tracking-tight">
          Aprobaciones <AyudaLink tarea="aprobar-propuestas" />
        </h1>
        <p className="text-[15px] text-piedra">
          Propuestas fuera de lista (no se pueden imprimir ni mandar hasta que se aprueben) y contenidos del calendario que carga marketing.
          {rol !== "direccion" ? " Los aprueba dirección general." : ""}
        </p>
      </div>

      {/* Pedidos a marketing (v1.23): lo que marketing hizo y espera aprobación */}
      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-piedra">
          Pedidos a marketing para aprobar ({pedidosAprobar.length})
          <Link href="/marketing/pedidos" className="normal-case text-marino underline">
            Ver todos
          </Link>
        </h2>
        {pedidosAprobar.length === 0 ? (
          <p className="rounded-2xl bg-white px-4 py-4 text-center text-[15px] font-bold text-verde shadow-sm">No hay pedidos esperando.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {pedidosAprobar.map((pm) => (
              <Link key={pm.id} href={`/marketing/pedidos/${pm.id}`} className="block rounded-2xl bg-white p-4 shadow-sm hover:bg-crema/50">
                <p className="text-[16px] font-extrabold">{pm.titulo}</p>
                {pm.detalle && <p className="line-clamp-2 text-[14px] text-tinta/80">{pm.detalle}</p>}
                <p className="mt-1 text-[13px] text-piedra">
                  {pm.pedido_por ? `Lo pidió ${nombre.get(pm.pedido_por) ?? "—"}` : "Pedido"}
                  {pm.tomado_por ? ` · lo hizo ${nombre.get(pm.tomado_por) ?? "marketing"}` : ""} · {archivosDePedido.get(pm.id) ?? 0} archivo
                  {(archivosDePedido.get(pm.id) ?? 0) === 1 ? "" : "s"}
                </p>
                <p className="mt-2 inline-flex min-h-10 items-center rounded-xl bg-violeta px-4 text-[14px] font-bold text-white">Revisar y aprobar</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Calendario de contenidos */}
      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-piedra">
          Contenidos para aprobar ({contenidos.length})
          <Link href="/contenidos" className="normal-case text-marino underline">
            Ver el calendario
          </Link>
        </h2>
        {contenidos.length === 0 ? (
          <p className="rounded-2xl bg-white px-4 py-4 text-center text-[15px] font-bold text-verde shadow-sm">No hay contenidos esperando.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {contenidos.map((ct, k) => (
              <div key={ct.id} className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex gap-3">
                  {miniaturas[k] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={miniaturas[k]!} alt="" className="h-24 w-20 shrink-0 rounded-xl object-cover" />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="text-[16px] font-extrabold">{ct.nombre}</p>
                    <p className="text-[14px] text-piedra">
                      {fechaDMY(ct.fecha)} · {CUENTAS.find((x) => x.value === ct.cuenta)?.label ?? ct.cuenta} · {TIPOS.find((x) => x.value === ct.tipo)?.label ?? ct.tipo}
                      {ct.archivos.length ? ` · ${ct.archivos.length} archivo${ct.archivos.length > 1 ? "s" : ""}` : " · sin archivos"}
                    </p>
                    {ct.objetivo && <p className="text-[14px] text-tinta/80">Objetivo: {ct.objetivo}</p>}
                    {ct.copy && <p className="mt-1 line-clamp-3 whitespace-pre-line text-[14px] text-tinta/80">{ct.copy}</p>}
                    <p className="mt-1 text-xs text-piedra">
                      Cargó: {ct.created_by ? nombre.get(ct.created_by) ?? "—" : "—"} ·{" "}
                      <Link href={`/contenidos?ficha=${ct.id}&dia=${ct.fecha}`} className="font-bold text-marino underline">
                        Ver completo
                      </Link>
                    </p>
                  </div>
                </div>
                {rol === "direccion" ? <DecidirContenido contenidoId={ct.id} /> : <p className="mt-2 text-[14px] font-bold text-piedra">Esperando a dirección general.</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      <h2 className="text-xs font-bold uppercase tracking-wide text-piedra">Propuestas fuera de lista ({pendientes.length})</h2>

      {pendientes.length === 0 ? (
        <p className="rounded-2xl bg-white px-4 py-6 text-center text-lg font-bold text-verde shadow-sm">Nada para aprobar.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {pendientes.map((p) => {
            const opp = p.cotizacion?.oportunidad;
            return (
              <div key={p.id} className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={opp ? `/clientes/${opp.cliente_id}?interes=${opp.id}` : "#"} className="text-[16px] font-extrabold hover:underline">
                      {opp?.cliente?.nombre_comercial ?? "Contacto"}
                    </Link>
                    <p className="text-[14px] text-piedra">
                      Propuesta N° {p.cotizacion?.numero}
                      {p.version > 1 ? ` v${p.version}` : ""} · {p.creado_por ? nombre.get(p.creado_por) ?? "—" : "—"} · {fechaCorta(p.created_at)}
                    </p>
                  </div>
                  <p className="shrink-0 text-[18px] font-extrabold">{dinero(p.total, p.moneda)}</p>
                </div>
                <p className="mt-1 rounded-xl bg-ambar-soft px-3 py-1.5 text-[14px] font-bold text-ambar">{p.aprobacion_motivo}</p>
                <ul className="mt-2 space-y-0.5 text-[14px]">
                  {p.items.map((it, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span className="min-w-0 truncate">
                        {it.cantidad} × {it.descripcion}
                      </span>
                      <span className="shrink-0">
                        {dinero(it.precio_unit, p.moneda)}
                        {precioEn(it.producto, p.moneda) != null && it.precio_unit < precioEn(it.producto, p.moneda)! ? (
                          <span className="text-piedra"> (lista {dinero(precioEn(it.producto, p.moneda)!, p.moneda)})</span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
                {(p.forma_pago || p.condiciones) && (
                  <p className="mt-1 text-[14px] text-tinta/80">{[p.forma_pago, p.condiciones].filter(Boolean).join(" · ")}</p>
                )}
                {p.cotizacion && (
                  <div className="mt-2">
                    <ConversacionCotizacion cotizacionId={p.cotizacion.id} total={charlas[p.cotizacion.id]?.total ?? 0} sinLeer={charlas[p.cotizacion.id]?.sinLeer ?? 0} />
                  </div>
                )}
                {rol === "direccion" ? <DecidirPropuesta versionId={p.id} /> : <p className="mt-2 text-[14px] font-bold text-piedra">Esperando a dirección general.</p>}
              </div>
            );
          })}
        </div>
      )}

      {resueltas.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-piedra">Resueltas hace poco</h2>
          <div className="space-y-1.5">
            {resueltas.map((r) => (
              <p key={r.id} className="rounded-xl bg-white px-3 py-2 text-[14px] shadow-sm">
                <span className={`font-bold ${r.aprobacion === "aprobada" ? "text-verde" : "text-red-600"}`}>
                  {r.aprobacion === "aprobada" ? "Aprobada" : "Rechazada"}
                </span>{" "}
                · {r.cotizacion?.oportunidad?.cliente?.nombre_comercial ?? "—"} · N° {r.cotizacion?.numero} · {dinero(r.total, r.moneda)}
                {r.aprobacion_nota ? ` · ${r.aprobacion_nota}` : ""}
                <span className="text-piedra"> · {fechaCorta(r.aprobado_at)}</span>
              </p>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
