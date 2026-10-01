"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { botonCrear } from "@/lib/navegacion";

/**
 * El botón verde que flota en el celular: Nuevo interés (o Cargar service
 * para el técnico). No aparece en las pantallas de carga (cotizar, venta,
 * repuesto, tarea, asistente) ni en la ficha: tienen su propio botón abajo
 * y el + lo tapaba.
 */
export default function BotonFlotante({ rol = "comercial" }: { rol?: string }) {
  const pathname = usePathname();
  const crear = botonCrear(rol);
  const ocultar =
    pathname === "/alta" ||
    pathname === "/asistente" ||
    pathname === "/consumibles/venta" ||
    pathname === "/repuestos/nueva" ||
    pathname === "/tareas/nueva" ||
    pathname.startsWith("/cotizar/") ||
    pathname.startsWith("/servicio/cargar") ||
    pathname.startsWith("/pedidos/nuevo") ||
    /^\/clientes\/[^/]+$/.test(pathname);
  if (ocultar) return null;
  return (
    <Link
      href={crear.href}
      aria-label={crear.label}
      className="ocultar-con-teclado fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-verde text-white shadow-lg shadow-verde/30 transition-transform active:scale-95"
    >
      <Plus className="h-7 w-7" strokeWidth={2.6} />
    </Link>
  );
}
