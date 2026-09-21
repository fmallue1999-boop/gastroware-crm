"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { guardarPreferenciaPendientes } from "@/lib/actions";

/** "De quién" ve el embudo dirección/administración: Míos, De todos o un vendedor. Se recuerda. */
export default function SelectorQuienDesplegable({
  valor,
  vendedores,
}: {
  valor: string;
  vendedores: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <select
      value={valor}
      disabled={pending}
      aria-label="De quién"
      onChange={(e) =>
        startTransition(async () => {
          await guardarPreferenciaPendientes(e.target.value);
          router.refresh();
        })
      }
      className="min-h-11 rounded-xl border border-borde bg-white px-3 text-[15px] font-bold text-tinta outline-none focus:border-marino disabled:opacity-60"
    >
      <option value="todos">De todos</option>
      <option value="mios">Míos</option>
      {vendedores.map((v) => (
        <option key={v.id} value={v.id}>
          {v.nombre}
        </option>
      ))}
    </select>
  );
}
