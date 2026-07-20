"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/hoy", label: "Hoy", icon: "☀️" },
  { href: "/pipeline", label: "Pipeline", icon: "📊" },
  { href: "/alta", label: "Nuevo", icon: "➕" },
  { href: "/clientes", label: "Clientes", icon: "👥" },
  { href: "/mas", label: "Más", icon: "⚙️" },
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 border-t border-borde bg-white">
      <div className="mx-auto max-w-2xl grid grid-cols-5">
        {items.map((item) => {
          const activo =
            item.href === "/hoy"
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
