"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Usuarios" },
  { href: "/admin/catalogo", label: "Catálogo" },
  { href: "/admin/repuestos", label: "Repuestos" },
  { href: "/admin/plantillas", label: "Plantillas" },
  { href: "/admin/checklists", label: "Checklists" },
  { href: "/admin/duplicados", label: "Duplicados" },
  { href: "/admin/ia", label: "IA" },
  { href: "/admin/auditoria", label: "Auditoría" },
];

export default function AdminTabs() {
  const pathname = usePathname();

  return (
    <div className="mt-3 flex flex-wrap gap-1 border-b border-borde pb-px">
      {TABS.map((t) => {
        const activo =
          t.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`rounded-t-lg border-b-2 px-3.5 py-2 text-sm font-medium transition-colors ${
              activo
                ? "border-celeste-deep text-tinta"
                : "border-transparent text-piedra hover:text-tinta"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
