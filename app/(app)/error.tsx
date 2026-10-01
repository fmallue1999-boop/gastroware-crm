"use client";

import Link from "next/link";

/** Si una pantalla falla: un mensaje claro, reintentar o volver al inicio. Nada se perdió. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-borde bg-white p-5 text-center shadow-sm">
      <p className="text-lg font-semibold">Algo no cargó bien</p>
      <p className="mt-1 text-[15px] text-piedra">
        No se perdió nada. Probá de nuevo; si sigue igual, avisale a dirección.
      </p>
      {error?.digest && <p className="mt-1 text-xs text-piedra">Código: {error.digest}</p>}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => reset()}
          className="min-h-11 flex-1 rounded-2xl bg-marino px-4 text-[15px] font-semibold text-white"
        >
          Volver a intentar
        </button>
        <Link
          href="/"
          className="flex min-h-11 flex-1 items-center justify-center rounded-2xl border border-borde bg-white px-4 text-[15px] font-medium"
        >
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
