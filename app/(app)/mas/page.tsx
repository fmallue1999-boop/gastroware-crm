import Link from "next/link";
import {
  Wrench,
  BarChart3,
  TrendingUp,
  Citrus,
  BookOpen,
  HardHat,
  KeyRound,
  Landmark,
  Package,
  Smartphone,
  LogOut,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { cerrarSesion } from "@/lib/actions";
import PushToggle from "@/components/PushToggle";
import ConfigForm from "@/components/ConfigForm";

function MenuLink({
  href,
  icono: Icono,
  titulo,
  detalle,
}: {
  href: string;
  icono: LucideIcon;
  titulo: string;
  detalle: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-borde bg-white p-3.5 shadow-sm transition-colors hover:border-celeste-deep"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-crema text-tinta/80">
        <Icono className="h-5 w-5" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{titulo}</span>
        <span className="block text-xs text-piedra">{detalle}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-piedra/60" />
    </Link>
  );
}

export default async function MasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [clientes, abiertas, ganadas, { data: yo }, { data: cfgTarifa }] =
    await Promise.all([
      supabase.from("clientes").select("id", { count: "exact", head: true }),
      supabase
        .from("oportunidades")
        .select("id", { count: "exact", head: true })
        .in("etapa", ["nueva", "cotizada", "seguimiento"]),
      supabase
        .from("oportunidades")
        .select("id", { count: "exact", head: true })
        .eq("etapa", "ganada"),
      supabase.from("usuarios").select("rol, nombre").eq("id", user!.id).single(),
      supabase.from("config").select("valor").eq("clave", "tarifa_hora").maybeSingle(),
    ]);
  const esAdmin = ["direccion", "admin"].includes(yo?.rol ?? "");

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Más</h1>

      <section className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-borde bg-white p-3 text-center shadow-sm">
          <p className="text-2xl font-bold tracking-tight">{clientes.count ?? 0}</p>
          <p className="text-xs text-piedra">Clientes</p>
        </div>
        <div className="rounded-2xl border border-borde bg-white p-3 text-center shadow-sm">
          <p className="text-2xl font-bold tracking-tight">{abiertas.count ?? 0}</p>
          <p className="text-xs text-piedra">Abiertas</p>
        </div>
        <div className="rounded-2xl border border-borde bg-white p-3 text-center shadow-sm">
          <p className="text-2xl font-bold tracking-tight">{ganadas.count ?? 0}</p>
          <p className="text-xs text-piedra">Ganadas</p>
        </div>
      </section>

      <section className="space-y-2">
        <MenuLink
          href="/servicio"
          icono={Wrench}
          titulo="Servicio técnico"
          detalle="Órdenes de trabajo, agenda y facturación"
        />
        <MenuLink
          href="/instalaciones"
          icono={HardHat}
          titulo="Instalaciones"
          detalle="Control de instalaciones: gastos, serie, fecha y cobro"
        />
        <MenuLink
          href="/pipeline"
          icono={BarChart3}
          titulo="Pipeline de ventas"
          detalle="Kanban de oportunidades por etapa"
        />
        <MenuLink
          href="/pedidos"
          icono={Package}
          titulo="Pedidos"
          detalle="De la venta ganada a la entrega: factura, pago y envío"
        />
        <MenuLink
          href="/reportes"
          icono={TrendingUp}
          titulo="Reportes"
          detalle="Embudo, canales, rubros y motivos de pérdida"
        />
        <MenuLink
          href="/calculadora"
          icono={Citrus}
          titulo="Calculadora Zumex"
          detalle="Recupero de inversión, lista para mandar al cliente"
        />
        <MenuLink
          href="/financiacion"
          icono={Landmark}
          titulo="Financiación bancaria"
          detalle="Planes BNA en cuotas: hoja con todas las opciones para el cliente"
        />
        <MenuLink
          href="/biblioteca"
          icono={BookOpen}
          titulo="Biblioteca comercial"
          detalle="Fichas, videos, comparativas y casos"
        />
        <MenuLink
          href="/password"
          icono={KeyRound}
          titulo="Cambiar contraseña"
          detalle="Poné una contraseña tuya, sobre todo si te dieron una inicial"
        />
      </section>

      <PushToggle />

      {esAdmin && <ConfigForm tarifaActual={cfgTarifa?.valor ?? "0"} />}

      <section className="flex items-start gap-3 rounded-2xl border border-dashed border-borde p-4 text-sm text-piedra">
        <Smartphone className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={2} />
        <p>
          <span className="font-medium text-tinta/70">
            Instalala en el celular:
          </span>{" "}
          abrí esta página desde el navegador del teléfono y elegí “Agregar a
          pantalla de inicio”.
        </p>
      </section>

      <section className="rounded-2xl border border-borde bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold">{yo?.nombre ?? "Usuario"}</p>
        <p className="text-xs text-piedra">{user?.email}</p>
        <form action={cerrarSesion} className="mt-3">
          <button className="flex items-center gap-1.5 rounded-2xl border border-borde px-3.5 py-2 text-sm text-tinta/70">
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </button>
        </form>
      </section>
    </div>
  );
}
