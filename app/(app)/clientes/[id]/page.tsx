import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fechaCorta, linkWhatsApp, dinero, diasDesde, hoyISO } from "@/lib/format";
import { EtapaBadge, TempBadge, ProductoBadge } from "@/components/Badges";
import NotaForm from "@/components/NotaForm";
import EquipoForm from "@/components/EquipoForm";
import type {
  Actividad,
  Cliente,
  EquipoInstalado,
  Oportunidad,
  Producto,
  Recurrencia,
  Tarea,
} from "@/lib/types";

export default async function ClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const hoy = hoyISO();
  const supabase = await createClient();

  const { data: cliente } = await supabase
    .from("clientes")
    .select("*")
    .eq("id", id)
    .single();
  if (!cliente) notFound();
  const c = cliente as Cliente;

  const [equiposRes, recurrenciasRes, oportunidadesRes, tareasRes, actividadesRes, productosRes] =
    await Promise.all([
      supabase
        .from("equipos_instalados")
        .select("*, producto:productos(*)")
        .eq("cliente_id", id)
        .order("fecha_compra", { ascending: false }),
      supabase
        .from("recurrencias")
        .select("*, producto:productos(*)")
        .eq("cliente_id", id)
        .eq("activa", true),
      supabase
        .from("oportunidades")
        .select("*, producto:productos(*)")
        .eq("cliente_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("tareas")
        .select("*")
        .eq("cliente_id", id)
        .is("completada_at", null)
        .eq("cancelada", false)
        .order("vence_el"),
      supabase
        .from("actividades")
        .select("*")
        .eq("cliente_id", id)
        .order("created_at", { ascending: false })
        .limit(15),
      supabase
        .from("productos")
        .select("*")
        .eq("activo", true)
        .order("nombre"),
    ]);

  const equipos = (equiposRes.data ?? []) as unknown as EquipoInstalado[];
  const recurrencias = (recurrenciasRes.data ?? []) as unknown as Recurrencia[];
  const oportunidades = (oportunidadesRes.data ?? []) as unknown as Oportunidad[];
  const tareas = (tareasRes.data ?? []) as unknown as Tarea[];
  const actividades = (actividadesRes.data ?? []) as unknown as Actividad[];
  const productos = (productosRes.data ?? []) as Producto[];

  return (
    <div className="space-y-5">
      <header>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold">{c.nombre_comercial}</h1>
            <p className="text-sm text-piedra">
              {c.rubro}
              {c.ciudad ? ` · ${c.ciudad}` : ""}
              {c.estado === "cliente_activo"
                ? " · Cliente activo"
                : " · Prospecto"}
            </p>
          </div>
          {c.telefono && (
            <a
              href={linkWhatsApp(c.telefono)}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-xl bg-green-600 px-3 py-2 text-sm font-medium text-white"
            >
              WhatsApp
            </a>
          )}
        </div>
        {c.notas && <p className="mt-2 text-sm text-tinta/70">{c.notas}</p>}
      </header>

      <section className="rounded-xl border border-borde bg-white p-4">
        <h2 className="text-sm font-semibold mb-2">Equipos y consumibles</h2>
        <div className="space-y-2 mb-3">
          {equipos.map((e) => {
            const vigente = e.garantia_hasta && e.garantia_hasta >= hoy;
            return (
              <div key={e.id} className="text-sm">
                <p>
                  {e.producto?.nombre ?? e.marca_modelo}
                  {e.cantidad > 1 ? ` × ${e.cantidad}` : ""}
                  {e.origen === "externo" && (
                    <span className="ml-1.5 rounded-full border border-borde px-2 py-0.5 text-xs text-piedra">
                      otra marca
                    </span>
                  )}
                </p>
                <p className="text-xs text-piedra">
                  {e.numero_serie ? `Serie ${e.numero_serie} · ` : ""}
                  {e.fecha_compra ? `comprado ${fechaCorta(e.fecha_compra)}` : "sin fecha"}
                  {e.garantia_hasta && (
                    <span className={vigente ? "text-green-700" : "text-red-600"}>
                      {" "}· garantía {vigente ? "vigente" : "vencida"} ({fechaCorta(e.garantia_hasta)})
                    </span>
                  )}
                </p>
              </div>
            );
          })}
          {recurrencias.map((r) => (
            <p key={r.id} className="text-sm text-amber-700">
              🔔 {r.producto?.nombre}: cada {r.frecuencia_dias} días — próximo
              aviso {fechaCorta(r.proxima_alerta)}
              {r.ultima_compra
                ? ` (última compra hace ${diasDesde(r.ultima_compra)} días)`
                : ""}
            </p>
          ))}
          {equipos.length === 0 && recurrencias.length === 0 && (
            <p className="text-sm text-piedra/80">
              Sin equipos registrados todavía.
            </p>
          )}
        </div>
        <EquipoForm clienteId={c.id} productos={productos} />
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold">Oportunidades</h2>
          <Link href="/alta" className="text-sm text-sky-700">
            + Nueva consulta
          </Link>
        </div>
        {oportunidades.length === 0 ? (
          <p className="text-sm text-piedra/80">Sin consultas registradas.</p>
        ) : (
          <div className="space-y-2">
            {oportunidades.map((o) => (
              <Link
                key={o.id}
                href={`/oportunidades/${o.id}`}
                className="block rounded-xl border border-borde bg-white p-3"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <EtapaBadge etapa={o.etapa} />
                  <TempBadge temperatura={o.temperatura} />
                  <ProductoBadge nombre={o.producto?.nombre} />
                </div>
                <p className="mt-1 text-xs text-piedra">
                  {o.monto_estimado
                    ? dinero(o.monto_estimado, o.moneda)
                    : "Sin cotizar"}
                  {" · "}
                  {fechaCorta(o.created_at)}
                  {o.motivo_perdida ? ` · Perdida: ${o.motivo_perdida}` : ""}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {tareas.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-2">Tareas pendientes</h2>
          <div className="space-y-1.5">
            {tareas.map((t) => (
              <p key={t.id} className="text-sm text-tinta/70">
                <span className="text-piedra/80">
                  {fechaCorta(t.vence_el)}:
                </span>{" "}
                {t.titulo}
              </p>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold mb-2">Historial</h2>
        <NotaForm clienteId={c.id} />
        <div className="mt-3 space-y-2">
          {actividades.map((a) => (
            <div key={a.id} className="text-sm">
              <span className="text-piedra/80">
                {fechaCorta(a.created_at)}
              </span>{" "}
              <span className="text-tinta/80">{a.contenido}</span>
            </div>
          ))}
          {actividades.length === 0 && (
            <p className="text-sm text-piedra/80">Sin actividad todavía.</p>
          )}
        </div>
      </section>
    </div>
  );
}
