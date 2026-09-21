import Link from "next/link";
import { cookies } from "next/headers";
import { MessageCircle, Phone, Plus, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ETAPAS_ABIERTAS } from "@/lib/constants";
import { clasificarPendientes } from "@/lib/pendientes";
import {
  fechaCorta,
  haceCuanto,
  hoyISO,
  linkWhatsApp,
  telefonoProlijo,
} from "@/lib/format";
import PendienteFila, { type Pendiente } from "@/components/inicio/PendienteFila";
import SelectorQuien from "@/components/inicio/SelectorQuien";
import InicioTecnico from "@/components/inicio/InicioTecnico";
import SeguimientoItem from "@/components/SeguimientoItem";
import { PuntoNivel } from "@/components/PuntoNivel";
import type { Cliente } from "@/lib/types";

const SELECT_CLI = "*, sucursales(ciudad, es_principal)";
type Fila = Cliente & { sucursales?: { ciudad: string | null; es_principal: boolean }[] };
type InteresFila = {
  id: string;
  cliente_id: string;
  comercial_id: string | null;
  etapa: string;
  temperatura: string | null;
  proximo_contacto: string | null;
  proximo_nota: string | null;
  ultimo_movimiento_at: string | null;
  mensaje_inicial: string | null;
  producto: { nombre: string } | null;
  cliente: { nombre_comercial: string; telefono: string | null; deleted_at: string | null } | null;
};
type RecompraFila = {
  id: string;
  titulo: string;
  vence_el: string;
  cliente_id: string;
  usuario_id: string | null;
  cliente: { nombre_comercial: string; telefono: string | null } | null;
};

const VISTAS = [
  { key: "recientes", label: "Recientes" },
  { key: "interesados", label: "Interesados" },
  { key: "clientes", label: "Clientes" },
  { key: "espera", label: "Lista de espera" },
  { key: "todos", label: "Todos" },
] as const;

function aplanar(filas: Fila[]): Cliente[] {
  return filas.map(({ sucursales, ...c }) => {
    const principal = (sucursales ?? []).find((s) => s.es_principal) ?? (sucursales ?? [])[0];
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

const esUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

/**
 * La pantalla de inicio (Etapa 1, 1.3): buscador y + Interés arriba, los
 * Pendientes calculados desde los intereses en el medio, y abajo todos los
 * contactos con cómo contactarlos. `/` y `/clientes` muestran esta misma
 * página; "Contactos" salta a la zona 3.
 */
export default async function Inicio({
  searchParams,
}: {
  searchParams: { q?: string; vista?: string; producto?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? "";
  const { data: yo } = await supabase.from("usuarios").select("rol").eq("id", userId).maybeSingle();
  const rol = yo?.rol ?? "comercial";
  const esGestor = ["direccion", "admin"].includes(rol);
  const hoy = hoyISO();

  if (rol === "tecnico") {
    return (
      <div>
        <h1 className="mb-3 text-2xl font-bold tracking-tight">Services</h1>
        <InicioTecnico userId={userId} />
      </div>
    );
  }

  // ---- Zona 2: Pendientes. De quién: vendedores ven los suyos; gestores eligen ----
  const cookieStore = await cookies();
  const preferencia = cookieStore.get("pendientes_quien")?.value ?? "";
  const quien = esGestor ? (preferencia || "todos") : "mios";
  const comercialFiltro = quien === "mios" ? userId : esUuid(quien) ? quien : null;

  const [interesesData, { data: usuariosData }, { data: recomprasData }, bandeja] = await Promise.all([
    (async () => {
      const todo: InteresFila[] = [];
      for (let desde = 0; desde < 3000; desde += 1000) {
        let q = supabase
          .from("oportunidades")
          .select(
            "id, cliente_id, comercial_id, etapa, temperatura, proximo_contacto, proximo_nota, ultimo_movimiento_at, mensaje_inicial, producto:productos(nombre), cliente:clientes!inner(nombre_comercial, telefono, deleted_at)"
          )
          .in("etapa", [...ETAPAS_ABIERTAS])
          .is("cliente.deleted_at", null)
          .order("id")
          .range(desde, desde + 999);
        if (comercialFiltro) q = q.eq("comercial_id", comercialFiltro);
        const { data } = await q;
        const pagina = (data ?? []) as unknown as InteresFila[];
        todo.push(...pagina);
        if (pagina.length < 1000) break;
      }
      return todo;
    })(),
    supabase.from("usuarios").select("id, nombre, rol, activo"),
    (() => {
      let q = supabase
        .from("tareas")
        .select("id, titulo, vence_el, cliente_id, usuario_id, cliente:clientes(nombre_comercial, telefono)")
        .eq("tipo", "recompra")
        .is("completada_at", null)
        .eq("cancelada", false)
        .order("vence_el")
        .limit(50);
      if (comercialFiltro) q = q.eq("usuario_id", comercialFiltro);
      return q;
    })(),
    esGestor
      ? Promise.all([
          supabase
            .from("oportunidades")
            .select("id", { count: "exact", head: true })
            .eq("etapa", "ganada")
            .eq("pedido_estado", "facturar"),
          supabase
            .from("ordenes_trabajo")
            .select("id", { count: "exact", head: true })
            .in("estado", ["finalizado_tecnico", "revision_admin"]),
        ])
      : Promise.resolve(null),
  ]);

  const usuarios = (usuariosData ?? []) as { id: string; nombre: string; rol: string; activo: boolean }[];
  const nombres = new Map(usuarios.map((u) => [u.id, u.nombre]));
  const vendedores = usuarios
    .filter((u) => u.activo && ["comercial", "direccion", "admin"].includes(u.rol))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
  const bloques = clasificarPendientes(interesesData, hoy);
  const recompras = (recomprasData ?? []) as unknown as RecompraFila[];
  const paraFacturar = bandeja?.[0].count ?? 0;
  const paraRevisar = bandeja?.[1].count ?? 0;

  const aPendiente = (i: InteresFila, detalle?: string | null): Pendiente => ({
    id: i.id,
    clienteId: i.cliente_id,
    nombre: i.cliente?.nombre_comercial ?? "Contacto",
    telefono: i.cliente?.telefono ?? null,
    interes: i.producto?.nombre ?? i.mensaje_inicial ?? "Interés",
    nivel: i.temperatura,
    nota: i.proximo_nota,
    detalle: detalle ?? null,
  });
  const alDia = bloques.atrasados.length === 0 && bloques.hoy.length === 0 && bloques.llegoStock.length === 0;

  // ---- Zona 3: contactos ----
  const busqueda = searchParams.q?.trim() ?? "";
  const vista = busqueda ? "busqueda" : (searchParams.vista ?? "recientes");
  const producto = searchParams.producto;
  const [{ count: totalContactos }, { count: totalEspera }] = await Promise.all([
    supabase.from("clientes").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("oportunidades").select("id", { count: "exact", head: true }).eq("etapa", "espera"),
  ]);

  let clientes: Cliente[] = [];
  if (vista === "busqueda") {
    const t = busqueda.replace(/[,()]/g, " ").trim();
    const digitos = t.replace(/\D/g, "");
    const filtros = [
      `nombre_comercial.ilike.%${t}%`,
      `razon_social.ilike.%${t}%`,
      `email.ilike.%${t}%`,
      `notas.ilike.%${t}%`,
    ];
    if (digitos.length >= 4) filtros.push(`telefono.ilike.%${digitos}%`);
    const [{ data }, { data: porSerie }] = await Promise.all([
      supabase
        .from("clientes")
        .select(SELECT_CLI)
        .is("deleted_at", null)
        .or(filtros.join(","))
        .order("nombre_comercial")
        .limit(60),
      supabase
        .from("equipos")
        .select("cliente:clientes(*, sucursales(ciudad, es_principal))")
        .ilike("numero_serie", `%${t}%`)
        .is("deleted_at", null)
        .limit(5),
    ]);
    const mapa = new Map<string, Cliente>();
    for (const c of aplanar((data ?? []) as Fila[])) mapa.set(c.id, c);
    for (const e of (porSerie ?? []) as unknown as { cliente: Fila | null }[])
      if (e.cliente && !e.cliente.deleted_at) mapa.set(e.cliente.id, aplanar([e.cliente])[0]);
    clientes = Array.from(mapa.values());
  } else if (vista === "recientes") {
    const { data: acts } = await supabase
      .from("actividades")
      .select("cliente_id")
      .order("created_at", { ascending: false })
      .limit(600);
    const ids = unicos((acts ?? []).map((a) => a.cliente_id)).slice(0, 150);
    if (ids.length) {
      let q = supabase.from("clientes").select(SELECT_CLI).in("id", ids).is("deleted_at", null);
      // Vendedores: sus contactos por defecto
      if (!esGestor && rol === "comercial") q = q.eq("comercial_id", userId);
      const { data } = await q;
      const porId = new Map(aplanar((data ?? []) as Fila[]).map((c) => [c.id, c]));
      clientes = (ids.map((id) => porId.get(id)).filter(Boolean) as Cliente[]).slice(0, 60);
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
      const { data } = await supabase.from("clientes").select(SELECT_CLI).in("id", ids).is("deleted_at", null);
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
      const { data } = await supabase.from("clientes").select(SELECT_CLI).in("id", ids).is("deleted_at", null);
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
  } else {
    const { data } = await supabase
      .from("clientes")
      .select(SELECT_CLI)
      .is("deleted_at", null)
      .order("nombre_comercial")
      .limit(100);
    clientes = aplanar((data ?? []) as Fila[]);
  }

  // Qué pasó con cada uno: último movimiento, último interés abierto, próxima fecha
  const ids = clientes.map((c) => c.id);
  const [{ data: actsData }, { data: oppsData }] = ids.length
    ? await Promise.all([
        supabase
          .from("actividades")
          .select("cliente_id, contenido, created_at")
          .in("cliente_id", ids)
          .order("created_at", { ascending: false })
          .limit(400),
        supabase
          .from("oportunidades")
          .select("cliente_id, etapa, temperatura, mensaje_inicial, proximo_contacto, producto:productos(nombre)")
          .in("cliente_id", ids)
          .in("etapa", [...ETAPAS_ABIERTAS])
          .order("created_at", { ascending: false })
          .limit(300),
      ])
    : [{ data: [] }, { data: [] }];
  const ultimo = new Map<string, { contenido: string | null; created_at: string }>();
  for (const a of (actsData ?? []) as { cliente_id: string; contenido: string | null; created_at: string }[])
    if (!ultimo.has(a.cliente_id)) ultimo.set(a.cliente_id, a);
  const interes = new Map<string, { texto: string; espera: boolean; nivel: string | null; proximo: string | null }>();
  for (const o of (oppsData ?? []) as unknown as {
    cliente_id: string;
    etapa: string;
    temperatura: string | null;
    mensaje_inicial: string | null;
    proximo_contacto: string | null;
    producto: { nombre: string } | null;
  }[]) {
    const texto = o.producto?.nombre ?? o.mensaje_inicial;
    if (!texto) continue;
    const actual = interes.get(o.cliente_id);
    const espera = o.etapa === "espera";
    if (!actual || (espera && !actual.espera))
      interes.set(o.cliente_id, { texto, espera, nivel: o.temperatura, proximo: o.proximo_contacto });
    else if (o.proximo_contacto && (!actual.proximo || o.proximo_contacto < actual.proximo))
      actual.proximo = o.proximo_contacto;
  }

  const linkVista = (v: string) => `/clientes?vista=${v}#contactos`;
  const chip = (activo: boolean) =>
    `shrink-0 min-h-11 rounded-full px-3.5 py-2 text-[15px] font-medium ${
      activo ? "bg-tinta text-white" : "border border-borde bg-white text-piedra"
    }`;
  const bloque = (titulo: string, clase: string, items: Pendiente[]) =>
    items.length > 0 && (
      <section>
        <h2 className={`mb-2 text-[15px] font-semibold ${clase}`}>
          {titulo} ({items.length})
        </h2>
        <div className="space-y-2">
          {items.map((p) => (
            <PendienteFila key={p.id} item={p} />
          ))}
        </div>
      </section>
    );
  const plegado = (titulo: string, clase: string, items: Pendiente[], tope = 50) =>
    items.length > 0 && (
      <details className="group">
        <summary
          className={`flex min-h-11 cursor-pointer list-none items-center justify-between text-[15px] font-semibold ${clase} [&::-webkit-details-marker]:hidden`}
        >
          {titulo} ({items.length})
          <span className="transition-transform group-open:rotate-90">›</span>
        </summary>
        <div className="mt-2 space-y-2">
          {items.slice(0, tope).map((p) => (
            <PendienteFila key={p.id} item={p} />
          ))}
          {items.length > tope && (
            <p className="text-xs text-piedra">Se muestran {tope} de {items.length}.</p>
          )}
        </div>
      </details>
    );

  return (
    <div className="space-y-5">
      {/* Zona 1 · Buscador y botón principal */}
      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Inicio</h1>
          <Link
            href="/alta"
            className="hidden min-h-11 items-center gap-1.5 rounded-xl bg-tinta px-4 text-[15px] font-semibold text-white shadow-sm lg:inline-flex"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} /> Interés
          </Link>
        </div>
        <form method="get" action="/clientes" className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-piedra" />
          <input
            type="search"
            name="q"
            defaultValue={busqueda}
            placeholder="Buscar por nombre, teléfono, empresa o serie"
            className="min-h-12 w-full rounded-2xl border border-borde bg-white py-3 pl-11 pr-4 text-base shadow-sm outline-none focus:border-tinta"
          />
        </form>
      </div>

      {/* Zona 2 · Pendientes */}
      {!busqueda && (
        <div className="space-y-4">
          {esGestor && (paraFacturar > 0 || paraRevisar > 0) && (
            <div className="grid gap-2 sm:grid-cols-2">
              {paraFacturar > 0 && (
                <Link
                  href="/pedidos"
                  className="rounded-2xl border border-borde bg-white px-4 py-3 text-[15px] shadow-sm"
                >
                  <span className="font-semibold">Ventas para facturar</span>
                  <span className="ml-2 rounded-full bg-tinta px-2.5 py-0.5 text-xs font-bold text-white">{paraFacturar}</span>
                </Link>
              )}
              {paraRevisar > 0 && (
                <Link
                  href="/servicio?f=cobrar"
                  className="rounded-2xl border border-borde bg-white px-4 py-3 text-[15px] shadow-sm"
                >
                  <span className="font-semibold">Services para revisar</span>
                  <span className="ml-2 rounded-full bg-tinta px-2.5 py-0.5 text-xs font-bold text-white">{paraRevisar}</span>
                </Link>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-piedra">Pendientes</h2>
            {esGestor && <SelectorQuien valor={quien} vendedores={vendedores} />}
          </div>

          {alDia && <p className="text-[15px] text-piedra">Al día.</p>}
          {bloque(
            "Atrasados",
            "text-red-600",
            bloques.atrasados.map((i) => aPendiente(i, `Era el ${fechaCorta(i.proximo_contacto)}`))
          )}
          {bloque("Hoy", "text-tinta", bloques.hoy.map((i) => aPendiente(i)))}
          {bloque(
            "Llegó stock",
            "text-green-700",
            bloques.llegoStock.map((i) => aPendiente(i, "Está en lista de espera"))
          )}
          {plegado(
            "Próximos 7 días",
            "text-piedra",
            bloques.proximos.map((i) => aPendiente(i, fechaCorta(i.proximo_contacto)))
          )}
          {plegado(
            "Sin fecha",
            "text-piedra",
            bloques.sinFecha.map((i) =>
              aPendiente(i, i.ultimo_movimiento_at ? `sin movimiento desde ${haceCuanto(i.ultimo_movimiento_at)}` : "sin movimiento")
            )
          )}
          {recompras.length > 0 && (
            <details className="group">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-[15px] font-semibold text-piedra [&::-webkit-details-marker]:hidden">
                Recompras ({recompras.length})
                <span className="transition-transform group-open:rotate-90">›</span>
              </summary>
              <div className="mt-2 space-y-2">
                {recompras.map((t) => (
                  <SeguimientoItem
                    key={t.id}
                    tarea={{ ...t, responsable: t.usuario_id ? nombres.get(t.usuario_id) : null }}
                  />
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Zona 3 · Contactos */}
      <div id="contactos" className="scroll-mt-20">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-piedra">
          Contactos
          {totalContactos ? ` · ${totalContactos.toLocaleString("es-AR")}` : ""}
        </h2>
        {!busqueda && (
          <div className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1">
            {VISTAS.map((v) => (
              <Link key={v.key} href={linkVista(v.key)} className={chip(vista === v.key)}>
                {v.label}
                {v.key === "espera" && totalEspera ? ` (${totalEspera})` : ""}
              </Link>
            ))}
          </div>
        )}

        {clientes.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-borde p-6 text-center text-[15px] text-piedra">
            {vista === "busqueda" ? (
              <>
                No aparece nadie con “{busqueda}”.{" "}
                <Link href="/alta" className="text-sky-700 underline">
                  Cargarlo con + Interés
                </Link>
              </>
            ) : vista === "espera" ? (
              "Nadie en lista de espera."
            ) : vista === "interesados" ? (
              "Todavía no hay interesados con un interés abierto."
            ) : vista === "recientes" ? (
              "Todavía no hay movimientos en tus contactos."
            ) : (
              "Nada por acá."
            )}
          </p>
        ) : (
          <div className="grid gap-2 lg:grid-cols-2">
            {clientes.map((c) => {
              const u = ultimo.get(c.id);
              const int = interes.get(c.id);
              const esCliente = c.estado === "cliente_activo";
              const empresa =
                c.razon_social && c.razon_social.trim().toLowerCase() !== c.nombre_comercial.trim().toLowerCase()
                  ? c.razon_social
                  : null;
              return (
                <div key={c.id} className="flex items-start gap-3 rounded-2xl border border-borde bg-white p-3 shadow-sm">
                  <Link href={`/clientes/${c.id}`} className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5">
                      <span className="truncate text-[15px] font-semibold">{c.nombre_comercial}</span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          esCliente ? "bg-green-100 text-green-700" : "bg-celeste-soft text-sky-800"
                        }`}
                      >
                        {esCliente ? "Cliente" : "Interesado"}
                      </span>
                    </p>
                    <p className="truncate text-xs text-piedra">
                      {[empresa, c.rubro && c.rubro !== "Otro" ? c.rubro : null, c.ciudad, c.telefono ? telefonoProlijo(c.telefono) : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {int && (
                      <p className={`mt-1 flex items-center gap-1.5 truncate text-[15px] ${int.espera ? "text-orange-700" : "text-tinta/80"}`}>
                        <PuntoNivel nivel={int.nivel} />
                        <span className="truncate">
                          {int.espera ? "En lista de espera: " : "Le interesa: "}
                          <span className="font-medium">{int.texto}</span>
                        </span>
                      </p>
                    )}
                    {u && (
                      <p className="mt-0.5 truncate text-xs text-piedra">
                        {haceCuanto(u.created_at)}: {u.contenido}
                      </p>
                    )}
                    {int?.proximo && (
                      <p className={`mt-0.5 text-xs font-medium ${int.proximo < hoy ? "text-red-600" : "text-sky-800"}`}>
                        Volver a contactar: {int.proximo === hoy ? "hoy" : fechaCorta(int.proximo)}
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
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-green-600 text-white"
                      >
                        <MessageCircle className="h-5 w-5" />
                      </a>
                      <a
                        href={`tel:${c.telefono}`}
                        aria-label="Llamar"
                        className="flex h-11 w-11 items-center justify-center rounded-full border border-borde text-tinta"
                      >
                        <Phone className="h-5 w-5" />
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
    </div>
  );
}
