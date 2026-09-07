import Link from "next/link";
import { notFound } from "next/navigation";
import { Bell, Mail, MessageCircle, Phone, Wrench } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { firmarUrls } from "@/lib/core/storage";
import { iaConfigurada } from "@/lib/core/ia";
import IAResumenCliente from "@/components/IAResumenCliente";
import {
  fechaCorta,
  haceCuanto,
  linkWhatsApp,
  dinero,
  diasDesde,
  hoyISO,
  telefonoProlijo,
} from "@/lib/format";
import { ESTADOS_OT, ETAPAS_ABIERTAS } from "@/lib/constants";
import AnotarContacto from "@/components/AnotarContacto";
import SeguimientoItem from "@/components/SeguimientoItem";
import InteresControl from "@/components/InteresControl";
import VentaPaso from "@/components/VentaPaso";
import NotaForm from "@/components/NotaForm";
import EquipoForm from "@/components/EquipoForm";
import DatosClienteForm from "@/components/DatosClienteForm";
import BorrarCliente from "@/components/BorrarCliente";
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

const sumario =
  "flex cursor-pointer items-center justify-between rounded-2xl border border-borde bg-white px-4 py-3 text-sm font-medium shadow-sm list-none [&::-webkit-details-marker]:hidden";

/**
 * Ficha del contacto: todo en una pantalla. Cómo contactarlo, qué pasó,
 * qué le interesa, qué le vendimos, qué equipos tiene y sus services.
 */
export default async function ContactoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const hoy = hoyISO();
  const supabase = await createClient();

  const [{ data: cliente }, { data: rol }] = await Promise.all([
    supabase.from("clientes").select("*, sucursales(*)").eq("id", id).single(),
    supabase.rpc("fn_rol"),
  ]);
  if (!cliente) notFound();
  const esGestor = ["direccion", "admin"].includes((rol as string) ?? "");
  const esTecnico = rol === "tecnico";
  const { sucursales: sucursalesData, ...restoCliente } = cliente as Cliente & {
    sucursales?: Sucursal[];
  };
  const sucursales = (sucursalesData ?? []).filter(
    (s) => !("deleted_at" in s) || !(s as { deleted_at?: string | null }).deleted_at
  );
  const principal = sucursales.find((s) => s.es_principal) ?? sucursales[0];
  const c: Cliente = { ...restoCliente, ciudad: principal?.ciudad ?? null };

  const [
    equiposRes,
    recurrenciasRes,
    oportunidadesRes,
    tareasRes,
    actividadesRes,
    productosRes,
    documentosRes,
    otsRes,
    usuariosRes,
  ] = await Promise.all([
    supabase
      .from("equipos")
      .select("*, producto:productos(*)")
      .eq("cliente_id", id)
      .is("deleted_at", null)
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
      .limit(60),
    supabase.from("productos").select("*").eq("activo", true).order("nombre"),
    supabase
      .from("documentos")
      .select("*")
      .eq("entidad", "cliente")
      .eq("entidad_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("ordenes_trabajo")
      .select("id, numero, estado, tipo, fecha_programada, created_at, trabajo_realizado, cerrada_tecnico_at")
      .eq("cliente_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase.from("usuarios").select("id, nombre"),
  ]);

  const equipos = (equiposRes.data ?? []) as unknown as Equipo[];
  const recurrencias = (recurrenciasRes.data ?? []) as unknown as Recurrencia[];
  const oportunidades = (oportunidadesRes.data ?? []) as unknown as Oportunidad[];
  const tareas = (tareasRes.data ?? []) as unknown as Tarea[];
  const actividades = (actividadesRes.data ?? []) as unknown as Actividad[];
  const productos = (productosRes.data ?? []) as Producto[];
  const nombres = new Map(
    ((usuariosRes.data ?? []) as { id: string; nombre: string }[]).map((u) => [u.id, u.nombre])
  );

  const abiertas = oportunidades.filter((o) =>
    (ETAPAS_ABIERTAS as readonly string[]).includes(o.etapa)
  );
  const ventas = oportunidades.filter((o) => o.etapa === "ganada");
  const perdidas = oportunidades.filter((o) => o.etapa === "perdida");
  const serieFaltante = new Set(
    equipos.filter((e) => e.oportunidad_id && !e.numero_serie).map((e) => e.oportunidad_id)
  );
  const nombreProductos = (o: Oportunidad) => {
    const extra = (o.productos_extra ?? [])
      .map((pid) => productos.find((p) => p.id === pid)?.nombre)
      .filter(Boolean) as string[];
    return (
      [o.producto?.nombre, ...extra].filter(Boolean).join(", ") ||
      o.mensaje_inicial ||
      "Venta"
    );
  };

  const docs = (documentosRes.data ?? []) as {
    id: string;
    tipo: string;
    nombre: string;
    path: string;
    created_at: string;
  }[];
  const urlsDocs = await firmarUrls("documentos", docs.map((d) => d.path));
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
    trabajo_realizado: string | null;
    cerrada_tecnico_at: string | null;
  }[];

  const TIPO_OT: Record<string, string> = {
    correctivo: "Reparación",
    preventivo: "Mantenimiento",
    instalacion: "Instalación",
    garantia: "Garantía",
  };

  const estadoLabel =
    c.estado === "cliente_activo" ? "Cliente" : c.estado === "inactivo" ? "Inactivo" : "Interesado";
  const atiende = c.comercial_id ? nombres.get(c.comercial_id) : null;

  return (
    <div className="space-y-3">
      {/* Cabecera: quién es y cómo contactarlo */}
      <header className="rounded-2xl border border-borde bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight">{c.nombre_comercial}</h1>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              c.estado === "cliente_activo"
                ? "bg-green-100 text-green-700"
                : c.estado === "inactivo"
                  ? "bg-crema-deep text-piedra"
                  : "bg-celeste-soft text-sky-800"
            }`}
          >
            {estadoLabel}
          </span>
        </div>
        <p className="mt-0.5 text-sm text-piedra">
          {[c.rubro !== "Otro" ? c.rubro : null, c.ciudad, atiende ? `atiende ${atiende}` : null]
            .filter(Boolean)
            .join(" · ") || "Sin más datos por ahora"}
        </p>
        {c.notas && <p className="mt-1.5 text-sm text-tinta/70">{c.notas}</p>}

        <div className="mt-3 flex flex-wrap gap-2">
          {c.telefono ? (
            <>
              <a
                href={linkWhatsApp(c.telefono)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-green-600 px-4 py-3 text-sm font-semibold text-white"
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
              <a
                href={`tel:${c.telefono}`}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-2xl border border-borde bg-white px-4 py-3 text-sm font-semibold"
              >
                <Phone className="h-4 w-4" /> {telefonoProlijo(c.telefono)}
              </a>
            </>
          ) : (
            <p className="text-sm text-amber-700">Sin teléfono: cargalo en “Datos completos”.</p>
          )}
          {c.email && (
            <a
              href={`mailto:${c.email}`}
              className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-borde bg-white px-4 py-3 text-sm"
            >
              <Mail className="h-4 w-4" /> {c.email}
            </a>
          )}
        </div>
      </header>

      {/* Lo de todos los días */}
      <AnotarContacto clienteId={c.id} />

      {tareas.length > 0 && (
        <section>
          <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-piedra">
            Pendiente
          </h2>
          <div className="space-y-2">
            {tareas.map((t) => (
              <SeguimientoItem
                key={t.id}
                mostrarContacto={false}
                tarea={{
                  id: t.id,
                  titulo: t.titulo,
                  vence_el: t.vence_el,
                  cliente_id: t.cliente_id,
                  responsable: t.usuario_id ? nombres.get(t.usuario_id) : null,
                }}
              />
            ))}
          </div>
        </section>
      )}

      {iaConfigurada() && <IAResumenCliente clienteId={c.id} />}

      {!esTecnico && (
        <InteresControl clienteId={c.id} abiertas={abiertas} productos={productos} />
      )}

      {/* Ventas */}
      {!esTecnico && ventas.length > 0 && (
        <section>
          <div className="mb-1.5 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-piedra">Ventas</h2>
            <Link href={`/pedidos/nuevo?cliente=${c.id}`} className="text-xs text-sky-700 underline">
              + Nueva venta
            </Link>
          </div>
          <div className="space-y-2">
            {ventas.map((o) => (
              <div key={o.id} className="rounded-2xl border border-borde bg-white p-3.5 shadow-sm">
                <p className="text-sm font-semibold">{nombreProductos(o)}</p>
                <p className="mb-2 text-xs text-piedra">
                  {o.monto_estimado ? `${dinero(o.monto_estimado, o.moneda)} · ` : ""}
                  vendido {fechaCorta(o.closed_at ?? o.created_at)}
                  {o.nro_factura ? ` · factura ${o.nro_factura}` : ""}
                  {" · "}
                  <Link href={`/oportunidades/${o.id}`} className="underline">
                    detalle
                  </Link>
                </p>
                <VentaPaso
                  oportunidadId={o.id}
                  estado={o.pedido_estado}
                  nroFactura={o.nro_factura}
                  entregaEstimada={o.entrega_estimada}
                  pedirSerie={serieFaltante.has(o.id)}
                  compacto
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Equipos */}
      <section className="rounded-2xl border border-borde bg-white p-3.5 shadow-sm">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-piedra">
          Equipos que tiene
        </h2>
        <div className="mb-3 space-y-2">
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
                  {e.numero_serie ? `Serie ${e.numero_serie}` : "Sin número de serie"}
                  {e.fecha_venta ? ` · comprado ${fechaCorta(e.fecha_venta)}` : ""}
                  {e.garantia_hasta && (
                    <span className={vigente ? "text-green-700" : "text-piedra"}>
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
              {r.producto?.nombre}: recompra cada {r.frecuencia_dias} días, próximo aviso{" "}
              {fechaCorta(r.proxima_alerta)}
              {r.ultima_compra ? ` (última hace ${diasDesde(r.ultima_compra)} días)` : ""}
            </p>
          ))}
          {equipos.length === 0 && recurrencias.length === 0 && (
            <p className="text-sm text-piedra">Ninguno cargado todavía.</p>
          )}
        </div>
        <EquipoForm clienteId={c.id} productos={productos} />
      </section>

      {/* Services */}
      <section className="rounded-2xl border border-borde bg-white p-3.5 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-piedra">Services</h2>
          <Link
            href={`/servicio/nueva?cliente=${c.id}`}
            className="text-xs text-sky-700 underline"
          >
            Programar uno
          </Link>
        </div>
        <div className="space-y-1.5">
          {ots.map((o) => {
            const est = ESTADOS_OT.find((e) => e.value === o.estado);
            return (
              <Link
                key={o.id}
                href={`/servicio/${o.id}`}
                className="block rounded-xl bg-crema px-3 py-2.5 text-sm"
              >
                <p className="font-medium">
                  {TIPO_OT[o.tipo] ?? o.tipo}{" "}
                  <span className="font-normal text-piedra">
                    · {fechaCorta(o.cerrada_tecnico_at ?? o.fecha_programada ?? o.created_at)} ·{" "}
                    {est?.label ?? o.estado}
                  </span>
                </p>
                {o.trabajo_realizado && (
                  <p className="truncate text-xs text-piedra">{o.trabajo_realizado}</p>
                )}
              </Link>
            );
          })}
          {ots.length === 0 && <p className="text-sm text-piedra">Sin services todavía.</p>}
        </div>
        <Link
          href={`/servicio/cargar?cliente=${c.id}`}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-borde py-2.5 text-sm font-medium text-tinta"
        >
          <Wrench className="h-4 w-4" /> Cargar service hecho
        </Link>
      </section>

      {/* Historial completo */}
      <section className="rounded-2xl border border-borde bg-white p-3.5 shadow-sm">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-piedra">
          Todo lo que pasó
        </h2>
        <div className="space-y-2">
          {actividades.map((a) => (
            <div key={a.id} className="flex gap-2 text-sm">
              <span className="w-20 shrink-0 text-xs text-piedra">
                {haceCuanto(a.created_at)}
              </span>
              <span className="text-tinta/80">
                {a.contenido}
                {a.created_by && nombres.get(a.created_by) ? (
                  <span className="text-piedra"> — {nombres.get(a.created_by)}</span>
                ) : null}
              </span>
            </div>
          ))}
          {actividades.length === 0 && (
            <p className="text-sm text-piedra">Todavía no hay nada anotado.</p>
          )}
        </div>
        {actividades.length >= 60 && (
          <p className="mt-2 text-xs text-piedra">Se muestran los últimos 60 movimientos.</p>
        )}
      </section>

      {/* Datos completos, plegados */}
      <details className="group">
        <summary className={sumario}>
          <span>
            Datos completos y facturación
            {(!c.cuit || !c.condicion_fiscal) && c.estado === "cliente_activo" ? (
              <span className="ml-2 font-normal text-amber-700">faltan datos fiscales</span>
            ) : null}
          </span>
          <span className="text-piedra transition-transform group-open:rotate-90">›</span>
        </summary>
        <div className="mt-2 space-y-3">
          <DatosClienteForm cliente={c} />
          <div className="grid gap-3 lg:grid-cols-2">
            <SucursalesCliente clienteId={c.id} sucursales={sucursales} />
            <DocumentosEntidad
              entidad="cliente"
              entidadId={c.id}
              documentos={documentos}
              puedeBorrar
            />
          </div>
          {perdidas.length > 0 && (
            <div className="rounded-2xl border border-borde bg-white p-3.5 shadow-sm">
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-piedra">
                Consultas que no se dieron
              </h3>
              {perdidas.map((o) => (
                <p key={o.id} className="text-sm text-piedra">
                  <Link href={`/oportunidades/${o.id}`} className="text-tinta hover:underline">
                    {nombreProductos(o)}
                  </Link>{" "}
                  · {fechaCorta(o.closed_at ?? o.created_at)}
                  {o.motivo_perdida ? ` · ${o.motivo_perdida}` : ""}
                </p>
              ))}
            </div>
          )}
          <div className="rounded-2xl border border-borde bg-white p-3.5 shadow-sm">
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-piedra">
              Nota fija de la ficha
            </h3>
            <NotaForm clienteId={c.id} />
          </div>
        </div>
      </details>

      {esGestor && <BorrarCliente clienteId={c.id} nombre={c.nombre_comercial} />}
    </div>
  );
}
