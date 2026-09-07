"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  HardDrive,
  HardHat,
  Landmark,
  Users,
  Wrench,
  Search,
  TrendingUp,
  Citrus,
  BookOpen,
  Settings,
  ShieldCheck,
  Megaphone,
  Package,
  Plus,
  Tent,
  Activity,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import Logo from "@/components/Logo";

type Item = { href: string; label: string; icono: LucideIcon; roles?: string[] };

const GESTORES = ["direccion", "admin"];

/** Lo de todos los días, arriba. El resto, plegado en "Más herramientas". */
const PRINCIPAL: Item[] = [
  { href: "/clientes", label: "Contactos", icono: Users },
  { href: "/pedidos", label: "Ventas", icono: Package, roles: ["direccion", "admin", "comercial", "marketing", "distribuidor"] },
  { href: "/servicio", label: "Services", icono: Wrench },
  { href: "/movimientos", label: "Movimientos", icono: Activity },
];

const HERRAMIENTAS: Item[] = [
  { href: "/hotelga", label: "HOTELGA", icono: Tent, roles: ["direccion", "admin", "comercial", "marketing"] },
  { href: "/equipos", label: "Equipos", icono: HardDrive },
  { href: "/instalaciones", label: "Instalaciones", icono: HardHat, roles: ["direccion", "admin", "tecnico"] },
  { href: "/pipeline", label: "Ventas por etapa", icono: BarChart3, roles: ["direccion", "admin", "comercial"] },
  { href: "/financiacion", label: "Financiación", icono: Landmark, roles: ["direccion", "admin", "comercial", "distribuidor"] },
  { href: "/calculadora", label: "Calculadora Zumex", icono: Citrus, roles: ["direccion", "admin", "comercial", "distribuidor"] },
  { href: "/biblioteca", label: "Biblioteca", icono: BookOpen, roles: ["direccion", "admin", "comercial", "marketing", "distribuidor"] },
  { href: "/marketing", label: "Marketing", icono: Megaphone, roles: ["direccion", "admin", "marketing"] },
  { href: "/reportes", label: "Reportes", icono: TrendingUp, roles: GESTORES },
  { href: "/admin", label: "Administración", icono: ShieldCheck, roles: GESTORES },
  { href: "/mas", label: "Configuración", icono: Settings },
];

export default function Sidebar({
  rol = "comercial",
  nombre,
  email,
  noLeidas = 0,
}: {
  rol?: string;
  nombre?: string | null;
  email?: string | null;
  noLeidas?: number;
}) {
  const pathname = usePathname();
  const visible = (i: Item) => !i.roles || i.roles.includes(rol);
  const crear =
    rol === "tecnico"
      ? { href: "/servicio/cargar", label: "Cargar service" }
      : { href: "/alta", label: "Nuevo contacto" };

  const activo = (href: string) =>
    href === "/clientes"
      ? pathname === "/" || pathname.startsWith("/clientes")
      : href === "/servicio"
        ? pathname === "/servicio" || /^\/servicio\/(?!cargar)/.test(pathname)
        : pathname.startsWith(href);

  const renderItem = (item: Item) => {
    const Icono = item.icono;
    const act = activo(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
          act
            ? "bg-celeste-soft font-semibold text-tinta"
            : "text-piedra hover:bg-crema hover:text-tinta"
        }`}
      >
        <Icono
          className={`h-[17px] w-[17px] ${act ? "text-celeste-deep" : ""}`}
          strokeWidth={act ? 2.3 : 2}
        />
        {item.label}
      </Link>
    );
  };

  const herramientas = HERRAMIENTAS.filter(visible);
  const algunaHerramientaActiva = herramientas.some((h) => activo(h.href));

  return (
    <aside className="sticky top-0 hidden h-dvh flex-col border-r border-borde bg-white lg:flex">
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
        <Logo />
        <span className="text-[15px] font-bold tracking-tight">
          GastroWare <span className="font-medium text-piedra">CRM</span>
        </span>
      </div>

      <div className="px-3">
        <Link
          href={crear.href}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-tinta py-2.5 text-sm font-semibold text-white transition-transform active:scale-[0.99]"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} /> {crear.label}
        </Link>
        <Link
          href="/buscar"
          className="mt-2 flex items-center gap-2 rounded-xl border border-borde px-3 py-2 text-sm text-piedra transition-colors hover:bg-crema"
        >
          <Search className="h-4 w-4" /> Buscar…
        </Link>
        <Link
          href="/notificaciones"
          className="mt-2 flex items-center justify-between rounded-xl border border-borde px-3 py-2 text-sm text-piedra transition-colors hover:bg-crema"
        >
          <span className="flex items-center gap-2">
            <Bell className="h-4 w-4" /> Notificaciones
          </span>
          {noLeidas > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-tinta px-1.5 text-[11px] font-bold text-white">
              {noLeidas > 9 ? "9+" : noLeidas}
            </span>
          )}
        </Link>
      </div>

      <nav className="mt-4 flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        <div className="space-y-0.5">{PRINCIPAL.filter(visible).map(renderItem)}</div>

        <details open={algunaHerramientaActiva}>
          <summary className="cursor-pointer px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-piedra/70 list-none [&::-webkit-details-marker]:hidden">
            Más herramientas ›
          </summary>
          <div className="space-y-0.5">{herramientas.map(renderItem)}</div>
        </details>
      </nav>

      <div className="border-t border-borde px-5 py-3.5">
        <p className="truncate text-sm font-semibold">{nombre ?? "Usuario"}</p>
        <p className="truncate text-xs text-piedra">{email}</p>
      </div>
    </aside>
  );
}
