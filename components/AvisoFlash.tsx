"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const TEXTOS: Record<string, string> = {
  interes: "Interés cargado",
  venta: "Venta registrada",
  contacto: "Contacto guardado",
  service: "Service cargado",
  guardado: "Guardado",
};

/**
 * Aviso corto (2 segundos) después de una acción que redirige, leído de
 * ?aviso=. Se borra solo de la URL, conservando el resto de los parámetros.
 */
export default function AvisoFlash() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const clave = params.get("aviso");

  useEffect(() => {
    if (!clave) return;
    const t = setTimeout(() => {
      const resto = new URLSearchParams(params.toString());
      resto.delete("aviso");
      const q = resto.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    }, 2000);
    return () => clearTimeout(t);
  }, [clave, params, pathname, router]);

  if (!clave) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-24 z-30 mx-auto max-w-sm rounded-2xl bg-tinta px-4 py-3 text-center text-[15px] font-medium text-white shadow-lg lg:bottom-8"
    >
      ✓ {TEXTOS[clave] ?? "Guardado"}
    </div>
  );
}
