import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { cargarEmbudo, mesActual } from "@/lib/embudo";
import { textoMontos } from "@/lib/dinero";
import { hoyISO } from "@/lib/format";
import { filtroQuien } from "@/lib/quien";
import EmbudoBoard from "@/components/embudo/EmbudoBoard";
import { resumenConversaciones } from "@/lib/servidor/conversaciones";
import SelectorQuienDesplegable from "@/components/embudo/SelectorQuienDesplegable";
import ConPanel from "@/components/ficha/ConPanel";
import { ETAPAS_ABIERTAS } from "@/lib/constants";
import AvisoFlash from "@/components/AvisoFlash";

function mesVecino(mes: string, delta: number): string {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Embudo: la pantalla principal. Buscador y filtros arriba, resumen del mes,
 * las cinco columnas y, en PC, la ficha del contacto tocado al costado.
 */
export default async function EmbudoPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; interes?: string; mes?: string }>;
}) {
  const { c, interes, mes } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? "";
  const { data: yo } = await supabase.from("usuarios").select("rol").eq("id", userId).maybeSingle();
  const rol = yo?.rol ?? "comercial";
  const esGestor = ["direccion", "admin"].includes(rol);

  // Cada puesto abre en lo suyo: quien vende, en el embudo; el resto, en Mi día
  if (!["comercial", "direccion", "distribuidor"].includes(rol)) redirect("/hoy");

  const [sinContacto, casosAbiertos, aprobaciones, contenidosAprobar] = await Promise.all([
    supabase
      .from("oportunidades")
      .select("id", { count: "exact", head: true })
      .eq("comercial_id", userId)
      .in("etapa", [...ETAPAS_ABIERTAS])
      .not("asignado_at", "is", null)
      .is("primer_contacto_at", null),
    supabase.from("casos").select("id", { count: "exact", head: true }).eq("responsable_id", userId).neq("estado", "cerrado"),
    rol === "direccion"
      ? supabase.from("cotizacion_versiones").select("id", { count: "exact", head: true }).eq("aprobacion", "pendiente")
      : Promise.resolve({ count: 0 }),
    rol === "direccion"
      ? supabase.from("contenidos").select("id", { count: "exact", head: true }).eq("estado", "pendiente")
      : Promise.resolve({ count: 0 }),
  ]);
  const avisos = [
    { n: sinContacto.count ?? 0, texto: "sin primer contacto", href: "/hoy", cls: "bg-red-100 text-red-700" },
    { n: casosAbiertos.count ?? 0, texto: "casos abiertos", href: "/casos", cls: "bg-ambar-soft text-ambar" },
    { n: aprobaciones.count ?? 0, texto: "propuestas para aprobar", href: "/aprobaciones", cls: "bg-violeta-soft text-violeta" },
    { n: contenidosAprobar.count ?? 0, texto: "contenidos para aprobar", href: "/aprobaciones", cls: "bg-violeta-soft text-violeta" },
  ].filter((a) => a.n > 0);

  const { quien, comercialId } = await filtroQuien(userId, esGestor);
  const [datos, usuariosRes, charlasTodas] = await Promise.all([
    cargarEmbudo(supabase, { comercialId, mes }),
    esGestor ? supabase.from("usuarios").select("id, nombre, rol, activo") : Promise.resolve({ data: [] }),
    resumenConversaciones(supabase, null, userId),
  ]);
  // Al tablero va lo justo: cuántos mensajes y cuántos nuevos
  const charlas = Object.fromEntries(Object.entries(charlasTodas).map(([id, r]) => [id, { total: r.total, sinLeer: r.sinLeer }]));
  const vendedores = ((usuariosRes.data ?? []) as { id: string; nombre: string; rol: string; activo: boolean }[])
    .filter((u) => u.activo && ["comercial", "direccion", "admin"].includes(u.rol))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  const mesLabel = new Date(datos.mes + "-01T12:00:00").toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  const hrefMes = (m: string) => (m === mesActual() ? "/" : `/?mes=${m}`);
  const cerrarHref = hrefMes(datos.mes);
  const k = datos.kpis;

  const kpi = "rounded-2xl bg-white p-3 shadow-sm";
  const kpiTitulo = "text-[11px] font-bold uppercase tracking-wide text-piedra";
  const kpiNumero = "text-2xl font-extrabold tracking-tight";
  const kpiSub = "text-xs text-piedra";

  return (
    <ConPanel c={c} interes={interes} cerrarHref={cerrarHref}>
      <Suspense fallback={null}>
        <AvisoFlash />
      </Suspense>
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-extrabold tracking-tight">Embudo</h1>
          <form action="/clientes" method="get" className="relative min-w-0 flex-1 basis-56">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-piedra" />
            <input
              type="search"
              name="q"
              placeholder="Buscar contacto, teléfono, empresa o serie"
              className="min-h-11 w-full rounded-xl border border-borde bg-white py-2 pl-10 pr-3 text-[15px] outline-none focus:border-marino"
            />
          </form>
          {esGestor && <SelectorQuienDesplegable valor={quien} vendedores={vendedores} />}
          <div className="flex min-h-11 items-center gap-0.5 rounded-xl border border-borde bg-white px-1">
            <Link href={hrefMes(mesVecino(datos.mes, -1))} aria-label="Mes anterior" className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-crema">
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <span className="px-1 text-[15px] font-bold capitalize">{mesLabel}</span>
            <Link href={hrefMes(mesVecino(datos.mes, 1))} aria-label="Mes siguiente" className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-crema">
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {avisos.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {avisos.map((a) => (
              <Link key={a.href} href={a.href} className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-extrabold ${a.cls}`}>
                {a.n} {a.texto}
              </Link>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Link href="/hoy" className={kpi}>
            <p className={kpiTitulo}>Para contactar hoy</p>
            <p className={kpiNumero}>{k.paraHoy}</p>
            <p className={kpiSub}>{k.atrasados ? `${k.atrasados} de días anteriores` : "al día"}</p>
          </Link>
          <div className={kpi}>
            <p className={kpiTitulo}>Intereses abiertos</p>
            <p className={kpiNumero}>{k.abiertos}</p>
            <p className={kpiSub}>{Object.keys(k.montoAbierto).length ? textoMontos(k.montoAbierto) : "sin montos cotizados"}</p>
          </div>
          <Link href="/pedidos" className={kpi}>
            <p className={kpiTitulo}>Vendido en {mesLabel.split(" de ")[0]}</p>
            <p className={kpiNumero}>{Object.keys(k.montoVendidoMes).length ? textoMontos(k.montoVendidoMes) : k.vendidosMes}</p>
            <p className={kpiSub}>{k.vendidosMes} venta{k.vendidosMes === 1 ? "" : "s"}</p>
          </Link>
          <Link href="/stock" className={kpi}>
            <p className={kpiTitulo}>Lista de espera</p>
            <p className={kpiNumero}>{k.enEspera}</p>
            <p className={`${kpiSub} truncate`}>{k.productosEspera.join(", ") || "nadie esperando"}</p>
          </Link>
        </div>

        <EmbudoBoard columnas={datos.columnas} totales={datos.totales} hoy={hoyISO()} charlas={charlas} />
      </div>
    </ConPanel>
  );
}
