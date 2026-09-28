"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { estaActivo, menuDe } from "@/lib/navegacion";
import { ICONOS_MENU } from "@/components/iconosMenu";

/** Barra inferior del celular: las cuatro cosas del puesto. El botón de cargar flota aparte. */
export default function BottomNav({ rol = "comercial", paraHoy = 0 }: { rol?: string; paraHoy?: number }) {
  const pathname = usePathname();
  const { celular } = menuDe(rol);

  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 border-t border-borde bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid max-w-2xl grid-cols-4">
        {celular.map((item) => {
          const Icono = ICONOS_MENU[item.icono];
          const activo = estaActivo(item.href, pathname);
          const badge = item.badgeHoy ? paraHoy : 0;
          return (
            <Link key={item.href} href={item.href} className="flex min-h-14 flex-col items-center justify-center gap-1 pt-2 pb-2">
              <span
                className={`relative flex h-7 items-center justify-center rounded-full px-4 transition-colors ${
                  activo ? "bg-celeste-soft text-marino" : "text-piedra"
                }`}
              >
                <Icono className="h-[20px] w-[20px]" strokeWidth={activo ? 2.4 : 2} />
                {badge ? (
                  <span className="absolute -right-1 -top-1.5 rounded-full bg-verde px-1.5 text-[0.65rem] font-extrabold leading-4 text-white">
                    {badge}
                  </span>
                ) : null}
              </span>
              <span className={`max-w-full truncate px-1 text-[0.6875rem] leading-none ${activo ? "font-extrabold text-marino" : "font-semibold text-piedra"}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
