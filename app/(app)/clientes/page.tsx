import Link from "next/link";
import { MessageCircle, Phone, Plus, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ETAPAS_ABIERTAS } from "@/lib/constants";
import {
  fechaCorta,
  haceCuanto,
  hoyISO,
  linkWhatsApp,
  sumarDias,
  telefonoProlijo,
} from "@/lib/format";
import SeguimientoItem from "@/components/SeguimientoItem";
import type { Cliente } from "@/lib/types";

const SELECT_CLI = "*, sucursales(ciudad, es_principal)";

type Fila = Cliente & {
  sucursales?: { ciudad: string | null; es_principal: boolean }[];
};
type TareaFila = {
  id: string;
  titulo: string;
  vence_el: string;
  cliente_id: string;
  usuario_id: string | null;
  cliente: { nombre_comercial: string; telefono: string | null } | null;
};

function aplanar(filas: Fila[]): Cliente[] {
  return filas.map(({ sucursales, ...c }) => {
    const principal =
      (sucursales ?? []).find((s) => s.es_principal) ?? (sucursales ?? [])[0];
    return { ...c, ciudad: principal?.ciudad ?? null } as Cliente;
  });
}

function unicos(ids: (string | null)[]): string[] {
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (id && !vistos.has(id)) {
      vistos.add(id);
      out.push(id);
    }
  }
  return out;
}

const VISTAS = [
  { key: "recientes", label: "Recientes" },
  { key: "contactar", label: "Para contactar" },
  { key: "interesados", label: "Interesados" },
  { key: "espera", label: "Lista de espera" },
  { key: "clientes", label: "Clientes" },
  { key: "todos", label: "Todos" },
] as const;

/**
 * Pantalla de inicio: todos los contactos, cómo contactarlos y qué pasó con
 * cada uno. Sin tableros ni números en rojo.
 */
export default async function ContactosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; vista?: string; producto?: string }>;
}) {
  const { q, vista: vistaParam, producto } = await searchParams;
  const busqueda = q?.trim() ?? "";
  const vista = busqueda ? "busqueda" : (vistaParam ?? "recientes");
  const supabase = await createClient();
  const hoy = hoyISO();

  // Seguimientos agendados a mano (los únicos que se muestran): próximos 7 días
  const [
    { data: tareasData },
    { data: usuariosData },
    { count: totalContactos },
    { count: totalEspera },
  ] = await Promise.all([
      supabase
        .from("tareas")
        .select(
          "id, titulo, vence_el, cliente_id, usuario_id, cliente:clientes(nombre_comercial, telefono)"
        )
        .eq("auto", false)
        .is("completada_at", null)
        .eq("cancelada", false)
        .lte("vence_el", sumarDias(7))
        .order("vence_el")
        .limit(100),
      supabase.from("usuarios").select("id, nombre"),
      supabase
        .from("clientes")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null),
      supabase
        .from("oportunidades")
        .select("id", { count: "exact", head: true })
        .eq("etapa", "espera"),
    ]);
  const tareas = (tareasData ?? []) as unknown as TareaFila[];
  const nombres = new Map(
    ((usuariosData ?? []) as { id: string; nombre: string }[]).map((u) => [u.id, u.nombre])
  );
  const paraHoy = tareas.filter((t) => t.vence_el <= hoy).length;

  // ---- Qué contactos se listan, según la vista ----
  let clientes: Cliente[] = [];
  if (vista === "busqueda") {
    const digitos = busqueda.replace(/\D/g, "");
    const filtros = [
      `nombre_comercial.ilike.%${busqueda}%`,
      `razon_social.ilike.%${busqueda}%`,
      `email.ilike.%${busqueda}%`,
    ];
    if (digitos.length >= 4) filtros.push(`telefono.ilike.%${digitos}%`);
    const { data } = await supabase
      .from("clientes")
      .select(SELECT_CLI)
      .is("deleted_at", null)
      .or(filtros.join(","))
      .order("nombre_comercial")
      .limit(60);
    clientes = aplanar((data ?? []) as Fila[]);
  } else if (vista === "recientes") {
    const { data: acts } = await supabase
      .from("actividades")
      .select("cliente_id")
      .order("created_at", { ascending: false })
      .limit(400);
    const ids = unicos((acts ?? []).map((a) => a.cliente_id)).slice(0, 60);
    if (ids.length) {
      const { data } = await supabase
        .from("clientes")
        .select(SELECT_CLI)
        .in("id", ids)
        .is("deleted_at", null);
      const porId = new Map(aplanar((data ?? []) as Fila[]).map((c) => [c.id, c]));
      clientes = ids.map((id) => porId.get(id)).filter(Boolean) as Cliente[];
    }
  } else if (vista === "interesados") {
    const { data: opps } = await supabase
      .from("oportunidades")
      .select("cliente_id")
      .in("etapa", [...ETAPAS_ABIERTAS])
      .order("created_at", { ascending: false })
      .limit(300);
    const ids = unicos((opps ?? []).map((o) => o.cliente_id)).slice(0, 60);
    if (ids.length) {
      const { data } = await supabase
        .from("clientes")
        .select(SELECT_CLI)
        .in("id", ids)
        .is("deleted_at", null);
      const porId = new Map(aplanar((data ?? []) as Fila[]).map((c) => [c.id, c]));
      clientes = ids.map((id) => porId.get(id)).filter(Boolean) as Cliente[];
    }
  } else if (vista === "espera") {
    let qEspera = supabase
      .from("oportunidades")
      .select("cliente_id")
      .eq("etapa", "espera")
      .order("created_at", { ascending: false })
      .limit(300);
    if (producto) qEspera = qEspera.eq("producto_id", producto);
    const { data: opps } = await qEspera;
    const ids = unicos((opps ?? []).map((o) => o.cliente_id)).slice(0, 100);
    if (ids.length) {
      const { data } = await supabase
        .from("clientes")
        .select(SELECT_CLI)
        .in("id", ids)
        .is("deleted_at", null);
      const porId = new Map(aplanar((data ?? []) as Fila[]).map((c) => [c.id, c]));
      clientes = ids.map((id) => porId.get(id)).filter(Boolean) as Cliente[];
    }
  } else if (vista === "clientes") {
    const { data } = await supabase
      .from("clientes")
      .select(SELECT_CLI)
      .eq("estado", "cliente_activo")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(60);
    clientes = aplanar((data ?? []) as Fila[]);
  } else if (vista === "todos") {
    const { data } = await supabase
      .from("clientes")
      .select(SELECT_CLI)
      .is("deleted_at", null)
      .order("nombre_comercial")
      .limit(100);
    clientes = aplanar((data ?? []) as Fila[]);
  }

  // ---- Qué pasó con cada uno: último movimiento, interés abierto, seguimiento ----
  const ids = clientes.map((c) => c.id);
  const [{ data: actsData }, { data: oppsData }, { data: pendData }] = ids.length
    ? await Promise.all([
        supabase
          .from("actividades")
          .select("cliente_id, contenido, created_at")
          .in("cliente_id", ids)
          .order("created_at", { ascending: false })
          .limit(400),
        supabase
          .from("oportunidades")
          .select("cliente_id, etapa, mensaje_inicial, producto:productos(nombre)")
          .in("cliente_id", ids)
          .in("etapa", [...ETAPAS_ABIERTAS])
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("tareas")
          .select("cliente_id, vence_el")
          .in("cliente_id", ids)
          .eq("auto", false)
          .is("completada_at", null)
          .eq("cancelada", false)
          .order("vence_el")
          .limit(200),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const ultimo = new Map<string, { contenido: string | null; created_at: string }>();
  for (const a of (actsData ?? []) as { cliente_id: string; contenido: string | null; created_at: string }[])
    if (!ultimo.has(a.cliente_id)) ultimo.set(a.cliente_id, a);
  const interes = new Map<string, { texto: string; espera: boolean }>();
  for (const o of (oppsData ?? []) as unknown as {
    cliente_id: string;
    etapa: string;
    mensaje_inicial: string | null;
    producto: { nombre: string } | null;
  }[]) {
    const texto = o.producto?.nombre ?? o.mensaje_inicial;
    if (!texto) continue;
    const espera = o.etapa === "espera";
    const actual = interes.get(o.cliente_id);
    // La lista de espera manda: es lo que hay que resolver
    if (!actual || (espera && !actual.espera)) interes.set(o.cliente_id, { texto, espera });
  }
  const proximo = new Map<string, string>();
  for (const t of (pendData ?? []) as { cliente_id: string; vence_el: string }[])
    if (!proximo.has(t.cliente_id)) proximo.set(t.cliente_id, t.vence_el);

  const linkVista = (v: string) => `/clientes?vista=${v}`;
  const chip = (activo: boolean) =>
    `shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${
      activo ? "bg-tinta text-white" : "border border-borde bg-white text-piedra"
    }`;

  const vencidas = tareas.filter((t) => t.vence_el < hoy);
  const deHoy = tareas.filter((t) => t.vence_el === hoy);
  const proximas = tareas.filter((t) => t.vence_el > hoy);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Contactos</h1>
        <Link
          href="/alta"
          className="inline-flex items-center gap-1.5 rounded-xl bg-tinta px-3.5 py-2 text-sm font-semibold text-white shadow-sm"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} /> Nuevo
        </Link>
      </div>

      <form method="get" className="relative mb-3">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-piedra" />
        <input
          type="search"
          name="q"
          defaultValue={busqueda}
          placeholder="Buscar por nombre, teléfono o email"
          className="w-full rounded-2xl border border-borde bg-white py-3 pl-11 pr-4 text-base shadow-sm outline-none focus:border-tinta"
        />
      </form>

      <div className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
        {VISTAS.map((v) => (
          <Link key={v.key} href={linkVista(v.key)} className={chip(vista === v.key)}>
            {v.label}
            {v.key === "contactar" && paraHoy > 0 ? ` (${paraHoy})` : ""}
            {v.key === "espera" && totalEspera ? ` (${totalEspera})` : ""}
            {v.key === "todos" && totalContactos
              ? ` (${totalContactos.toLocaleString("es-AR")})`
              : ""}
          </Link>
        ))}
      </div>

      {vista === "recientes" && paraHoy > 0 && (
        <Link
          href={linkVista("contactar")}
          className="mb-3 block rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900"
        >
          Tenés <span className="font-semibold">{paraHoy}</span> contacto
          {paraHoy > 1 ? "s" : ""} para hoy →
        </Link>
      )}

      {vista === "contactar" ? (
        <div className="space-y-5">
          {tareas.length === 0 && (
            <p className="rounded-2xl border border-dashed border-borde p-6 text-center text-sm text-piedra">
              Nada agendado. Cuando anotás “volver a contactar” en una ficha,
              aparece acá.
            </p>
          )}
          {vencidas.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-amber-700">
                Quedaron de días anteriores ({vencidas.length})
              </h2>
              <div className="space-y-2">
                {vencidas.map((t) => (
                  <SeguimientoItem
                    key={t.id}
                    tarea={{ ...t, responsable: t.usuario_id ? nombres.get(t.usuario_id) : null }}
                  />
                ))}
              </div>
            </section>
          )}
          {deHoy.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold">Para hoy ({deHoy.length})</h2>
              <div className="space-y-2">
                {deHoy.map((t) => (
                  <SeguimientoItem
                    key={t.id}
                    tarea={{ ...t, responsable: t.usuario_id ? nombres.get(t.usuario_id) : null }}
                  />
                ))}
              </div>
            </section>
          )}
          {proximas.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-piedra">
                Próximos días ({proximas.length})
              </h2>
              <div className="space-y-2">
                {proximas.map((t) => (
                  <SeguimientoItem
                    key={t.id}
                    tarea={{ ...t, responsable: t.usuario_id ? nombres.get(t.usuario_id) : null }}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      ) : clientes.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-borde p-6 text-center text-sm text-piedra">
          {vista === "busqueda" ? (
            <>
              No aparece nadie con “{busqueda}”.{" "}
              <Link href="/alta" className="text-sky-700 underline">
                Cargarlo como contacto nuevo
              </Link>
            </>
          ) : vista === "espera" ? (
            "Nadie en lista de espera. Cuando alguien quiera algo sin stock, marcalo en su ficha y aparece acá."
          ) : vista === "interesados" ? (
            "Todavía no hay interesados con consulta abierta."
          ) : (
            "Todavía no hay movimientos. Cargá un contacto con el botón Nuevo."
          )}
        </p>
      ) : (
        <div className="grid gap-2 lg:grid-cols-2">
          {clientes.map((c) => {
            const u = ultimo.get(c.id);
            const int = interes.get(c.id);
            const prox = proximo.get(c.id);
            const detalle = [
              c.estado === "cliente_activo"
                ? "Cliente"
                : c.estado === "inactivo"
                  ? "Inactivo"
                  : "Interesado",
              c.rubro && c.rubro !== "Otro" ? c.rubro : null,
              c.ciudad,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <div
                key={c.id}
                className="flex items-start gap-3 rounded-2xl border border-borde bg-white p-3 shadow-sm"
              >
                <Link href={`/clientes/${c.id}`} className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">{c.nombre_comercial}</p>
                  <p className="text-xs text-piedra">
                    {detalle}
                    {c.telefono ? ` · ${telefonoProlijo(c.telefono)}` : ""}
                  </p>
                  {int && (
                    <p
                      className={`mt-1 truncate text-sm ${
                        int.espera ? "text-orange-700" : "text-tinta/80"
                      }`}
                    >
                      {int.espera ? "En lista de espera: " : "Le interesa: "}
                      <span className="font-medium">{int.texto}</span>
                    </p>
                  )}
                  {u && (
                    <p className="mt-0.5 truncate text-xs text-piedra">
                      {haceCuanto(u.created_at)}: {u.contenido}
                    </p>
                  )}
                  {prox && (
                    <p
                      className={`mt-0.5 text-xs font-medium ${
                        prox < hoy ? "text-amber-700" : "text-sky-800"
                      }`}
                    >
                      Volver a contactar: {prox === hoy ? "hoy" : fechaCorta(prox)}
                    </p>
                  )}
                </Link>
                {c.telefono && (
                  <div className="flex shrink-0 gap-1.5">
                    <a
                      href={linkWhatsApp(c.telefono)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="WhatsApp"
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-green-600 text-white"
                    >
                      <MessageCircle className="h-[18px] w-[18px]" />
                    </a>
                    <a
                      href={`tel:${c.telefono}`}
                      aria-label="Llamar"
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-borde text-tinta"
                    >
                      <Phone className="h-[18px] w-[18px]" />
                    </a>
                  </div>
                )}
              </div>
            );
          })}
          {vista === "todos" && clientes.length >= 100 && (
            <p className="text-center text-xs text-piedra lg:col-span-2">
              Se muestran los primeros 100. Usá el buscador para encontrar al resto.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
