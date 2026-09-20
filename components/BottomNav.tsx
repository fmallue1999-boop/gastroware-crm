"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HardDrive,
  Home,
  Plus,
  Users,
  Menu,
  Wrench,
  Package,
  type LucideIcon,
} from "lucide-react";

type Item = { href: string; label: string; icono: LucideIcon; central?: boolean };

/** Vendedores, dirección y administración: Inicio · Contactos · + Interés · Ventas · Más. */
const GESTION: Item[] = [
  { href: "/", label: "Inicio", icono: Home },
  { href: "/clientes#contactos", label: "Contactos", icono: Users },
  { href: "/alta", label: "Interés", icono: Plus, central: true },
  { href: "/pedidos", label: "Ventas", icono: Package },
  { href: "/mas", label: "Más", icono: Menu },
];

/** Técnico: Inicio · Services · Cargar service · Equipos · Más. */
const TECNICO: Item[] = [
  { href: "/", label: "Inicio", icono: Home },
  { href: "/servicio", label: "Services", icono: Wrench },
  { href: "/servicio/cargar", label: "Cargar", icono: Plus, central: true },
  { href: "/equipos", label: "Equipos", icono: HardDrive },
  { href: "/mas", label: "Más", icono: Menu },
];

function estaActivo(href: string, pathname: string) {
  if (href === "/") return pathname === "/";
  if (href.startsWith("/clientes")) return pathname.startsWith("/clientes");
  if (href === "/servicio") return pathname === "/servicio" || /^\/servicio\/(?!cargar)/.test(pathname);
  if (href === "/alta" || href === "/servicio/cargar") return pathname === href;
  return pathname.startsWith(href);
}

/** Barra inferior del celular (Etapa 1, 1.8). */
export default function BottomNav({ rol = "comercial" }: { rol?: string }) {
  const pathname = usePathname();
  const items = rol === "tecnico" ? TECNICO : GESTION;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 border-t border-borde bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid max-w-2xl grid-cols-5">
        {items.map((item) => {
          const Icono = item.icono;
          const activo = estaActivo(item.href, pathname);

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
                <span className="mt-1 text-[0.6875rem] leading-none text-piedra">{item.label}</span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className="group flex min-h-14 flex-col items-center justify-center gap-1 pt-2 pb-2"
            >
              <span
                className={`flex h-7 items-center justify-center rounded-full px-4 transition-colors ${
                  activo ? "bg-celeste-soft text-tinta" : "text-piedra"
                }`}
              >
                <Icono className="h-[20px] w-[20px]" strokeWidth={activo ? 2.4 : 2} />
              </span>
              <span className={`text-[0.6875rem] leading-none ${activo ? "font-semibold text-tinta" : "text-piedra"}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
