"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { guardarPreferenciaPendientes } from "@/lib/actions";

const chip = (activo: boolean) =>
  `min-h-11 rounded-full px-3.5 py-2 text-[15px] font-medium disabled:opacity-60 ${
    activo ? "bg-tinta text-white" : "border border-borde bg-white text-piedra"
  }`;

/**
 * Dirección y administración eligen de quién ver los pendientes: Míos /
 * De todos / Por vendedor. La elección se recuerda (cookie).
 */
export default function SelectorQuien({
  valor,
  vendedores,
}: {
  valor: string;
  vendedores: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const porVendedor = valor !== "mios" && valor !== "todos";

  function elegir(v: string) {
    startTransition(async () => {
      await guardarPreferenciaPendientes(v);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button type="button" disabled={pending} onClick={() => elegir("mios")} className={chip(valor === "mios")}>
        Míos
      </button>
      <button type="button" disabled={pending} onClick={() => elegir("todos")} className={chip(valor === "todos")}>
        De todos
      </button>
      <select
        value={porVendedor ? valor : ""}
        disabled={pending}
        onChange={(e) => e.target.value && elegir(e.target.value)}
        aria-label="Por vendedor"
        className={`${chip(porVendedor)} appearance-none pr-6`}
      >
        <option value="">Por vendedor…</option>
        {vendedores.map((v) => (
          <option key={v.id} value={v.id}>
            {v.nombre}
          </option>
        ))}
      </select>
    </div>
  );
}
