"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HardDrive,
  Plus,
  Users,
  Menu,
  Wrench,
  Package,
  type LucideIcon,
} from "lucide-react";

type Item = { href: string; label: string; icono: LucideIcon; central?: boolean };

const EQUIPO: Item[] = [
  { href: "/clientes", label: "Contactos", icono: Users },
  { href: "/pedidos", label: "Ventas", icono: Package },
  { href: "/alta", label: "Nuevo", icono: Plus, central: true },
  { href: "/servicio", label: "Services", icono: Wrench },
  { href: "/mas", label: "Más", icono: Menu },
];

const TECNICO: Item[] = [
  { href: "/clientes", label: "Contactos", icono: Users },
  { href: "/servicio", label: "Services", icono: Wrench },
  { href: "/servicio/cargar", label: "Cargar", icono: Plus, central: true },
  { href: "/equipos", label: "Equipos", icono: HardDrive },
  { href: "/mas", label: "Más", icono: Menu },
];

/** Una sola barra para todo el equipo; el técnico tiene su variante. */
export default function BottomNav({ rol = "comercial" }: { rol?: string }) {
  const pathname = usePathname();
  const items = rol === "tecnico" ? TECNICO : EQUIPO;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 border-t border-borde bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid max-w-2xl grid-cols-5">
        {items.map((item) => {
          const Icono = item.icono;
          const activo = item.central
            ? pathname === item.href
            : item.href === "/servicio"
              ? pathname === "/servicio" || /^\/servicio\/(?!cargar)/.test(pathname)
              : item.href === "/clientes"
                ? pathname === "/" || pathname.startsWith("/clientes")
                : pathname.startsWith(item.href);

          if (item.central) {
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                className="flex flex-col items-center pt-1.5 pb-2"
              >
                <span className="-mt-6 flex h-13 w-13 items-center justify-center rounded-full bg-tinta text-white shadow-lg shadow-tinta/25 transition-transform active:scale-95">
                  <Icono className="h-6 w-6" strokeWidth={2.25} />
                </span>
                <span className="mt-1 text-[10.5px] leading-none text-piedra">{item.label}</span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className="group flex flex-col items-center gap-1 pt-2 pb-2"
            >
              <span
                className={`flex h-7 items-center justify-center rounded-full px-4 transition-colors ${
                  activo ? "bg-celeste-soft text-tinta" : "text-piedra"
                }`}
              >
                <Icono className="h-[19px] w-[19px]" strokeWidth={activo ? 2.4 : 2} />
              </span>
              <span
                className={`text-[10.5px] leading-none ${
                  activo ? "font-semibold text-tinta" : "text-piedra"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
