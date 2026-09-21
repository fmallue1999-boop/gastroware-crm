"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";

/**
 * El botón verde que flota en el celular: Nuevo interés (o Cargar service
 * para el técnico). No aparece en las pantallas de carga ni en la ficha,
 * que tiene su propia caja abajo.
 */
export default function BotonFlotante({ rol = "comercial" }: { rol?: string }) {
  const pathname = usePathname();
  const tecnico = rol === "tecnico";
  const ocultar =
    pathname === "/alta" ||
    pathname.startsWith("/servicio/cargar") ||
    pathname.startsWith("/pedidos/nuevo") ||
    /^\/clientes\/[^/]+$/.test(pathname);
  if (ocultar) return null;
  return (
    <Link
      href={tecnico ? "/servicio/cargar" : "/alta"}
      aria-label={tecnico ? "Cargar service hecho" : "Nuevo interés"}
      className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-verde text-white shadow-lg shadow-verde/30 transition-transform active:scale-95"
    >
      <Plus className="h-7 w-7" strokeWidth={2.6} />
    </Link>
  );
}
