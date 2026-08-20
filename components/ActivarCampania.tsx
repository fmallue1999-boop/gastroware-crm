"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Rocket } from "lucide-react";
import { activarCampania } from "@/lib/actions";

/** Activa una campaña en borrador: congela la lista y habilita el envío. */
export default function ActivarCampania({ campaniaId }: { campaniaId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
      <p className="text-sm font-semibold text-amber-900">
        Esta campaña es un borrador
      </p>
      <p className="mt-0.5 text-sm text-amber-800">
        Podés seguir puliéndola sin que salga nada. Cuando la actives, se arma
        la lista de destinatarios con el segmento elegido y ya podés empezar a
        enviar.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await activarCampania(campaniaId);
            if (res && "error" in res && res.error) setError(res.error);
            else router.refresh();
          })
        }
        className="mt-3 inline-flex items-center gap-1.5 rounded-2xl bg-tinta px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
      >
        <Rocket className="h-4 w-4" />
        {pending ? "Activando…" : "Activar campaña"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
