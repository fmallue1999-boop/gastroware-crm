"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Link a un contacto. En la computadora abre la ficha al costado (?c=) sin
 * salir de la pantalla; en el celular va a la ficha completa.
 */
export default function LinkContacto({
  id,
  interes,
  className,
  children,
}: {
  id: string;
  interes?: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const href = `/clientes/${id}${interes ? `?interes=${interes}` : ""}`;

  function onClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    const esCompu = typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;
    if (!esCompu || pathname.startsWith("/clientes/")) return;
    e.preventDefault();
    const p = new URLSearchParams(params.toString());
    p.set("c", id);
    if (interes) p.set("interes", interes);
    else p.delete("interes");
    router.push(`${pathname}?${p.toString()}`, { scroll: false });
  }

  return (
    <Link href={href} onClick={onClick} className={className}>
      {children}
    </Link>
  );
}
