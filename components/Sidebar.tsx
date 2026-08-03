"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sun,
  BarChart3,
  Users,
  Wrench,
  Search,
  TrendingUp,
  Citrus,
  BookOpen,
  Settings,
  Plus,
  type LucideIcon,
} from "lucide-react";
import Logo from "@/components/Logo";

type Item = { href: string; label: string; icono: LucideIcon };

const SECCIONES: Record<string, { grupo: string; items: Item[] }[]> = {
  admin: [
    {
      grupo: "Operación",
      items: [
        { href: "/hoy", label: "Inicio", icono: Sun },
        { href: "/pipeline", label: "Pipeline", icono: BarChart3 },
        { href: "/servicio", label: "Servicio técnico", icono: Wrench },
        { href: "/clientes", label: "Clientes", icono: Users },
      ],
    },
    {
      grupo: "Análisis",
      items: [
        { href: "/reportes", label: "Reportes", icono: TrendingUp },
      ],
    },
    {
      grupo: "Herramientas",
      items: [
        { href: "/calculadora", label: "Calculadora Zumex", icono: Citrus },
        { href: "/biblioteca", label: "Biblioteca", icono: BookOpen },
        { href: "/mas", label: "Configuración", icono: Settings },
      ],
    },
  ],
  vendedor: [
    {
      grupo: "Operación",
      items: [
        { href: "/hoy", label: "Inicio", icono: Sun },
        { href: "/pipeline", label: "Pipeline", icono: BarChart3 },
        { href: "/clientes", label: "Clientes", icono: Users },
      ],
    },
    {
      grupo: "Herramientas",
      items: [
        { href: "/calculadora", label: "Calculadora Zumex", icono: Citrus },
        { href: "/biblioteca", label: "Biblioteca", icono: BookOpen },
        { href: "/mas", label: "Configuración", icono: Settings },
      ],
    },
  ],
  tecnico: [
    {
      grupo: "Operación",
      items: [
        { href: "/servicio", label: "Agenda", icono: Wrench },
        { href: "/clientes", label: "Clientes", icono: Users },
      ],
    },
    {
      grupo: "Herramientas",
      items: [{ href: "/mas", label: "Configuración", icono: Settings }],
    },
  ],
};

export default function Sidebar({
  rol = "vendedor",
  nombre,
  email,
}: {
  rol?: string;
  nombre?: string | null;
  email?: string | null;
}) {
  const pathname = usePathname();
  const secciones = SECCIONES[rol] ?? SECCIONES.vendedor;
  const crear =
    rol === "tecnico"
      ? { href: "/servicio/nueva", label: "Nueva orden" }
      : { href: "/alta", label: "Nuevo lead" };

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
      </div>

      <nav className="mt-4 flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {secciones.map((s) => (
          <div key={s.grupo}>
            <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-piedra/70">
              {s.grupo}
            </p>
            <div className="space-y-0.5">
              {s.items.map((item) => {
                const Icono = item.icono;
                const activo =
                  item.href === "/hoy"
                    ? pathname === "/hoy" || pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                      activo
                        ? "bg-celeste-soft font-semibold text-tinta"
                        : "text-piedra hover:bg-crema hover:text-tinta"
                    }`}
                  >
                    <Icono
                      className={`h-[17px] w-[17px] ${activo ? "text-celeste-deep" : ""}`}
                      strokeWidth={activo ? 2.3 : 2}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-borde px-5 py-3.5">
        <p className="truncate text-sm font-semibold">{nombre ?? "Usuario"}</p>
        <p className="truncate text-xs text-piedra">{email}</p>
      </div>
    </aside>
  );
}
