import { MessageCircle, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ETAPAS_ABIERTAS } from "@/lib/constants";
import { haceCuanto, hoyISO, fechaCorta, linkWhatsApp, telefonoProlijo } from "@/lib/format";
import ConPanel from "@/components/ficha/ConPanel";
import LinkContacto from "@/components/LinkContacto";
import { PuntoNivel } from "@/components/PuntoNivel";
import type { Cliente } from "@/lib/types";

const SELECT_CLI = "*, sucursales(ciudad, es_principal)";
type Fila = Cliente & { sucursales?: { ciudad: string | null; es_principal: boolean }[] };

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

/**
 * Contactos, como la lista de chats: los últimos con los que pasó algo
 * arriba, un buscador grande para los 5.000, y el WhatsApp al lado. Sin
 * filtros a la vista (desde Stock se llega a "los que esperan un producto").
 */
export default async function ContactosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; vista?: string; producto?: string; c?: string; interes?: string }>;
}) {
  const { q, vista, producto, c, interes } = await searchParams;
  const busqueda = q?.trim() ?? "";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? "";
  const { data: yo } = await supabase.from("usuarios").select("rol").eq("id", userId).maybeSingle();
  const rol = yo?.rol ?? "comercial";
  const hoy = hoyISO();

  const { count: total } = await supabase.from("clientes").select("id", { count: "exact", head: true }).is("deleted_at", null);

  let clientes: Cliente[] = [];
  let tituloLista = "Últimos movimientos";
  let productoEspera: string | null = null;
  if (busqueda) {
    const t = busqueda.replace(/[,()]/g, " ").trim();
    const digitos = t.replace(/\D/g, "");
    const filtros = [`nombre_comercial.ilike.%${t}%`, `razon_social.ilike.%${t}%`, `email.ilike.%${t}%`, `notas.ilike.%${t}%`];
    if (digitos.length >= 4) filtros.push(`telefono.ilike.%${digitos}%`);
    const [{ data }, { data: porSerie }] = await Promise.all([
      supabase.from("clientes").select(SELECT_CLI).is("deleted_at", null).or(filtros.join(",")).order("nombre_comercial").limit(60),
      supabase
        .from("equipos")
        .select("cliente:clientes(*, sucursales(ciudad, es_principal))")
        .ilike("numero_serie", `%${t}%`)
        .is("deleted_at", null)
        .limit(5),
    ]);
    const mapa = new Map<string, Cliente>();
    for (const cli of aplanar((data ?? []) as Fila[])) mapa.set(cli.id, cli);
    for (const e of (porSerie ?? []) as unknown as { cliente: Fila | null }[])
      if (e.cliente && !e.cliente.deleted_at) mapa.set(e.cliente.id, aplanar([e.cliente])[0]);
    clientes = Array.from(mapa.values());
    tituloLista = `Resultados para “${busqueda}”`;
  } else if (vista === "espera") {
    let qEspera = supabase
      .from("oportunidades")
      .select("cliente_id, producto:productos(nombre)")
      .eq("etapa", "espera")
      .order("created_at", { ascending: false })
      .limit(300);
    if (producto) qEspera = qEspera.eq("producto_id", producto);
    const { data: opps } = await qEspera;
    const filas = (opps ?? []) as unknown as { cliente_id: string; producto: { nombre: string } | null }[];
    productoEspera = producto ? (filas[0]?.producto?.nombre ?? null) : null;
    const ids = unicos(filas.map((o) => o.cliente_id)).slice(0, 100);
    if (ids.length) {
      const { data } = await supabase.from("clientes").select(SELECT_CLI).in("id", ids).is("deleted_at", null);
      const porId = new Map(aplanar((data ?? []) as Fila[]).map((cli) => [cli.id, cli]));
      clientes = ids.map((id) => porId.get(id)).filter(Boolean) as Cliente[];
    }
    tituloLista = productoEspera ? `Esperan ${productoEspera}` : "En lista de espera";
  } else {
    const { data: acts } = await supabase.from("actividades").select("cliente_id").order("created_at", { ascending: false }).limit(800);
    const ids = unicos((acts ?? []).map((a) => a.cliente_id)).slice(0, 200);
    if (ids.length) {
      let qCli = supabase.from("clientes").select(SELECT_CLI).in("id", ids).is("deleted_at", null);
      if (rol === "comercial") qCli = qCli.eq("comercial_id", userId);
      const { data } = await qCli;
      const porId = new Map(aplanar((data ?? []) as Fila[]).map((cli) => [cli.id, cli]));
      clientes = (ids.map((id) => porId.get(id)).filter(Boolean) as Cliente[]).slice(0, 60);
    }
  }

  // Qué pasó con cada uno: último movimiento y último interés abierto
  const ids = clientes.map((cli) => cli.id);
  const [{ data: actsData }, { data: oppsData }] = ids.length
    ? await Promise.all([
        supabase.from("actividades").select("cliente_id, contenido, created_at").in("cliente_id", ids).order("created_at", { ascending: false }).limit(400),
        supabase
          .from("oportunidades")
          .select("id, cliente_id, etapa, temperatura, mensaje_inicial, proximo_contacto, producto:productos(nombre)")
          .in("cliente_id", ids)
          .in("etapa", [...ETAPAS_ABIERTAS])
          .order("created_at", { ascending: false })
          .limit(300),
      ])
    : [{ data: [] }, { data: [] }];
  const ultimo = new Map<string, { contenido: string | null; created_at: string }>();
  for (const a of (actsData ?? []) as { cliente_id: string; contenido: string | null; created_at: string }[])
    if (!ultimo.has(a.cliente_id)) ultimo.set(a.cliente_id, a);
  const interesDe = new Map<string, { id: string; texto: string; espera: boolean; nivel: string | null; proximo: string | null }>();
  for (const o of (oppsData ?? []) as unknown as {
    id: string;
    cliente_id: string;
    etapa: string;
    temperatura: string | null;
    mensaje_inicial: string | null;
    proximo_contacto: string | null;
    producto: { nombre: string } | null;
  }[]) {
    const texto = o.producto?.nombre ?? o.mensaje_inicial;
    if (!texto || interesDe.has(o.cliente_id)) continue;
    interesDe.set(o.cliente_id, { id: o.id, texto, espera: o.etapa === "espera", nivel: o.temperatura, proximo: o.proximo_contacto });
  }

  return (
    <ConPanel c={c} interes={interes} cerrarHref={busqueda ? `/clientes?q=${encodeURIComponent(busqueda)}` : "/clientes"}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-extrabold tracking-tight">Contactos</h1>
          {total ? <p className="text-[15px] text-piedra">{total.toLocaleString("es-AR")} en total</p> : null}
        </div>
        <form method="get" action="/clientes" className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-piedra" />
          <input
            type="search"
            name="q"
            defaultValue={busqueda}
            placeholder="Nombre, teléfono, empresa o serie"
            className="min-h-12 w-full rounded-2xl border border-borde bg-white py-3 pl-11 pr-4 text-base shadow-sm outline-none focus:border-marino"
          />
        </form>
        <p className="text-xs font-bold uppercase tracking-wide text-piedra">{tituloLista}</p>

        {clientes.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-borde p-6 text-center text-[15px] text-piedra">
            {busqueda ? (
              <>
                No aparece nadie con “{busqueda}”.{" "}
                <a href="/alta" className="text-azul underline">
                  Cargarlo con Nuevo interés
                </a>
              </>
            ) : vista === "espera" ? (
              "Nadie en lista de espera."
            ) : (
              "Todavía no hay movimientos en tus contactos."
            )}
          </p>
        ) : (
          <div className="grid gap-2 lg:grid-cols-2">
            {clientes.map((cli) => {
              const u = ultimo.get(cli.id);
              const int = interesDe.get(cli.id);
              const esCliente = cli.estado === "cliente_activo";
              return (
                <div key={cli.id} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
                  <LinkContacto id={cli.id} interes={int?.id} className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5">
                      <span className="truncate text-[16px] font-extrabold">{cli.nombre_comercial}</span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          esCliente ? "bg-verde-soft text-verde" : "bg-azul-soft text-azul"
                        }`}
                      >
                        {esCliente ? "Cliente" : "Interesado"}
                      </span>
                    </p>
                    {u ? (
                      <p className="truncate text-[15px] text-tinta/80">
                        <span className="text-piedra">{haceCuanto(u.created_at)} · </span>
                        {u.contenido}
                      </p>
                    ) : (
                      <p className="truncate text-[15px] text-piedra">
                        {[cli.rubro && cli.rubro !== "Otro" ? cli.rubro : null, cli.ciudad, cli.telefono ? telefonoProlijo(cli.telefono) : null]
                          .filter(Boolean)
                          .join(" · ") || "Sin movimientos"}
                      </p>
                    )}
                    {int && (
                      <p className={`flex items-center gap-1.5 truncate text-xs ${int.espera ? "text-naranja" : "text-piedra"}`}>
                        <PuntoNivel nivel={int.nivel} />
                        <span className="truncate">
                          {int.espera ? "Espera " : "Le interesa "}
                          {int.texto}
                          {int.proximo ? ` · ${int.proximo <= hoy ? "contactar hoy" : `volver el ${fechaCorta(int.proximo)}`}` : ""}
                        </span>
                      </p>
                    )}
                  </LinkContacto>
                  {cli.telefono && (
                    <a
                      href={linkWhatsApp(cli.telefono)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="WhatsApp"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-verde text-white"
                    >
                      <MessageCircle className="h-5 w-5" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ConPanel>
  );
}
