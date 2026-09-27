import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ETAPAS_ABIERTAS } from "@/lib/constants";
import { clasificarPendientes } from "@/lib/pendientes";
import { fechaCorta, hoyISO } from "@/lib/format";
import { filtroQuien } from "@/lib/quien";
import { nombrePuesto } from "@/lib/puestos";
import { cargarMiDia } from "@/lib/servidor/midia";
import ConPanel from "@/components/ficha/ConPanel";
import PendienteFila, { type Pendiente } from "@/components/inicio/PendienteFila";
import SelectorQuienDesplegable from "@/components/embudo/SelectorQuienDesplegable";
import InicioTecnico from "@/components/inicio/InicioTecnico";
import SeguimientoItem from "@/components/SeguimientoItem";
import Bandejas from "@/components/midia/Bandejas";

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
type TareaFila = {
  id: string;
  titulo: string;
  vence_el: string;
  cliente_id: string;
  usuario_id: string | null;
  cliente: { nombre_comercial: string; telefono: string | null } | null;
};

const ahora = () => Date.now();

/**
 * Mi día (docs/MODELO-OPERATIVO.md, sección 3): lo que le toca hoy a cada
 * puesto, en bandejas. Quien vende ve además a quién contactar hoy (lo que
 * llegó de stock, lo atrasado y lo de hoy), la postventa y los recontactos.
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
  const rol = (yo?.rol as string | undefined) ?? "comercial";
  const esGestor = ["direccion", "admin"].includes(rol);
  const hoy = hoyISO();
  const fecha = new Date(hoy + "T12:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
  const vende = ["comercial", "direccion", "distribuidor"].includes(rol);
  const bandejas = await cargarMiDia(supabase, { rol, userId, hoy, ahora: ahora() });

  const encabezado = (extra?: React.ReactNode) => (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Mi día</h1>
        <p className="text-[15px] text-piedra">
          <span className="capitalize">{fecha}</span> · {nombrePuesto(rol)}
        </p>
      </div>
      {extra}
    </div>
  );

  if (rol === "tecnico") {
    return (
      <div className="space-y-4">
        {encabezado()}
        <Bandejas bandejas={bandejas} />
        <InicioTecnico userId={userId} />
      </div>
    );
  }

  // Recontactos de consumibles: los hace la administrativa (y el vendedor los suyos)
  const tareasDe = (tipo: string, soloMias: boolean) => {
    let q = supabase
      .from("tareas")
      .select("id, titulo, vence_el, cliente_id, usuario_id, cliente:clientes(nombre_comercial, telefono)")
      .eq("tipo", tipo)
      .is("completada_at", null)
      .eq("cancelada", false)
      .lte("vence_el", hoy)
      .order("vence_el")
      .limit(50);
    if (soloMias) q = q.eq("usuario_id", userId);
    return q;
  };

  if (!vende) {
    const { data: recomprasData } = rol === "administrativa" ? await tareasDe("recompra", false) : { data: [] };
    const recompras = (recomprasData ?? []) as unknown as TareaFila[];
    return (
      <ConPanel c={c} interes={interes} cerrarHref="/hoy">
        <div className="space-y-4">
          {encabezado(
            esGestor ? (
              <Link href="/tablero" className="inline-flex min-h-11 items-center rounded-xl border border-borde bg-white px-4 text-[15px] font-bold">
                Tablero
              </Link>
            ) : null
          )}
          <Bandejas bandejas={bandejas.filter((b) => b.clave !== "recompras")} />
          {recompras.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-piedra">Recontactos de consumibles ({recompras.length})</h2>
              <div className="space-y-2">
                {recompras.map((t) => (
                  <SeguimientoItem key={t.id} tarea={t} />
                ))}
              </div>
            </section>
          )}
        </div>
      </ConPanel>
    );
  }

  const { quien, comercialId } = await filtroQuien(userId, esGestor);
  const [intereses, { data: usuariosData }, { data: recomprasData }, { data: postventaData }] = await Promise.all([
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
    tareasDe("recompra", true),
    tareasDe("postventa", true),
  ]);

  const usuarios = (usuariosData ?? []) as { id: string; nombre: string; rol: string; activo: boolean }[];
  const nombres = new Map(usuarios.map((u) => [u.id, u.nombre]));
  const vendedores = usuarios
    .filter((u) => u.activo && ["comercial", "direccion", "admin"].includes(u.rol))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
  const bloques = clasificarPendientes(intereses, hoy);
  const recompras = (recomprasData ?? []) as unknown as TareaFila[];
  const postventa = (postventaData ?? []) as unknown as TareaFila[];

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
  // Lo que ya aparece en las listas de abajo no se repite como bandeja
  const bandejasVenta = bandejas.filter((b) => !["postventa", "primer_contacto"].includes(b.clave));
  const sinPrimerContacto = bandejas.find((b) => b.clave === "primer_contacto")?.cantidad ?? 0;

  return (
    <ConPanel c={c} interes={interes} cerrarHref="/hoy">
      <div className="space-y-4">
        {encabezado(esGestor ? <SelectorQuienDesplegable valor={quien} vendedores={vendedores} /> : null)}

        <Bandejas bandejas={bandejasVenta} />

        <section>
          <h2 className="mb-2 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wide text-piedra">
            Para contactar hoy ({lista.length})
            {sinPrimerContacto > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 normal-case text-red-700">
                {sinPrimerContacto} sin primer contacto: dentro de la hora
              </span>
            )}
          </h2>
          {lista.length === 0 ? (
            <p className="rounded-2xl bg-white px-4 py-6 text-center text-lg font-bold text-verde shadow-sm">Al día.</p>
          ) : (
            <div className="space-y-2">
              {lista.map((p) => (
                <PendienteFila key={p.id} item={p} />
              ))}
            </div>
          )}
        </section>

        {postventa.length > 0 && (
          <section>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-piedra">Postventa del día ({postventa.length})</h2>
            <div className="space-y-2">
              {postventa.map((t) => (
                <SeguimientoItem key={t.id} tarea={{ ...t, responsable: t.usuario_id ? nombres.get(t.usuario_id) : null }} />
              ))}
            </div>
          </section>
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
