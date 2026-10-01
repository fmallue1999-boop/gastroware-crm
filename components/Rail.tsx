"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Plus } from "lucide-react";
import { botonCrear, estaActivo, menuDe } from "@/lib/navegacion";
import { nombrePuesto } from "@/lib/puestos";
import { ICONOS_MENU } from "@/components/iconosMenu";
import LogoSistema from "@/components/marca/LogoSistema";
import { MARCA_POR_DEFECTO, type Marca } from "@/lib/marca";
import { versionCorta } from "@/lib/novedades";

/**
 * Barra lateral de la computadora: lo del puesto primero, en orden de uso,
 * y el botón de cargar abajo. Azul marino, ítem activo más claro.
 */
export default function Rail({
  rol = "comercial",
  nombre,
  email,
  noLeidas = 0,
  paraHoy = 0,
  paraAprobar = 0,
  marca = MARCA_POR_DEFECTO,
  veContenidos = false,
}: {
  rol?: string;
  veContenidos?: boolean;
  nombre?: string | null;
  email?: string | null;
  noLeidas?: number;
  paraHoy?: number;
  /** Dirección: propuestas y contenidos esperando aprobación (v1.15). */
  paraAprobar?: number;
  marca?: Marca;
}) {
  const pathname = usePathname();
  const { lateral } = menuDe(rol, { veContenidos });
  const crear = botonCrear(rol);

  return (
    <aside className="sticky top-0 hidden h-dvh flex-col bg-marino text-white/80 lg:flex">
      <Link href="/" className="flex items-center px-5 pt-5 pb-4" aria-label={marca.nombre}>
        <LogoSistema marca={marca} fondo="oscuro" />
      </Link>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {lateral.map((item) => {
          const Icono = ICONOS_MENU[item.icono];
          const activo = estaActivo(item.href, pathname);
          const badge = item.badgeHoy ? paraHoy : item.badgeAprobar ? paraAprobar : 0;
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
              {badge ? (
                <span className="ml-auto rounded-full bg-verde px-2 py-0.5 text-[11px] font-extrabold text-white">{badge}</span>
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
        <p className="truncate text-xs text-white/60">{nombrePuesto(rol)}</p>
        <p className="truncate text-xs text-white/40">{email}</p>
        <Link href="/novedades" className="mt-1 inline-block text-[11px] font-bold text-white/50 hover:text-white">
          {marca.nombre} {versionCorta()}
        </Link>
      </div>
    </aside>
  );
}
