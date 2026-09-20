"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { asignarComercial } from "@/lib/actions";

/** Vendedor responsable del contacto: un select, solo para dirección/administración. */
export default function AsignarVendedor({
  clienteId,
  actual,
  vendedores,
}: {
  clienteId: string;
  actual: string | null;
  vendedores: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);

  return (
    <label className="inline-flex items-center gap-2 text-sm text-piedra">
      Lo atiende
      <select
        value={actual ?? ""}
        disabled={pending}
        onChange={(e) =>
          startTransition(async () => {
            const res = await asignarComercial(clienteId, e.target.value || null);
            setAviso(res && "error" in res && res.error ? res.error : "Guardado");
            setTimeout(() => setAviso(null), 2000);
            router.refresh();
          })
        }
        className="min-h-9 rounded-xl border border-borde bg-white px-2 text-sm text-tinta outline-none focus:border-tinta"
      >
        <option value="">nadie todavía</option>
        {vendedores.map((v) => (
          <option key={v.id} value={v.id}>
            {v.nombre}
          </option>
        ))}
      </select>
      {aviso && <span className="text-xs text-green-700">{aviso}</span>}
    </label>
  );
}
