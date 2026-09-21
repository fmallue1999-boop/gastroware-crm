import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ESTADOS_OT, ESTADOS_OT_ACTIVOS } from "@/lib/constants";
import { fechaCorta, hoyISO } from "@/lib/format";

type OT = {
  id: string;
  numero: number;
  estado: string;
  tipo: string;
  fecha_programada: string | null;
  cerrada_tecnico_at: string | null;
  created_at: string;
  firma_path: string | null;
  trabajo_realizado: string | null;
  problema: string | null;
  cliente: { nombre_comercial: string } | null;
  equipo: { numero_serie: string | null; marca_modelo_libre: string | null; producto: { nombre: string } | null } | null;
};

const TIPO: Record<string, string> = {
  correctivo: "Reparación",
  preventivo: "Mantenimiento",
  instalacion: "Instalación",
  garantia: "Garantía",
};
const HECHOS = ["finalizado_tecnico", "revision_admin", "aprobado_facturar", "facturado", "cerrado"];

function Fila({ ot }: { ot: OT }) {
  const est = ESTADOS_OT.find((e) => e.value === ot.estado);
  const equipo = ot.equipo?.producto?.nombre ?? ot.equipo?.marca_modelo_libre;
  return (
    <Link href={`/servicio/${ot.id}`} className="block rounded-2xl border border-borde bg-white p-3 shadow-sm">
      <p className="text-[15px] font-semibold">{ot.cliente?.nombre_comercial ?? "Contacto"}</p>
      <p className="text-[15px] text-tinta/80">
        {TIPO[ot.tipo] ?? ot.tipo}
        {equipo ? ` · ${equipo}` : ""}
        {ot.equipo?.numero_serie ? ` (${ot.equipo.numero_serie})` : ""}
      </p>
      <p className="text-xs text-piedra">
        {fechaCorta(ot.cerrada_tecnico_at ?? ot.fecha_programada ?? ot.created_at)} · {est?.label ?? ot.estado} · N° {ot.numero}
      </p>
    </Link>
  );
}

/**
 * Inicio del técnico (Etapa 1, 1.3): cargar un service hecho, lo de hoy,
 * lo que falta cerrar, los próximos plegados y sus últimos services.
 */
export default async function InicioTecnico({ userId }: { userId: string }) {
  const supabase = await createClient();
  const hoy = hoyISO();
  const SELECT =
    "id, numero, estado, tipo, fecha_programada, cerrada_tecnico_at, created_at, firma_path, trabajo_realizado, problema, cliente:clientes(nombre_comercial), equipo:equipos(numero_serie, marca_modelo_libre, producto:productos(nombre))";

  const [{ data: deHoy }, { data: abiertas }, { data: proximas }, { data: ultimas }] = await Promise.all([
    supabase
      .from("ordenes_trabajo")
      .select(SELECT)
      .eq("tecnico_id", userId)
      .eq("fecha_programada", hoy)
      .in("estado", [...ESTADOS_OT_ACTIVOS])
      .order("created_at"),
    supabase
      .from("ordenes_trabajo")
      .select(SELECT)
      .eq("tecnico_id", userId)
      .in("estado", ["en_proceso", "devuelto_tecnico", "esperando_repuesto", "esperando_cliente", "finalizado_tecnico"])
      .order("created_at"),
    supabase
      .from("ordenes_trabajo")
      .select(SELECT)
      .or(`tecnico_id.eq.${userId},tecnico_id.is.null`)
      .gt("fecha_programada", hoy)
      .in("estado", [...ESTADOS_OT_ACTIVOS])
      .order("fecha_programada")
      .limit(30),
    supabase
      .from("ordenes_trabajo")
      .select(SELECT)
      .eq("tecnico_id", userId)
      .in("estado", HECHOS)
      .order("cerrada_tecnico_at", { ascending: false })
      .limit(10),
  ]);

  const hoyLista = (deHoy ?? []) as unknown as OT[];
  // Falta cerrar: en proceso, o cerradas por el técnico sin firma
  const pendientes = ((abiertas ?? []) as unknown as OT[]).filter(
    (ot) => ot.estado !== "finalizado_tecnico" || !ot.firma_path
  );
  const proximos = (proximas ?? []) as unknown as OT[];
  const ultimos = (ultimas ?? []) as unknown as OT[];

  return (
    <div className="space-y-4">
      <Link
        href="/servicio/cargar"
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-marino py-3.5 text-base font-semibold text-white shadow-sm"
      >
        <Plus className="h-5 w-5" strokeWidth={2.5} /> Cargar service hecho
      </Link>

      {hoyLista.length > 0 && (
        <section>
          <h2 className="mb-2 text-[15px] font-semibold">Hoy ({hoyLista.length})</h2>
          <div className="space-y-2">
            {hoyLista.map((ot) => (
              <Fila key={ot.id} ot={ot} />
            ))}
          </div>
        </section>
      )}

      {pendientes.length > 0 && (
        <section>
          <h2 className="mb-2 text-[15px] font-semibold text-ambar">Pendientes de cerrar ({pendientes.length})</h2>
          <div className="space-y-2">
            {pendientes.map((ot) => (
              <Fila key={ot.id} ot={ot} />
            ))}
          </div>
        </section>
      )}

      {hoyLista.length === 0 && pendientes.length === 0 && (
        <p className="text-[15px] text-piedra">Al día.</p>
      )}

      {proximos.length > 0 && (
        <details className="group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-[15px] font-semibold text-piedra [&::-webkit-details-marker]:hidden">
            Próximos ({proximos.length})
            <span className="transition-transform group-open:rotate-90">›</span>
          </summary>
          <div className="mt-2 space-y-2">
            {proximos.map((ot) => (
              <Fila key={ot.id} ot={ot} />
            ))}
          </div>
        </details>
      )}

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-piedra">Mis últimos services</h2>
        <div className="space-y-2">
          {ultimos.map((ot) => (
            <Fila key={ot.id} ot={ot} />
          ))}
          {ultimos.length === 0 && (
            <p className="text-[15px] text-piedra">Todavía no cargaste services. El botón de arriba es para eso.</p>
          )}
        </div>
      </section>
    </div>
  );
}
