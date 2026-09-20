import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { ETAPAS_ABIERTAS } from "@/lib/constants";
import { hoyISO, sumarDias, telefonoProlijo } from "@/lib/format";
import FiltrosMovimientos from "@/components/FiltrosMovimientos";

type Mov = {
  id: string;
  cliente_id: string;
  tipo: string;
  contenido: string | null;
  created_by: string | null;
  created_at: string;
  cliente: { nombre_comercial: string } | null;
};
type Resumen = {
  estado: string;
  telefono: string | null;
  rubro: string | null;
  ciudad: string | null;
  interes: string | null;
};

/** Qué tipos de actividad entran en cada filtro de la pantalla. */
const TIPOS_POR_FILTRO: Record<string, string[]> = {
  interes: ["interes", "cambio_etapa", "feria", "stock"],
  cotizacion: ["cotizacion"],
  venta: ["pedido"],
  service: ["service"],
  nota: ["nota"],
};

function diaDe(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

function horaDe(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function tituloDia(dia: string): string {
  const hoy = hoyISO();
  if (dia === hoy) return "Hoy";
  if (dia === sumarDias(-1)) return "Ayer";
  const d = new Date(dia + "T12:00:00");
  const t = d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const esUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

/**
 * Movimientos (Etapa 1, 1.7): todo lo que hizo el equipo, en orden, con
 * filtros por persona y por tipo. Cada línea lleva a la ficha; en PC, al
 * pasar el mouse se ve un resumen del contacto.
 */
export default async function MovimientosPage({
  searchParams,
}: {
  searchParams: Promise<{ quien?: string; tipo?: string }>;
}) {
  const { quien, tipo } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: yo } = await supabase.from("usuarios").select("rol").eq("id", user?.id ?? "").maybeSingle();
  const esGestor = ["direccion", "admin"].includes(yo?.rol ?? "");

  let query = supabase
    .from("actividades")
    .select("id, cliente_id, tipo, contenido, created_by, created_at, cliente:clientes(nombre_comercial)")
    .order("created_at", { ascending: false })
    .limit(150);
  if (quien === "yo" && user) query = query.eq("created_by", user.id);
  else if (quien && esUuid(quien)) query = query.eq("created_by", quien);
  const tipos = tipo ? TIPOS_POR_FILTRO[tipo] : null;
  if (tipos) query = query.in("tipo", tipos);

  const [{ data }, { data: usuariosData }] = await Promise.all([
    query,
    supabase.from("usuarios").select("id, nombre, rol, activo"),
  ]);
  const movimientos = (data ?? []) as unknown as Mov[];
  const usuarios = (usuariosData ?? []) as { id: string; nombre: string; rol: string; activo: boolean }[];
  const nombres = new Map(usuarios.map((u) => [u.id, u.nombre]));
  const vendedores = usuarios.filter((u) => u.activo && ["comercial", "direccion", "admin"].includes(u.rol));
  const tecnicos = usuarios.filter((u) => u.activo && u.rol === "tecnico");

  // Resumen del contacto para el panel lateral (PC)
  const ids = Array.from(new Set(movimientos.map((m) => m.cliente_id)));
  const resumen = new Map<string, Resumen>();
  if (ids.length) {
    const [{ data: clis }, { data: opps }] = await Promise.all([
      supabase
        .from("clientes")
        .select("id, estado, telefono, rubro, sucursales(ciudad, es_principal)")
        .in("id", ids),
      supabase
        .from("oportunidades")
        .select("cliente_id, mensaje_inicial, producto:productos(nombre)")
        .in("cliente_id", ids)
        .in("etapa", [...ETAPAS_ABIERTAS])
        .order("created_at", { ascending: false })
        .limit(300),
    ]);
    for (const c of (clis ?? []) as unknown as {
      id: string;
      estado: string;
      telefono: string | null;
      rubro: string | null;
      sucursales: { ciudad: string | null; es_principal: boolean }[] | null;
    }[]) {
      const principal = (c.sucursales ?? []).find((s) => s.es_principal) ?? (c.sucursales ?? [])[0];
      resumen.set(c.id, {
        estado: c.estado,
        telefono: c.telefono,
        rubro: c.rubro,
        ciudad: principal?.ciudad ?? null,
        interes: null,
      });
    }
    for (const o of (opps ?? []) as unknown as {
      cliente_id: string;
      mensaje_inicial: string | null;
      producto: { nombre: string } | null;
    }[]) {
      const r = resumen.get(o.cliente_id);
      if (r && !r.interes) r.interes = o.producto?.nombre ?? o.mensaje_inicial ?? null;
    }
  }

  const porDia = new Map<string, Mov[]>();
  for (const m of movimientos) {
    const d = diaDe(m.created_at);
    if (!porDia.has(d)) porDia.set(d, []);
    porDia.get(d)!.push(m);
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold tracking-tight">Movimientos</h1>
      <p className="mb-3 text-[15px] text-piedra">
        Todo lo que se anotó, cotizó, vendió y arregló, en orden. Tocá el nombre para ir a la ficha.
      </p>
      <div className="mb-4">
        <Suspense fallback={null}>
          <FiltrosMovimientos esGestor={esGestor} vendedores={vendedores} tecnicos={tecnicos} />
        </Suspense>
      </div>

      {movimientos.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-borde p-6 text-center text-[15px] text-piedra">
          No hay movimientos con ese filtro.
        </p>
      ) : (
        <div className="space-y-5">
          {Array.from(porDia.entries()).map(([dia, lista]) => (
            <section key={dia}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-piedra">{tituloDia(dia)}</h2>
              <div className="rounded-2xl border border-borde bg-white shadow-sm">
                {lista.map((m) => {
                  const r = resumen.get(m.cliente_id);
                  return (
                    <div
                      key={m.id}
                      className="group relative flex gap-3 border-b border-borde/60 px-3.5 py-2.5 text-[15px] last:border-0"
                    >
                      <span className="w-11 shrink-0 text-xs text-piedra">{horaDe(m.created_at)}</span>
                      <div className="min-w-0 flex-1">
                        <Link href={`/clientes/${m.cliente_id}`} className="font-semibold hover:underline">
                          {m.cliente?.nombre_comercial ?? "Contacto"}
                        </Link>
                        <span className="text-tinta/80"> — {m.contenido}</span>
                        {m.created_by && nombres.get(m.created_by) && (
                          <span className="text-piedra"> · {nombres.get(m.created_by)}</span>
                        )}
                      </div>
                      {r && (
                        <div className="pointer-events-none absolute right-3 top-full z-10 hidden w-72 rounded-2xl border border-borde bg-white p-3 text-sm shadow-lg lg:group-hover:block">
                          <p className="font-semibold">{m.cliente?.nombre_comercial}</p>
                          <p className="text-xs text-piedra">
                            {[
                              r.estado === "cliente_activo" ? "Cliente" : "Interesado",
                              r.rubro && r.rubro !== "Otro" ? r.rubro : null,
                              r.ciudad,
                              r.telefono ? telefonoProlijo(r.telefono) : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          {r.interes && <p className="mt-1">Le interesa: {r.interes}</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
