import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ETAPAS_ABIERTAS } from "@/lib/constants";
import { clasificarPendientes } from "@/lib/pendientes";
import { fechaCorta, hoyISO } from "@/lib/format";
import { filtroQuien } from "@/lib/quien";
import ConPanel from "@/components/ficha/ConPanel";
import PendienteFila, { type Pendiente } from "@/components/inicio/PendienteFila";
import SelectorQuienDesplegable from "@/components/embudo/SelectorQuienDesplegable";
import InicioTecnico from "@/components/inicio/InicioTecnico";
import SeguimientoItem from "@/components/SeguimientoItem";

type InteresFila = {
  id: string;
  cliente_id: string;
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

/**
 * Hoy: a quién contactar hoy, en una sola lista. Primero los que esperaban
 * un producto que llegó, después lo atrasado (con una línea que dice de
 * cuándo era, sin rojos) y lo de hoy. Abajo, los avisos de recompra y,
 * plegados, los próximos 7 días. Si no hay nada: "Al día".
 */
export default async function HoyPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; interes?: string }>;
}) {
  const { c, interes } = await searchParams;
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
        <h1 className="mb-3 text-2xl font-extrabold tracking-tight">Hoy</h1>
        <InicioTecnico userId={userId} />
      </div>
    );
  }

  const { quien, comercialId } = await filtroQuien(userId, esGestor);
  const [intereses, { data: usuariosData }, { data: recomprasData }, bandeja] = await Promise.all([
    (async () => {
      const todo: InteresFila[] = [];
      for (let desde = 0; desde < 3000; desde += 1000) {
        let q = supabase
          .from("oportunidades")
          .select(
            "id, cliente_id, etapa, temperatura, proximo_contacto, proximo_nota, ultimo_movimiento_at, mensaje_inicial, producto:productos(nombre), cliente:clientes!inner(nombre_comercial, telefono, deleted_at)"
          )
          .in("etapa", [...ETAPAS_ABIERTAS])
          .is("cliente.deleted_at", null)
          .order("id")
          .range(desde, desde + 999);
        if (comercialId) q = q.eq("comercial_id", comercialId);
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
        .lte("vence_el", hoy)
        .order("vence_el")
        .limit(50);
      if (comercialId) q = q.eq("usuario_id", comercialId);
      return q;
    })(),
    esGestor
      ? Promise.all([
          supabase.from("oportunidades").select("id", { count: "exact", head: true }).eq("etapa", "ganada").eq("pedido_estado", "comprometido").not("forma_pago", "is", null),
          supabase.from("ordenes_trabajo").select("id", { count: "exact", head: true }).in("estado", ["finalizado_tecnico", "revision_admin"]),
        ])
      : Promise.resolve(null),
  ]);

  const usuarios = (usuariosData ?? []) as { id: string; nombre: string; rol: string; activo: boolean }[];
  const nombres = new Map(usuarios.map((u) => [u.id, u.nombre]));
  const vendedores = usuarios
    .filter((u) => u.activo && ["comercial", "direccion", "admin"].includes(u.rol))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
  const bloques = clasificarPendientes(intereses, hoy);
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
  const lista: Pendiente[] = [
    ...bloques.llegoStock.map((i) => aPendiente(i, "Llegó stock")),
    ...bloques.atrasados.map((i) => aPendiente(i, `Era para el ${fechaCorta(i.proximo_contacto)}`)),
    ...bloques.hoy.map((i) => aPendiente(i)),
  ];
  const proximos = bloques.proximos.map((i) => aPendiente(i, fechaCorta(i.proximo_contacto)));
  const fecha = new Date(hoy + "T12:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <ConPanel c={c} interes={interes} cerrarHref="/hoy">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Hoy</h1>
            <p className="text-[15px] capitalize text-piedra">
              {fecha}
              {lista.length ? ` · ${lista.length} para contactar` : ""}
            </p>
          </div>
          {esGestor && <SelectorQuienDesplegable valor={quien} vendedores={vendedores} />}
        </div>

        {esGestor && (paraFacturar > 0 || paraRevisar > 0) && (
          <div className="grid gap-2 sm:grid-cols-2">
            {paraFacturar > 0 && (
              <Link href="/pedidos" className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-[15px] shadow-sm">
                <span className="font-bold">Ventas para facturar</span>
                <span className="rounded-full bg-marino px-2.5 py-0.5 text-xs font-extrabold text-white">{paraFacturar}</span>
              </Link>
            )}
            {paraRevisar > 0 && (
              <Link href="/servicio" className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-[15px] shadow-sm">
                <span className="font-bold">Services para revisar</span>
                <span className="rounded-full bg-marino px-2.5 py-0.5 text-xs font-extrabold text-white">{paraRevisar}</span>
              </Link>
            )}
          </div>
        )}

        {lista.length === 0 ? (
          <p className="rounded-2xl bg-white px-4 py-6 text-center text-lg font-bold text-verde shadow-sm">Al día.</p>
        ) : (
          <div className="space-y-2">
            {lista.map((p) => (
              <PendienteFila key={p.id} item={p} />
            ))}
          </div>
        )}

        {recompras.length > 0 && (
          <section>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-piedra">Recompras ({recompras.length})</h2>
            <div className="space-y-2">
              {recompras.map((t) => (
                <SeguimientoItem key={t.id} tarea={{ ...t, responsable: t.usuario_id ? nombres.get(t.usuario_id) : null }} />
              ))}
            </div>
          </section>
        )}

        {proximos.length > 0 && (
          <details className="group">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-[15px] font-bold text-piedra [&::-webkit-details-marker]:hidden">
              Próximos 7 días ({proximos.length})
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-2 space-y-2">
              {proximos.map((p) => (
                <PendienteFila key={p.id} item={p} />
              ))}
            </div>
          </details>
        )}
      </div>
    </ConPanel>
  );
}
