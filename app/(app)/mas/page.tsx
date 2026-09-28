import Link from "next/link";
import {
  Activity,
  BarChart3,
  BookOpen,
  Boxes,
  Citrus,
  HardDrive,
  HardHat,
  KeyRound,
  Landmark,
  LogOut,
  Megaphone,
  ShieldCheck,
  Smartphone,
  Tent,
  TrendingUp,
  UserPlus,
  ChevronRight,
  LifeBuoy,
  Wallet,
  BadgeCheck,
  ClipboardList,
  Palette,
  PlayCircle,
  Users,
  Package,
  CircleHelp,
  Sparkles,
  Newspaper,
  CalendarCheck,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { cerrarSesion } from "@/lib/actions";
import PushToggle from "@/components/PushToggle";
import { versionCorta } from "@/lib/novedades";
import { nombrePuesto, veTodo, esGestor as esGestorPuesto } from "@/lib/puestos";

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

/** Todo lo que no es de todos los días vive acá, ordenado por para qué sirve. */
export default async function MasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: yo } = await supabase.from("usuarios").select("rol, nombre").eq("id", user!.id).single();
  const rol = yo?.rol ?? "comercial";
  const esAdmin = esGestorPuesto(rol);
  const esTecnico = rol === "tecnico";

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Más</h1>

      <MenuLink
        href="/tareas"
        icono={CalendarCheck}
        titulo="Tareas y agenda"
        detalle="Tareas, reuniones, capacitaciones y pagos: los tuyos y los que asignás"
      />
      <MenuLink
        href="/asistente"
        icono={Sparkles}
        titulo="Asistente IA"
        detalle="Preguntale con tus palabras: tus pendientes, un contacto, cómo se hace algo"
      />
      <MenuLink
        href="/guia"
        icono={CircleHelp}
        titulo="Guía de uso"
        detalle="Cómo se trabaja en el CRM según tu puesto, paso a paso"
      />
      <MenuLink
        href="/novedades"
        icono={Newspaper}
        titulo={`Novedades · GastroWare OS ${versionCorta()}`}
        detalle="Qué cambió en cada versión"
      />

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-piedra">
          Circuitos del manual
        </h2>
        <MenuLink href="/pedidos" icono={Package} titulo="Ventas" detalle="Vendido → facturado → cobrado → preparar → despachado → entregado" />
        <MenuLink href="/casos" icono={LifeBuoy} titulo="Casos de postventa" detalle="Reclamos con plazo: respuesta en 24 h hábiles, cierre en 5 días" />
        {veTodo(rol) && (
          <MenuLink href="/cobranzas" icono={Wallet} titulo="Cobranzas" detalle="Vencidas, vencen hoy y en 48 h; promesas y reclamos" />
        )}
        {esAdmin && (
          <MenuLink href="/aprobaciones" icono={BadgeCheck} titulo="Aprobaciones" detalle="Propuestas fuera de lista esperando a dirección" />
        )}
        {rol === "comercial" && (
          <MenuLink href="/informe" icono={ClipboardList} titulo="Mi informe semanal" detalle="Los lunes antes de las 10: números, bloqueos, decisiones y agenda" />
        )}
        {esAdmin && (
          <MenuLink href="/informes" icono={ClipboardList} titulo="Informes comerciales" detalle="Los informes de los lunes de cada vendedor, para responder" />
        )}
        <MenuLink href="/marketing/pedidos" icono={Palette} titulo="Pedidos de material" detalle="Pedirle a marketing folletos, videos, fichas o posteos" />
        {(esAdmin || rol === "marketing") && (
          <MenuLink href="/marketing/videos" icono={PlayCircle} titulo="Videos por modelo" detalle="El video instructivo que se manda con cada despacho" />
        )}
        {(veTodo(rol) || rol === "tecnico") && (
          <MenuLink href="/servicio/aliados" icono={Users} titulo="Técnicos aliados" detalle="Quiénes atienden fuera de Mar del Plata y zona" />
        )}
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-piedra">
          Para el trabajo
        </h2>
        <MenuLink
          href="/clientes/nuevo"
          icono={UserPlus}
          titulo="Contacto sin interés"
          detalle="Cargar a alguien sin una consulta puntual (cliente de service, cartera)"
        />
        <MenuLink
          href="/stock"
          icono={Boxes}
          titulo="Stock"
          detalle="Qué hay, qué llega y cuándo, y quiénes esperan cada equipo"
        />
        <MenuLink
          href="/movimientos"
          icono={Activity}
          titulo="Movimientos"
          detalle="Todo lo que anotó, vendió y arregló el equipo, en orden"
        />
        <MenuLink
          href="/equipos"
          icono={HardDrive}
          titulo="Equipos"
          detalle="Buscar por número de serie, garantías y fichas de equipos"
        />
        {!esTecnico && (
          <MenuLink
            href="/hotelga"
            icono={Tent}
            titulo="HOTELGA"
            detalle="Captura de visitantes de la feria: foto a la credencial y listo"
          />
        )}
        {(esAdmin || esTecnico) && (
          <MenuLink
            href="/instalaciones"
            icono={HardHat}
            titulo="Instalaciones"
            detalle="Control de instalaciones: gastos, serie, fecha y cobro"
          />
        )}
      </section>

      {!esTecnico && (
        <section className="space-y-2">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-piedra">
            Para vender
          </h2>
          <MenuLink
            href="/financiacion"
            icono={Landmark}
            titulo="Financiación bancaria"
            detalle="Planes BNA en cuotas: hoja con todas las opciones para el cliente"
          />
          <MenuLink
            href="/calculadora"
            icono={Citrus}
            titulo="Calculadora Zumex"
            detalle="Recupero de inversión, lista para mandar al cliente"
          />
          <MenuLink
            href="/biblioteca"
            icono={BookOpen}
            titulo="Biblioteca comercial"
            detalle="Fichas, videos, comparativas y casos"
          />
          <MenuLink
            href="/pipeline"
            icono={BarChart3}
            titulo="Tablero de intereses"
            detalle="Todos los intereses abiertos, en columnas según en qué están"
          />
        </section>
      )}

      {esAdmin && (
        <section className="space-y-2">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-piedra">
            Dirección
          </h2>
          <MenuLink
            href="/tablero"
            icono={TrendingUp}
            titulo="Tablero"
            detalle="Cómo está el negocio: vendido, intereses, atrasados por vendedor y alertas"
          />
          <MenuLink
            href="/marketing"
            icono={Megaphone}
            titulo="Marketing"
            detalle="Segmentos y campañas por email y WhatsApp"
          />
          <MenuLink
            href="/admin"
            icono={ShieldCheck}
            titulo="Administración"
            detalle="Equipo y puestos, territorios, reglas, catálogo, plantillas y logo"
          />
        </section>
      )}

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-piedra">
          Tu cuenta
        </h2>
        <MenuLink
          href="/password"
          icono={KeyRound}
          titulo="Cambiar contraseña"
          detalle="Poné una contraseña tuya, sobre todo si te dieron una inicial"
        />
        <PushToggle />
      </section>

      <section className="flex items-start gap-3 rounded-2xl border border-dashed border-borde p-4 text-sm text-piedra">
        <Smartphone className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={2} />
        <p>
          <span className="font-medium text-tinta/70">Instalala en el celular:</span>{" "}
          abrí esta página desde el navegador del teléfono y elegí “Agregar a
          pantalla de inicio”.
        </p>
      </section>

      <section className="rounded-2xl border border-borde bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold">{yo?.nombre ?? "Usuario"}</p>
        <p className="text-xs text-piedra">{nombrePuesto(rol)}</p>
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
