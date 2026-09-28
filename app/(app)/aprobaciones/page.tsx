import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { dinero, fechaCorta } from "@/lib/format";
import { esGestor } from "@/lib/puestos";
import DecidirPropuesta from "@/components/DecidirPropuesta";

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
  items: { descripcion: string; cantidad: number; precio_unit: number; producto: { precio_referencia: number | null; moneda: string } | null }[];
};

/**
 * Aprobaciones de dirección (manual, reglas generales): propuestas fuera de
 * lista, el mismo día. Un toque para aprobar o rechazar con el motivo.
 */
export default async function AprobacionesPage() {
  const supabase = await createClient();
  const { data: rol } = await supabase.rpc("fn_rol");
  if (!esGestor(rol as string)) redirect("/");

  const [{ data }, { data: usuarios }, { data: resueltasData }] = await Promise.all([
    supabase
      .from("cotizacion_versiones")
      .select(
        "id, version, total, moneda, forma_pago, condiciones, aprobacion_motivo, created_at, creado_por, cotizacion:cotizaciones(id, numero, oportunidad:oportunidades(id, cliente_id, cliente:clientes(nombre_comercial))), items:cotizacion_items(descripcion, cantidad, precio_unit, producto:productos(precio_referencia, moneda))"
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
  ]);
  const pendientes = (data ?? []) as unknown as Pendiente[];
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
        <h1 className="text-2xl font-extrabold tracking-tight">Aprobaciones</h1>
        <p className="text-[15px] text-piedra">
          Propuestas fuera de lista: no se pueden imprimir ni mandar hasta que dirección las apruebe.
          {rol !== "direccion" ? " Las aprueba dirección general." : ""}
        </p>
      </div>

      {pendientes.length === 0 ? (
        <p className="rounded-2xl bg-white px-4 py-6 text-center text-lg font-bold text-verde shadow-sm">Nada para aprobar.</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
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
                        {it.producto?.precio_referencia && it.producto.moneda === p.moneda && it.precio_unit < it.producto.precio_referencia ? (
                          <span className="text-piedra"> (lista {dinero(it.producto.precio_referencia, p.moneda)})</span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
                {(p.forma_pago || p.condiciones) && (
                  <p className="mt-1 text-[14px] text-tinta/80">{[p.forma_pago, p.condiciones].filter(Boolean).join(" · ")}</p>
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
