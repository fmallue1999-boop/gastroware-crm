import { plazosCaso } from "@/lib/casos";
import type { SupabaseServidor } from "@/lib/actions/comun";
import type { CasoVista } from "@/components/casos/CasoTarjeta";

const COLS =
  "id, numero, cliente_id, prioridad, descripcion, estado, created_at, primera_respuesta_at, derivado_at, cerrado_at, causa, solucion, ot_id, responsable_id, cliente:clientes(nombre_comercial, telefono), equipo:equipos(numero_serie, marca_modelo_libre, producto:productos(nombre)), ot:ordenes_trabajo!casos_ot_id_fkey(numero, estado, tecnico_id, aliado_id)";

type Fila = Omit<CasoVista, "equipo" | "responsable" | "ot" | "plazo"> & {
  derivado_at: string | null;
  responsable_id: string | null;
  equipo: { numero_serie: string | null; marca_modelo_libre: string | null; producto: { nombre: string } | null } | null;
  ot: { numero: number; estado: string; tecnico_id: string | null; aliado_id: string | null } | null;
};

/** Casos listos para mostrar, con los plazos calculados al momento. */
export async function cargarCasos(
  supabase: SupabaseServidor,
  opciones: { abiertos: boolean; responsableId?: string | null; clienteId?: string; limite?: number; ahora: number; hoy: string }
): Promise<CasoVista[]> {
  let q = supabase.from("casos").select(COLS);
  q = opciones.abiertos ? q.neq("estado", "cerrado") : q.eq("estado", "cerrado");
  if (opciones.responsableId) q = q.eq("responsable_id", opciones.responsableId);
  if (opciones.clienteId) q = q.eq("cliente_id", opciones.clienteId);
  q = q.order(opciones.abiertos ? "created_at" : "cerrado_at", { ascending: opciones.abiertos }).limit(opciones.limite ?? 200);
  const [{ data }, { data: us }] = await Promise.all([q, supabase.from("usuarios").select("id, nombre")]);
  const nombres = new Map(((us ?? []) as { id: string; nombre: string }[]).map((u) => [u.id, u.nombre]));
  return ((data ?? []) as unknown as Fila[]).map((c) => {
    const p = plazosCaso(
      { ...c, tecnico_asignado: Boolean(c.ot?.tecnico_id || c.ot?.aliado_id) },
      opciones.ahora,
      opciones.hoy
    );
    return {
      ...c,
      equipo: c.equipo ? [c.equipo.producto?.nombre ?? c.equipo.marca_modelo_libre, c.equipo.numero_serie ? `serie ${c.equipo.numero_serie}` : null].filter(Boolean).join(" · ") : null,
      responsable: c.responsable_id ? nombres.get(c.responsable_id) ?? null : null,
      ot: c.ot ? { numero: c.ot.numero, estado: c.ot.estado } : null,
      plazo: {
        respuestaVencida: p.respuestaVencida,
        venceTexto: p.vence.toLocaleString("es-AR", {
          timeZone: "America/Argentina/Buenos_Aires",
          weekday: "short",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
        diasAbierto: p.diasAbierto,
        cierreVencido: p.cierreVencido,
        paradoSinTecnico: p.paradoSinTecnico,
      },
    };
  });
}
