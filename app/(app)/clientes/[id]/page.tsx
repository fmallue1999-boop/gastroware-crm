import Link from "next/link";
import { notFound } from "next/navigation";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { firmarUrls } from "@/lib/core/storage";
import { iaConfigurada } from "@/lib/core/ia";
import IAResumenCliente from "@/components/IAResumenCliente";
import { fechaCorta, linkWhatsApp, dinero, diasDesde, hoyISO } from "@/lib/format";
import { ESTADOS_OT } from "@/lib/constants";
import { EtapaBadge, TempBadge, ProductoBadge } from "@/components/Badges";
import NotaForm from "@/components/NotaForm";
import EquipoForm from "@/components/EquipoForm";
import DatosClienteForm from "@/components/DatosClienteForm";
import SucursalesCliente from "@/components/SucursalesCliente";
import DocumentosEntidad from "@/components/DocumentosEntidad";
import type {
  Actividad,
  Cliente,
  Equipo,
  Oportunidad,
  Producto,
  Recurrencia,
  Sucursal,
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
    .select("*, sucursales(*)")
    .eq("id", id)
    .single();
  if (!cliente) notFound();
  const { sucursales: sucursalesData, ...restoCliente } = cliente as Cliente & {
    sucursales?: Sucursal[];
  };
  const sucursales = (sucursalesData ?? []).filter((s) => !("deleted_at" in s) || !(s as { deleted_at?: string | null }).deleted_at);
  const principal = sucursales.find((s) => s.es_principal) ?? sucursales[0];
  const c: Cliente = { ...restoCliente, ciudad: principal?.ciudad ?? null };

  const [equiposRes, recurrenciasRes, oportunidadesRes, tareasRes, actividadesRes, productosRes, documentosRes, otsRes] =
    await Promise.all([
      supabase
        .from("equipos")
        .select("*, producto:productos(*)")
        .eq("cliente_id", id)
        .order("fecha_venta", { ascending: false }),
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
      supabase
        .from("documentos")
        .select("*")
        .eq("entidad", "cliente")
        .eq("entidad_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("ordenes_trabajo")
        .select("id, numero, estado, tipo, fecha_programada, created_at")
        .eq("cliente_id", id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  const equipos = (equiposRes.data ?? []) as unknown as Equipo[];
  const recurrencias = (recurrenciasRes.data ?? []) as unknown as Recurrencia[];
  const oportunidades = (oportunidadesRes.data ?? []) as unknown as Oportunidad[];
  const tareas = (tareasRes.data ?? []) as unknown as Tarea[];
  const actividades = (actividadesRes.data ?? []) as unknown as Actividad[];
  const productos = (productosRes.data ?? []) as Producto[];

  const docs = (documentosRes.data ?? []) as {
    id: string;
    tipo: string;
    nombre: string;
    path: string;
    created_at: string;
  }[];
  const urlsDocs = await firmarUrls(
    "documentos",
    docs.map((d) => d.path)
  );
  const documentos = docs.map((d, i) => ({
    id: d.id,
    tipo: d.tipo,
    nombre: d.nombre,
    created_at: d.created_at,
    url: urlsDocs[i],
  }));

  const ots = (otsRes.data ?? []) as {
    id: string;
    numero: number;
    estado: string;
    tipo: string;
    fecha_programada: string | null;
    created_at: string;
  }[];

  return (
    <div className="space-y-5">
      <header>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{c.nombre_comercial}</h1>
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
              className="shrink-0 rounded-2xl bg-green-600 px-3 py-2 text-sm font-medium text-white"
            >
              WhatsApp
            </a>
          )}
        </div>
        {c.notas && <p className="mt-2 text-sm text-tinta/70">{c.notas}</p>}
      </header>

      {iaConfigurada() && <IAResumenCliente clienteId={c.id} />}

      <DatosClienteForm cliente={c} />

      <div className="grid gap-5 lg:grid-cols-2">
        <SucursalesCliente clienteId={c.id} sucursales={sucursales} />
        <DocumentosEntidad
          entidad="cliente"
          entidadId={c.id}
          documentos={documentos}
          puedeBorrar
        />
      </div>

      <section className="rounded-2xl border border-borde bg-white shadow-sm p-4">
        <h2 className="text-sm font-semibold mb-2">Equipos y consumibles</h2>
        <div className="space-y-2 mb-3">
          {equipos.map((e) => {
            const vigente = e.garantia_hasta && e.garantia_hasta >= hoy;
            return (
              <Link key={e.id} href={`/equipos/${e.id}`} className="block text-sm">
                <p className="font-medium hover:underline">
                  {e.producto?.nombre ?? e.marca_modelo_libre}
                  {e.origen === "externo" && (
                    <span className="ml-1.5 rounded-full border border-borde px-2 py-0.5 text-xs font-normal text-piedra">
                      otra marca
                    </span>
                  )}
                </p>
                <p className="text-xs text-piedra">
                  {e.numero_serie ? `Serie ${e.numero_serie} · ` : ""}
                  {e.fecha_venta ? `comprado ${fechaCorta(e.fecha_venta)}` : "sin fecha"}
                  {e.garantia_hasta && (
                    <span className={vigente ? "text-green-700" : "text-red-600"}>
                      {" "}· garantía {vigente ? "vigente" : "vencida"} ({fechaCorta(e.garantia_hasta)})
                    </span>
                  )}
                </p>
              </Link>
            );
          })}
          {recurrencias.map((r) => (
            <p key={r.id} className="text-sm text-amber-700">
              <Bell className="mr-1 -mt-0.5 inline h-3.5 w-3.5" />
              {r.producto?.nombre}: cada {r.frecuencia_dias} días — próximo
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
                className="block rounded-2xl border border-borde bg-white shadow-sm p-3"
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

      {ots.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-2">Órdenes de servicio</h2>
          <div className="space-y-1.5">
            {ots.map((o) => {
              const est = ESTADOS_OT.find((e) => e.value === o.estado);
              return (
                <Link
                  key={o.id}
                  href={`/servicio/${o.id}`}
                  className="flex items-center justify-between rounded-2xl border border-borde bg-white px-3 py-2.5 text-sm shadow-sm"
                >
                  <span className="font-medium">OT-{o.numero}</span>
                  <span className="text-xs text-piedra">
                    {est?.label ?? o.estado} ·{" "}
                    {fechaCorta(o.fecha_programada ?? o.created_at)}
                  </span>
                </Link>
              );
            })}
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
