"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bell,
  Boxes,
  Filter,
  HardDrive,
  Home,
  Menu,
  Package,
  Plus,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

type Item = { href: string; label: string; icono: LucideIcon; roles?: string[]; badge?: number };

const VENDEN = ["direccion", "admin", "comercial", "marketing", "distribuidor"];

function estaActivo(href: string, pathname: string) {
  if (href === "/") return pathname === "/";
  if (href === "/clientes") return pathname.startsWith("/clientes") && !pathname.startsWith("/clientes/importar");
  if (href === "/servicio") return pathname === "/servicio" || /^\/servicio\/(?!cargar)/.test(pathname);
  return pathname.startsWith(href);
}

/**
 * Barra lateral de la computadora: todo lo que existe, en orden de uso, y el
 * botón de cargar abajo. Azul marino, ítem activo más claro.
 */
export default function Rail({
  rol = "comercial",
  nombre,
  email,
  noLeidas = 0,
  paraHoy = 0,
}: {
  rol?: string;
  nombre?: string | null;
  email?: string | null;
  noLeidas?: number;
  paraHoy?: number;
}) {
  const pathname = usePathname();
  const tecnico = rol === "tecnico";
  const items: Item[] = tecnico
    ? [
        { href: "/", label: "Inicio", icono: Home },
        { href: "/servicio", label: "Services", icono: Wrench },
        { href: "/equipos", label: "Equipos", icono: HardDrive },
        { href: "/clientes", label: "Contactos", icono: Users },
        { href: "/stock", label: "Stock", icono: Boxes },
        { href: "/movimientos", label: "Movimientos", icono: Activity },
        { href: "/mas", label: "Más", icono: Menu },
      ]
    : [
        { href: "/", label: "Embudo", icono: Filter },
        { href: "/hoy", label: "Hoy", icono: Home, badge: paraHoy },
        { href: "/clientes", label: "Contactos", icono: Users },
        { href: "/pedidos", label: "Ventas", icono: Package, roles: VENDEN },
        { href: "/stock", label: "Stock", icono: Boxes },
        { href: "/servicio", label: "Services", icono: Wrench },
        { href: "/movimientos", label: "Movimientos", icono: Activity },
        { href: "/mas", label: "Más", icono: Menu },
      ];
  const crear = tecnico
    ? { href: "/servicio/cargar", label: "Cargar service hecho" }
    : { href: "/alta", label: "Nuevo interés" };

  return (
    <aside className="sticky top-0 hidden h-dvh flex-col bg-marino text-white/80 lg:flex">
      <Link href="/" className="flex items-center gap-2.5 px-5 pt-5 pb-4 text-white">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#6fc3e2] text-base font-extrabold text-marino">
          G
        </span>
        <span className="text-[16px] font-extrabold tracking-tight">GastroWare</span>
      </Link>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {items
          .filter((i) => !i.roles || i.roles.includes(rol))
          .map((item) => {
            const Icono = item.icono;
            const activo = estaActivo(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-[15px] font-semibold transition-colors ${
                  activo ? "bg-marino-2 text-white" : "hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icono className="h-[18px] w-[18px]" strokeWidth={activo ? 2.4 : 2} />
                {item.label}
                {item.badge ? (
                  <span className="ml-auto rounded-full bg-verde px-2 py-0.5 text-[11px] font-extrabold text-white">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        <Link
          href="/notificaciones"
          className={`flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-[15px] font-semibold transition-colors ${
            pathname.startsWith("/notificaciones") ? "bg-marino-2 text-white" : "hover:bg-white/10 hover:text-white"
          }`}
        >
          <Bell className="h-[18px] w-[18px]" strokeWidth={2} />
          Avisos
          {noLeidas > 0 && (
            <span className="ml-auto rounded-full bg-ambar px-2 py-0.5 text-[11px] font-extrabold text-white">
              {noLeidas > 9 ? "9+" : noLeidas}
            </span>
          )}
        </Link>
      </nav>

      <div className="px-3 pb-3">
        <Link
          href={crear.href}
          className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-verde text-[15px] font-extrabold text-white transition-transform active:scale-[0.99]"
        >
          <Plus className="h-5 w-5" strokeWidth={2.6} /> {crear.label}
        </Link>
      </div>
      <div className="border-t border-white/10 px-5 py-3.5">
        <p className="truncate text-sm font-bold text-white">{nombre ?? "Usuario"}</p>
        <p className="truncate text-xs text-white/60">{email}</p>
      </div>
    </aside>
  );
}
