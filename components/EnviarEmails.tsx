"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { enviarTandaEmail } from "@/lib/actions";

/** Disparo de tandas de emails de una campaña (canal email). */
export default function EnviarEmails({
  campaniaId,
  pendientes,
  terminada,
}: {
  campaniaId: string;
  pendientes: number;
  terminada: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [resultado, setResultado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function enviar(cantidad: number) {
    setError(null);
    setResultado(null);
    startTransition(async () => {
      const res = await enviarTandaEmail(campaniaId, cantidad);
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      if ("ok" in res) {
        setResultado(
          `Tanda lista: ${res.enviados} enviados` +
            (res.errores ? `, ${res.errores} con error` : "") +
            (res.salteados ? `, ${res.salteados} salteados` : "") +
            ` · quedan ${res.restantes} pendientes`
        );
        router.refresh();
      }
    });
  }

  if (terminada)
    return (
      <p className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
        Campaña terminada: no quedan envíos pendientes.
      </p>
    );

  return (
    <div className="rounded-2xl border border-borde bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold">
        Enviar emails ({pendientes} pendientes)
      </p>
      <p className="mt-1 text-xs text-piedra">
        Se manda por tandas para cuidar el límite del plan de Resend (gratis:
        100 por día) y la reputación del dominio. Los primeros días conviene
        tandas chicas.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {[20, 50, 100].map((n) => (
          <button
            key={n}
            type="button"
            disabled={pending || pendientes === 0}
            onClick={() => enviar(n)}
            className="inline-flex items-center gap-1.5 rounded-2xl bg-tinta px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            {pending ? "Enviando…" : `Enviar tanda de ${Math.min(n, pendientes)}`}
          </button>
        ))}
      </div>
      {resultado && (
        <p className="mt-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
          {resultado}
        </p>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
