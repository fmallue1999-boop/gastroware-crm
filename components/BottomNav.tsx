"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Filter, HardDrive, Home, Menu, Users, Wrench, type LucideIcon } from "lucide-react";

type Item = { href: string; label: string; icono: LucideIcon; badge?: number };

function estaActivo(href: string, pathname: string) {
  if (href === "/") return pathname === "/";
  if (href === "/clientes") return pathname.startsWith("/clientes");
  if (href === "/servicio") return pathname === "/servicio" || /^\/servicio\/(?!cargar)/.test(pathname);
  return pathname.startsWith(href);
}

/** Barra inferior del celular: cuatro cosas, nada más. El botón de cargar flota aparte. */
export default function BottomNav({ rol = "comercial", paraHoy = 0 }: { rol?: string; paraHoy?: number }) {
  const pathname = usePathname();
  const items: Item[] =
    rol === "tecnico"
      ? [
          { href: "/", label: "Inicio", icono: Home },
          { href: "/servicio", label: "Services", icono: Wrench },
          { href: "/equipos", label: "Equipos", icono: HardDrive },
          { href: "/mas", label: "Más", icono: Menu },
        ]
      : [
          { href: "/", label: "Embudo", icono: Filter },
          { href: "/hoy", label: "Hoy", icono: Home, badge: paraHoy },
          { href: "/clientes", label: "Contactos", icono: Users },
          { href: "/mas", label: "Más", icono: Menu },
        ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 border-t border-borde bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid max-w-2xl grid-cols-4">
        {items.map((item) => {
          const Icono = item.icono;
          const activo = estaActivo(item.href, pathname);
          return (
            <Link key={item.href} href={item.href} className="flex min-h-14 flex-col items-center justify-center gap-1 pt-2 pb-2">
              <span
                className={`relative flex h-7 items-center justify-center rounded-full px-4 transition-colors ${
                  activo ? "bg-celeste-soft text-marino" : "text-piedra"
                }`}
              >
                <Icono className="h-[20px] w-[20px]" strokeWidth={activo ? 2.4 : 2} />
                {item.badge ? (
                  <span className="absolute -right-1 -top-1.5 rounded-full bg-verde px-1.5 text-[0.65rem] font-extrabold leading-4 text-white">
                    {item.badge}
                  </span>
                ) : null}
              </span>
              <span className={`text-[0.6875rem] leading-none ${activo ? "font-extrabold text-marino" : "font-semibold text-piedra"}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
