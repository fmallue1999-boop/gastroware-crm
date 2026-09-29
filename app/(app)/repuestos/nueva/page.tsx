import { createClient } from "@/lib/supabase/server";
import SolicitudRepuestoForm from "@/components/repuestos/SolicitudRepuestoForm";
import AyudaLink from "@/components/guia/AyudaLink";

export const metadata = { title: "Solicitud de repuesto" };

/**
 * Nueva solicitud de repuesto. ?cliente= la precarga desde la ficha; ?caso=
 * o ?ot= desde un caso o un service (cliente y equipo sin volver a cargarlos).
 */
export default async function NuevaSolicitudRepuestoPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string; caso?: string; ot?: string; equipo?: string }>;
}) {
  const p = await searchParams;
  const uuid = /^[0-9a-f-]{36}$/i;
  const supabase = await createClient();

  // Desde un caso o un service: cliente, equipo y lo que pasó
  let clienteId = uuid.test(p.cliente ?? "") ? p.cliente! : null;
  let equipoId = uuid.test(p.equipo ?? "") ? p.equipo! : null;
  const descripcion = "";
  const casoId = uuid.test(p.caso ?? "") ? p.caso! : null;
  const otId = uuid.test(p.ot ?? "") ? p.ot! : null;
  if (casoId) {
    const { data } = await supabase.from("casos").select("cliente_id, equipo_id").eq("id", casoId).maybeSingle();
    if (data) {
      clienteId = data.cliente_id as string;
      equipoId = (data.equipo_id as string | null) ?? equipoId;
    }
  } else if (otId) {
    const { data } = await supabase.from("ordenes_trabajo").select("cliente_id, equipo_id").eq("id", otId).maybeSingle();
    if (data) {
      clienteId = data.cliente_id as string;
      equipoId = (data.equipo_id as string | null) ?? equipoId;
    }
  }

  const [
    {
      data: { user },
    },
    { data: catalogo },
    { data: personas },
    clienteRes,
    productosRepRes,
    equiposRes,
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("repuestos").select("id, descripcion, codigo_interno, stock, precio, moneda").eq("activo", true).is("deleted_at", null).order("descripcion").limit(1000),
    supabase.from("usuarios").select("id, nombre, rol").eq("activo", true).order("nombre"),
    clienteId ? supabase.from("clientes").select("id, nombre_comercial").eq("id", clienteId).maybeSingle() : Promise.resolve({ data: null }),
    // Productos del catálogo que son repuestos (también se pueden pedir)
    supabase.from("productos").select("id, nombre, precio_referencia, moneda, precio_ars, precio_usd, stock").eq("activo", true).in("categoria", ["repuesto", "refaccion"]).order("nombre"),
    clienteId
      ? supabase.from("equipos").select("id, numero_serie, marca_modelo_libre, producto:productos(nombre, es_consumible, categoria)").eq("cliente_id", clienteId).is("deleted_at", null)
      : Promise.resolve({ data: [] }),
  ]);
  const cliente = clienteRes.data as { id: string; nombre_comercial: string } | null;
  const equipos = ((equiposRes.data ?? []) as unknown as { id: string; numero_serie: string | null; marca_modelo_libre: string | null; producto: { nombre: string; es_consumible: boolean; categoria: string } | null }[])
    .filter((e) => !e.producto?.es_consumible && e.producto?.categoria !== "repuesto")
    .map((e) => ({ id: e.id, nombre: e.producto?.nombre ?? e.marca_modelo_libre ?? "Equipo", serie: e.numero_serie }));

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="flex flex-wrap items-center gap-x-2 text-2xl font-extrabold tracking-tight">
          Solicitud de repuesto <AyudaLink tarea="repuestos" />
        </h1>
        <p className="text-[15px] text-piedra">
          {casoId ? "Desde un caso: el cliente y el equipo ya están cargados." : otId ? "Desde un service: el cliente y el equipo ya están cargados." : "Qué pieza necesita, para qué equipo, y si servicio técnico tiene que confirmarla."}
        </p>
      </div>
      <SolicitudRepuestoForm
        yo={user?.id ?? ""}
        catalogo={(catalogo ?? []) as { id: string; descripcion: string; codigo_interno: string | null; stock: number | null; precio: number | null; moneda: string | null }[]}
        productosRepuesto={(productosRepRes.data ?? []) as { id: string; nombre: string; precio_referencia: number | null; moneda: string; precio_ars: number | null; precio_usd: number | null; stock: number | null }[]}
        personas={(personas ?? []) as { id: string; nombre: string; rol: string }[]}
        clienteInicial={cliente ? { id: cliente.id, nombre: cliente.nombre_comercial } : null}
        equiposIniciales={equipos}
        equipoInicial={equipoId}
        casoId={casoId}
        otId={otId}
        descripcionInicial={descripcion}
      />
    </div>
  );
}
