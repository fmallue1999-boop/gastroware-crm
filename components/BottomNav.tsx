"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sun,
  BarChart3,
  Plus,
  Users,
  Menu,
  Wrench,
  Search,
  type LucideIcon,
} from "lucide-react";

type Item = { href: string; label: string; icono: LucideIcon; central?: boolean };

const POR_ROL: Record<string, Item[]> = {
  vendedor: [
    { href: "/hoy", label: "Hoy", icono: Sun },
    { href: "/pipeline", label: "Pipeline", icono: BarChart3 },
    { href: "/alta", label: "Nuevo", icono: Plus, central: true },
    { href: "/clientes", label: "Clientes", icono: Users },
    { href: "/mas", label: "Más", icono: Menu },
  ],
  admin: [
    { href: "/hoy", label: "Hoy", icono: Sun },
    { href: "/servicio", label: "Servicio", icono: Wrench },
    { href: "/alta", label: "Nuevo", icono: Plus, central: true },
    { href: "/clientes", label: "Clientes", icono: Users },
    { href: "/mas", label: "Más", icono: Menu },
  ],
  tecnico: [
    { href: "/servicio", label: "Agenda", icono: Wrench },
    { href: "/clientes", label: "Clientes", icono: Users },
    { href: "/servicio/nueva", label: "Nueva OT", icono: Plus, central: true },
    { href: "/buscar", label: "Buscar", icono: Search },
    { href: "/mas", label: "Más", icono: Menu },
  ],
};
POR_ROL.direccion = POR_ROL.admin;
POR_ROL.comercial = POR_ROL.vendedor;
POR_ROL.marketing = POR_ROL.vendedor;
POR_ROL.distribuidor = POR_ROL.vendedor;

export default function BottomNav({ rol = "comercial" }: { rol?: string }) {
  const pathname = usePathname();
  const items = POR_ROL[rol] ?? POR_ROL.comercial;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 border-t border-borde bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid max-w-2xl grid-cols-5">
        {items.map((item) => {
          const Icono = item.icono;
          const activo =
            item.href === "/servicio/nueva"
              ? pathname === "/servicio/nueva"
              : item.href === "/servicio"
                ? pathname === "/servicio" ||
                  /^\/servicio\/(?!nueva)/.test(pathname)
                : item.href === "/hoy"
                  ? pathname === "/hoy" || pathname === "/"
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
