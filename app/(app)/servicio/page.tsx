import Link from "next/link";
import { CalendarPlus, ChevronDown, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { hoyISO, fechaCorta, dinero } from "@/lib/format";
import { ESTADOS_OT_ACTIVOS } from "@/lib/constants";
import { EstadoOTBadge } from "@/components/Badges";
import type { OrdenTrabajo, Usuario } from "@/lib/types";

const TIPO: Record<string, string> = {
  correctivo: "Reparación",
  preventivo: "Mantenimiento",
  instalacion: "Instalación",
  garantia: "Garantía",
};
const HECHOS = ["finalizado_tecnico", "revision_admin", "aprobado_facturar", "facturado", "cerrado"];
const SELECT =
  "*, cliente:clientes(*), equipo:equipos(*, producto:productos(*)), tecnico:usuarios!ordenes_trabajo_tecnico_id_fkey(id, nombre)";

function Tarjeta({ ot, hoy }: { ot: OrdenTrabajo; hoy: string }) {
  const atrasada = ot.fecha_programada && ot.fecha_programada < hoy && (ESTADOS_OT_ACTIVOS as readonly string[]).includes(ot.estado);
  return (
    <Link href={`/servicio/${ot.id}`} className="block rounded-2xl bg-white p-3.5 shadow-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[16px] font-extrabold">{ot.cliente?.nombre_comercial}</span>
        <EstadoOTBadge estado={ot.estado} />
        {atrasada && <span className="text-xs font-bold text-ambar">pasó la fecha</span>}
      </div>
      <p className="mt-1 text-[15px] text-tinta/80">
        {TIPO[ot.tipo] ?? ot.tipo}
        {ot.equipo ? ` · ${ot.equipo.producto?.nombre ?? ot.equipo.marca_modelo_libre}${ot.equipo.numero_serie ? ` (${ot.equipo.numero_serie})` : ""}` : ""}
      </p>
      {(ot.trabajo_realizado || ot.problema) && <p className="truncate text-xs text-piedra">{ot.trabajo_realizado ?? ot.problema}</p>}
      <p className="mt-0.5 text-xs text-piedra">
        {fechaCorta(ot.cerrada_tecnico_at ?? ot.fecha_programada ?? ot.created_at)}
        {ot.tecnico ? ` · ${ot.tecnico.nombre}` : " · sin técnico"}
        {ot.total != null ? ` · ${dinero(ot.total)}` : ""}
        {` · N° ${ot.numero}`}
      </p>
    </Link>
  );
}

/** Services: los próximos, los que hay que revisar y cobrar (gestores) y, plegados, los hechos. */
export default async function ServiciosPage() {
  const supabase = await createClient();
  const hoy = hoyISO();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: yo } = await supabase.from("usuarios").select("*").eq("id", user!.id).single();
  const rol = (yo as Usuario | null)?.rol ?? "comercial";
  const esGestor = ["direccion", "admin"].includes(rol);

  let qProx = supabase
    .from("ordenes_trabajo")
    .select(SELECT)
    .in("estado", ["solicitud_recibida", "pendiente_revision", "pendiente_asignacion", ...ESTADOS_OT_ACTIVOS])
    .order("fecha_programada", { ascending: true, nullsFirst: false })
    .limit(150);
  if (rol === "tecnico") qProx = qProx.or(`tecnico_id.eq.${user!.id},tecnico_id.is.null`);

  let qHechos = supabase.from("ordenes_trabajo").select(SELECT).in("estado", HECHOS).order("cerrada_tecnico_at", { ascending: false }).limit(60);
  if (rol === "tecnico") qHechos = qHechos.eq("tecnico_id", user!.id);

  const [{ data: proxData }, { data: hechosData }, cobrarRes] = await Promise.all([
    qProx,
    qHechos,
    esGestor
      ? supabase.from("ordenes_trabajo").select(SELECT).in("estado", ["finalizado_tecnico", "revision_admin", "aprobado_facturar"]).order("cerrada_tecnico_at", { ascending: false }).limit(100)
      : Promise.resolve({ data: [] }),
  ]);
  const proximos = (proxData ?? []) as unknown as OrdenTrabajo[];
  const hechos = (hechosData ?? []) as unknown as OrdenTrabajo[];
  const cobrar = (cobrarRes.data ?? []) as unknown as OrdenTrabajo[];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight">Services</h1>
        <div className="flex gap-2">
          <Link href="/servicio/nueva" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-borde bg-white px-3.5 text-[15px] font-bold shadow-sm">
            <CalendarPlus className="h-4 w-4" /> Programar
          </Link>
          <Link href="/servicio/cargar" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-marino px-4 text-[15px] font-extrabold text-white shadow-sm">
            <Plus className="h-4 w-4" strokeWidth={2.6} /> Cargar hecho
          </Link>
        </div>
      </div>

      {esGestor && cobrar.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-ambar">Para revisar y cobrar ({cobrar.length})</h2>
          <div className="grid gap-2 lg:grid-cols-2">
            {cobrar.map((ot) => (
              <Tarjeta key={ot.id} ot={ot} hoy={hoy} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-piedra">Próximos ({proximos.length})</h2>
        {proximos.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-borde p-6 text-center text-[15px] text-piedra">
            Nada programado. Cuando termines uno, cargalo con “Cargar hecho”.
          </p>
        ) : (
          <div className="grid gap-2 lg:grid-cols-2">
            {proximos.map((ot) => (
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
