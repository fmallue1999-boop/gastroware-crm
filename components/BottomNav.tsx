"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const POR_ROL: Record<
  string,
  { href: string; label: string; icon: string }[]
> = {
  vendedor: [
    { href: "/hoy", label: "Hoy", icon: "☀️" },
    { href: "/pipeline", label: "Pipeline", icon: "📊" },
    { href: "/alta", label: "Nuevo", icon: "➕" },
    { href: "/clientes", label: "Clientes", icon: "👥" },
    { href: "/mas", label: "Más", icon: "⚙️" },
  ],
  admin: [
    { href: "/hoy", label: "Hoy", icon: "☀️" },
    { href: "/servicio", label: "Servicio", icon: "🔧" },
    { href: "/alta", label: "Nuevo", icon: "➕" },
    { href: "/clientes", label: "Clientes", icon: "👥" },
    { href: "/mas", label: "Más", icon: "⚙️" },
  ],
  tecnico: [
    { href: "/servicio", label: "Agenda", icon: "🔧" },
    { href: "/servicio/nueva", label: "Nueva OT", icon: "➕" },
    { href: "/clientes", label: "Clientes", icon: "👥" },
    { href: "/buscar", label: "Buscar", icon: "🔍" },
    { href: "/mas", label: "Más", icon: "⚙️" },
  ],
};

export default function BottomNav({ rol = "vendedor" }: { rol?: string }) {
  const pathname = usePathname();
  const items = POR_ROL[rol] ?? POR_ROL.vendedor;
  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 border-t border-borde bg-white">
      <div className="mx-auto max-w-2xl grid grid-cols-5">
        {items.map((item) => {
          const activo =
            item.href === "/servicio/nueva"
              ? pathname === "/servicio/nueva"
              : item.href === "/servicio"
                ? pathname === "/servicio" || /^\/servicio\/(?!nueva)/.test(pathname)
                : item.href === "/hoy"
                  ? pathname === "/hoy" || pathname === "/"
                  : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] ${
                activo ? "text-tinta font-semibold" : "text-piedra/80"
              }`}
            >
              <span className="text-lg leading-none" aria-hidden>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
