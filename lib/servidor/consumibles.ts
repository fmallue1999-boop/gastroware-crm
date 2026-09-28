import { masDias } from "@/lib/agenda";
import type { SupabaseServidor } from "@/lib/actions/comun";

/**
 * Planes de reposición de consumibles (tabla recurrencias, migración 031)
 * con la sesión del usuario: RLS deja ver los de los clientes que ve.
 */

export type PlanVista = {
  id: string;
  cliente_id: string;
  producto_id: string;
  sucursal_id: string | null;
  frecuencia_dias: number | null;
  anticipacion_dias: number;
  ultima_compra: string | null;
  ultima_cantidad: number | null;
  unidad: string | null;
  proxima_alerta: string;
  responsable_id: string | null;
  activa: boolean;
  motivo_suspension: string | null;
  cliente: { nombre_comercial: string; telefono: string | null } | null;
  producto: { nombre: string } | null;
  sucursal: { nombre: string; ciudad: string | null } | null;
  responsable: string | null;
};

const COLS =
  "id, cliente_id, producto_id, sucursal_id, frecuencia_dias, anticipacion_dias, ultima_compra, ultima_cantidad, unidad, proxima_alerta, responsable_id, activa, motivo_suspension, cliente:clientes!inner(nombre_comercial, telefono, deleted_at), producto:productos(nombre), sucursal:sucursales(nombre, ciudad)";

export async function cargarPlanes(
  supabase: SupabaseServidor,
  opciones: { hasta?: string; desde?: string; responsable?: string | null; clienteId?: string; incluirSuspendidos?: boolean } = {}
): Promise<PlanVista[]> {
  let q = supabase.from("recurrencias").select(COLS).is("cliente.deleted_at", null).order("proxima_alerta").limit(2000);
  if (!opciones.incluirSuspendidos) q = q.eq("activa", true);
  if (opciones.hasta) q = q.lte("proxima_alerta", opciones.hasta);
  if (opciones.desde) q = q.gte("proxima_alerta", opciones.desde);
  if (opciones.responsable) q = q.eq("responsable_id", opciones.responsable);
  if (opciones.clienteId) q = q.eq("cliente_id", opciones.clienteId);
  const [{ data }, { data: usuarios }] = await Promise.all([q, supabase.from("usuarios").select("id, nombre")]);
  const nombres = new Map(((usuarios ?? []) as { id: string; nombre: string }[]).map((u) => [u.id, u.nombre]));
  return ((data ?? []) as unknown as Omit<PlanVista, "responsable">[]).map((p) => ({
    ...p,
    ultima_cantidad: p.ultima_cantidad == null ? null : Number(p.ultima_cantidad),
    responsable: p.responsable_id ? nombres.get(p.responsable_id) ?? null : null,
  }));
}

/** Números del apartado: ventas del mes, para contactar y próximos 30 días. */
export async function numerosConsumibles(supabase: SupabaseServidor, hoy: string) {
  const inicioMes = `${hoy.slice(0, 8)}01`;
  const [{ count: ventasMes }, { count: paraContactar }, { count: proximos }] = await Promise.all([
    supabase
      .from("oportunidades")
      .select("id", { count: "exact", head: true })
      .eq("linea", "consumibles")
      .eq("etapa", "ganada")
      .gte("closed_at", `${inicioMes}T03:00:00.000Z`),
    supabase.from("recurrencias").select("id", { count: "exact", head: true }).eq("activa", true).lte("proxima_alerta", hoy),
    supabase
      .from("recurrencias")
      .select("id", { count: "exact", head: true })
      .eq("activa", true)
      .gt("proxima_alerta", hoy)
      .lte("proxima_alerta", masDias(hoy, 30)),
  ]);
  return { ventasMes: ventasMes ?? 0, paraContactar: paraContactar ?? 0, proximos: proximos ?? 0 };
}
