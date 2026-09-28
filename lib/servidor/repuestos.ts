import { firmarUrls } from "@/lib/core/storage";
import { estadoRepuesto, type EstadoRepuesto } from "@/lib/repuestos";
import type { SupabaseServidor } from "@/lib/actions/comun";

/**
 * Solicitudes de repuesto (migración 032) con la sesión del usuario: las
 * ve quien ve la operación, y quien tiene que validarlas.
 */

export type SolicitudVista = {
  oportunidad_id: string;
  cliente_id: string;
  cliente: { nombre_comercial: string; telefono: string | null } | null;
  /** Persona principal del cliente (para saludar por el nombre). */
  contacto: string | null;
  equipo_id: string | null;
  equipoTexto: string | null;
  numero_serie: string | null;
  repuesto_id: string | null;
  repuesto: { descripcion: string; codigo_interno: string | null; stock: number | null } | null;
  descripcion: string;
  codigo: string | null;
  fotoUrl: string | null;
  cantidad: number;
  validacion: string;
  validador_id: string | null;
  validador: string | null;
  validado_por_nombre: string | null;
  validacion_nota: string | null;
  disponibilidad: string | null;
  plazo_dias: number | null;
  precio_unitario: number | null;
  moneda: string;
  caso_id: string | null;
  ot_id: string | null;
  created_at: string;
  etapa: string;
  comercial_id: string | null;
  comercial: string | null;
  proximo_contacto: string | null;
  proxima_accion: string | null;
  motivo_perdida: string | null;
  pedido_estado: string | null;
  estado: EstadoRepuesto;
};

const COLS =
  "oportunidad_id, cliente_id, equipo_id, modelo_texto, numero_serie, repuesto_id, descripcion, codigo, foto_path, cantidad, validacion, validador_id, validado_por, validacion_nota, disponibilidad, plazo_dias, precio_unitario, moneda, caso_id, ot_id, created_at, cliente:clientes(nombre_comercial, telefono), equipo:equipos(numero_serie, marca_modelo_libre, producto:productos(nombre)), repuesto:repuestos(descripcion, codigo_interno, stock), opp:oportunidades(etapa, comercial_id, proximo_contacto, proxima_accion, motivo_perdida, pedido_estado, deleted_at)";

type Fila = {
  oportunidad_id: string;
  cliente_id: string;
  equipo_id: string | null;
  modelo_texto: string | null;
  numero_serie: string | null;
  repuesto_id: string | null;
  descripcion: string;
  codigo: string | null;
  foto_path: string | null;
  cantidad: number;
  validacion: string;
  validador_id: string | null;
  validado_por: string | null;
  validacion_nota: string | null;
  disponibilidad: string | null;
  plazo_dias: number | null;
  precio_unitario: number | null;
  moneda: string;
  caso_id: string | null;
  ot_id: string | null;
  created_at: string;
  cliente: { nombre_comercial: string; telefono: string | null } | null;
  equipo: { numero_serie: string | null; marca_modelo_libre: string | null; producto: { nombre: string } | null } | null;
  repuesto: { descripcion: string; codigo_interno: string | null; stock: number | null } | null;
  opp: {
    etapa: string;
    comercial_id: string | null;
    proximo_contacto: string | null;
    proxima_accion: string | null;
    motivo_perdida: string | null;
    pedido_estado: string | null;
    deleted_at: string | null;
  } | null;
};

export async function cargarSolicitudes(
  supabase: SupabaseServidor,
  opciones: { clienteId?: string; validador?: string; oportunidadId?: string; limite?: number } = {}
): Promise<SolicitudVista[]> {
  let q = supabase.from("solicitudes_repuesto").select(COLS).order("created_at", { ascending: false }).limit(opciones.limite ?? 500);
  if (opciones.clienteId) q = q.eq("cliente_id", opciones.clienteId);
  if (opciones.validador) q = q.eq("validador_id", opciones.validador);
  if (opciones.oportunidadId) q = q.eq("oportunidad_id", opciones.oportunidadId);
  const [{ data }, { data: usuarios }] = await Promise.all([q, supabase.from("usuarios").select("id, nombre")]);
  const nombres = new Map(((usuarios ?? []) as { id: string; nombre: string }[]).map((u) => [u.id, u.nombre]));
  const filas = ((data ?? []) as unknown as Fila[]).filter((f) => !f.opp?.deleted_at);
  const [urls, { data: personas }] = await Promise.all([
    firmarUrls("servicio", filas.map((f) => f.foto_path)),
    filas.length
      ? supabase
          .from("contactos")
          .select("cliente_id, nombre")
          .in("cliente_id", [...new Set(filas.map((f) => f.cliente_id))])
          .is("deleted_at", null)
          .order("es_decisor", { ascending: false })
          .order("created_at")
      : Promise.resolve({ data: [] }),
  ]);
  const personaDe = new Map<string, string>();
  for (const p of (personas ?? []) as { cliente_id: string; nombre: string }[]) if (!personaDe.has(p.cliente_id)) personaDe.set(p.cliente_id, p.nombre);
  return filas.map((f, i) => ({
    oportunidad_id: f.oportunidad_id,
    cliente_id: f.cliente_id,
    cliente: f.cliente,
    contacto: personaDe.get(f.cliente_id) ?? null,
    equipo_id: f.equipo_id,
    equipoTexto: f.equipo?.producto?.nombre ?? f.equipo?.marca_modelo_libre ?? f.modelo_texto ?? null,
    numero_serie: f.numero_serie ?? f.equipo?.numero_serie ?? null,
    repuesto_id: f.repuesto_id,
    repuesto: f.repuesto,
    descripcion: f.descripcion,
    codigo: f.codigo ?? f.repuesto?.codigo_interno ?? null,
    fotoUrl: urls[i],
    cantidad: Number(f.cantidad),
    validacion: f.validacion,
    validador_id: f.validador_id,
    validador: f.validador_id ? nombres.get(f.validador_id) ?? null : null,
    validado_por_nombre: f.validado_por ? nombres.get(f.validado_por) ?? null : null,
    validacion_nota: f.validacion_nota,
    disponibilidad: f.disponibilidad,
    plazo_dias: f.plazo_dias,
    precio_unitario: f.precio_unitario == null ? null : Number(f.precio_unitario),
    moneda: f.moneda,
    caso_id: f.caso_id,
    ot_id: f.ot_id,
    created_at: f.created_at,
    etapa: f.opp?.etapa ?? "nueva",
    comercial_id: f.opp?.comercial_id ?? null,
    comercial: f.opp?.comercial_id ? nombres.get(f.opp.comercial_id) ?? null : null,
    proximo_contacto: f.opp?.proximo_contacto ?? null,
    proxima_accion: f.opp?.proxima_accion ?? null,
    motivo_perdida: f.opp?.motivo_perdida ?? null,
    pedido_estado: f.opp?.pedido_estado ?? null,
    estado: estadoRepuesto(f.opp?.etapa ?? "nueva", f.validacion),
  }));
}
