"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Cierra la ficha con la tecla Escape (sin perder la vista). */
export default function CerrarConEsc({ href }: { href: string }) {
  const router = useRouter();
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      // Si hay un visor de fotos abierto, Escape lo cierra a él primero
      if (e.key === "Escape" && !document.querySelector("[data-visor]")) router.replace(href, { scroll: false });
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [href, router]);
  return null;
}
