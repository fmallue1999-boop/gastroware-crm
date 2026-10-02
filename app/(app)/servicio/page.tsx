import Link from "next/link";
import { CalendarPlus, ChevronDown, Plus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { hoyISO, fechaCorta, dinero } from "@/lib/format";
import { ESTADOS_OT_ACTIVOS } from "@/lib/constants";
import { controlaServicio, factura, veTodo } from "@/lib/puestos";
import { EstadoOTBadge } from "@/components/Badges";
import type { OrdenTrabajo, Usuario } from "@/lib/types";
import AyudaLink from "@/components/guia/AyudaLink";

const TIPO: Record<string, string> = {
  correctivo: "Reparación",
  preventivo: "Mantenimiento",
  instalacion: "Instalación",
  garantia: "Garantía",
};
const HECHOS = ["finalizado_tecnico", "revision_admin", "aprobado_facturar", "facturado", "cerrado"];
const SIN_ASIGNAR = ["solicitud_recibida", "pendiente_revision", "pendiente_asignacion"];
const PRIORIDAD_ORDEN: Record<string, number> = { urgente: 0, alta: 1, normal: 2, baja: 3 };
const SELECT =
  "*, cliente:clientes(*), equipo:equipos(*, producto:productos(*)), tecnico:usuarios!ordenes_trabajo_tecnico_id_fkey(id, nombre), aliado:tecnicos_aliados(nombre)";

type OTLista = OrdenTrabajo & { aliado?: { nombre: string } | null };

function Tarjeta({ ot, hoy }: { ot: OTLista; hoy: string }) {
  const atrasada = ot.fecha_programada && ot.fecha_programada < hoy && (ESTADOS_OT_ACTIVOS as readonly string[]).includes(ot.estado);
  const esperaCobro = ot.presupuesto_monto != null && !ot.cobro_ok_at && !HECHOS.includes(ot.estado);
  return (
    <Link href={`/servicio/${ot.id}`} className="block rounded-2xl bg-white p-3.5 shadow-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[16px] font-extrabold">{ot.cliente?.nombre_comercial}</span>
        <EstadoOTBadge estado={ot.estado} />
        {ot.prioridad === "urgente" && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">parado</span>}
        {atrasada && <span className="text-xs font-bold text-ambar">pasó la fecha</span>}
        {esperaCobro && <span className="text-xs font-bold text-ambar">espera cobro</span>}
      </div>
      <p className="mt-1 text-[15px] text-tinta/80">
        {TIPO[ot.tipo] ?? ot.tipo}
        {ot.equipo ? ` · ${ot.equipo.producto?.nombre ?? ot.equipo.marca_modelo_libre}${ot.equipo.numero_serie ? ` (${ot.equipo.numero_serie})` : ""}` : ""}
      </p>
      {(ot.trabajo_realizado || ot.problema) && <p className="truncate text-xs text-piedra">{ot.trabajo_realizado ?? ot.problema}</p>}
      <p className="mt-0.5 text-xs text-piedra">
        {fechaCorta(ot.cerrada_tecnico_at ?? ot.fecha_programada ?? ot.created_at)}
        {ot.tecnico ? ` · ${ot.tecnico.nombre}` : ot.aliado ? ` · aliado ${ot.aliado.nombre}` : " · sin técnico"}
        {ot.remito_nro ? ` · remito ${ot.remito_nro}` : ""}
        {ot.total != null ? ` · ${dinero(ot.total)}` : ""}
        {` · N° ${ot.numero}`}
      </p>
    </Link>
  );
}

function Grupo({ titulo, lista, hoy, color = "text-piedra" }: { titulo: string; lista: OTLista[]; hoy: string; color?: string }) {
  if (!lista.length) return null;
  return (
    <section>
      <h2 className={`mb-2 text-xs font-bold uppercase tracking-wide ${color}`}>
        {titulo} ({lista.length})
      </h2>
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        {lista.map((ot) => (
          <Tarjeta key={ot.id} ot={ot} hoy={hoy} />
        ))}
      </div>
    </section>
  );
}

/**
 * Services por puesto (manual 4.3): para asignar (técnico propio o aliado),
 * remitos para controlar, para facturar, garantías con fábrica, los
 * próximos por prioridad y, plegados, los hechos.
 */
export default async function ServiciosPage() {
  const supabase = await createClient();
  const hoy = hoyISO();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: yo } = await supabase.from("usuarios").select("*").eq("id", user!.id).single();
  const rol = (yo as Usuario | null)?.rol ?? "comercial";
  const controla = controlaServicio(rol);
  const administra = factura(rol);

  let qProx = supabase
    .from("ordenes_trabajo")
    .select(SELECT)
    .in("estado", [...SIN_ASIGNAR, ...ESTADOS_OT_ACTIVOS])
    .order("fecha_programada", { ascending: true, nullsFirst: false })
    .limit(200);
  if (rol === "tecnico") qProx = qProx.or(`tecnico_id.eq.${user!.id},tecnico_id.is.null`);

  let qHechos = supabase.from("ordenes_trabajo").select(SELECT).in("estado", HECHOS).order("cerrada_tecnico_at", { ascending: false }).limit(60);
  if (rol === "tecnico") qHechos = qHechos.eq("tecnico_id", user!.id);

  const [{ data: proxData }, { data: hechosData }, controlRes, garantiasRes] = await Promise.all([
    qProx,
    qHechos,
    controla || administra
      ? supabase.from("ordenes_trabajo").select(SELECT).in("estado", ["finalizado_tecnico", "revision_admin", "aprobado_facturar"]).order("cerrada_tecnico_at").limit(100)
      : Promise.resolve({ data: [] }),
    controla
      ? supabase.from("ordenes_trabajo").select(SELECT).in("garantia_reclamo", ["a_presentar", "presentado", "repuesto_recibido"]).limit(100)
      : Promise.resolve({ data: [] }),
  ]);
  const todos = (proxData ?? []) as unknown as OTLista[];
  const orden = (a: OTLista, b: OTLista) =>
    (PRIORIDAD_ORDEN[a.prioridad] ?? 2) - (PRIORIDAD_ORDEN[b.prioridad] ?? 2) ||
    (a.fecha_programada ?? "9999").localeCompare(b.fecha_programada ?? "9999");
  const sinAsignar = todos.filter((o) => SIN_ASIGNAR.includes(o.estado) && !o.tecnico_id && !o.aliado_id).sort(orden);
  const proximos = todos.filter((o) => !sinAsignar.includes(o)).sort(orden);
  const hechos = (hechosData ?? []) as unknown as OTLista[];
  const control = (controlRes.data ?? []) as unknown as OTLista[];
  const paraControlar = control.filter((o) => o.estado !== "aprobado_facturar");
  const paraFacturar = control.filter((o) => o.estado === "aprobado_facturar");
  const garantias = (garantiasRes.data ?? []) as unknown as OTLista[];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex flex-wrap items-center gap-x-2 text-2xl font-extrabold tracking-tight">
          Services <AyudaLink tarea={rol === "tecnico" ? "cerrar-trabajo" : "asignar-service"} />
        </h1>
        <div className="flex flex-wrap gap-2">
          {veTodo(rol) && (
            <Link href="/servicio/aliados" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-borde bg-white px-3.5 text-[15px] font-bold shadow-sm">
              <Users className="h-4 w-4" /> Aliados
            </Link>
          )}
          {controla || rol === "tecnico" ? (
            <>
              <Link href="/servicio/nueva" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-borde bg-white px-3.5 text-[15px] font-bold shadow-sm">
                <CalendarPlus className="h-4 w-4" /> Programar
              </Link>
              <Link href="/servicio/cargar" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-marino px-4 text-[15px] font-extrabold text-white shadow-sm">
                <Plus className="h-4 w-4" strokeWidth={2.6} /> Cargar hecho
              </Link>
            </>
          ) : (
            <Link href="/casos/nuevo" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-marino px-4 text-[15px] font-extrabold text-white shadow-sm">
              <Plus className="h-4 w-4" strokeWidth={2.6} /> Abrir caso (reclamo)
            </Link>
          )}
        </div>
      </div>

      {controla && <Grupo titulo="Para asignar: técnico propio o aliado" lista={sinAsignar} hoy={hoy} color="text-red-700" />}
      {controla && <Grupo titulo="Remitos para controlar" lista={paraControlar} hoy={hoy} color="text-ambar" />}
      {administra && <Grupo titulo="Remitos aprobados para facturar" lista={paraFacturar} hoy={hoy} color="text-violeta" />}
      {controla && <Grupo titulo="Garantías con fábrica" lista={garantias} hoy={hoy} color="text-azul" />}

      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-piedra">
          {rol === "tecnico" ? "Mis trabajos, por prioridad" : "Próximos"} ({proximos.length + (controla ? 0 : sinAsignar.length)})
        </h2>
        {proximos.length + (controla ? 0 : sinAsignar.length) === 0 ? (
          <p className="rounded-2xl border border-dashed border-borde p-6 text-center text-[15px] text-piedra">
            Nada programado. Cuando termines uno, cargalo con “Cargar hecho”.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {[...(controla ? [] : sinAsignar), ...proximos].map((ot) => (
              <Tarjeta key={ot.id} ot={ot} hoy={hoy} />
            ))}
          </div>
        )}
      </section>

      {hechos.length > 0 && (
        <details className="group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-[15px] font-bold text-piedra [&::-webkit-details-marker]:hidden">
            Hechos ({hechos.length})
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-2 grid gap-2 lg:grid-cols-2">
            {hechos.map((ot) => (
              <Tarjeta key={ot.id} ot={ot} hoy={hoy} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
