"use client";

import { useTransition } from "react";
import Link from "next/link";
import { BellOff, Check, CheckCheck } from "lucide-react";
import { marcarNotificacionLeida, marcarTodasLeidas } from "@/lib/actions";
import type { Notificacion } from "@/lib/types";

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotificacionesLista({
  notificaciones,
}: {
  notificaciones: Notificacion[];
}) {
  const [pending, startTransition] = useTransition();
  const sinLeer = notificaciones.filter((n) => !n.leida_at);

  if (notificaciones.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-borde p-8 text-center text-sm text-piedra">
        <BellOff className="mx-auto mb-2 h-5 w-5" />
        Sin notificaciones por ahora.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {sinLeer.length > 0 && (
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(async () => void (await marcarTodasLeidas()))}
          className="inline-flex items-center gap-1.5 rounded-2xl border border-borde bg-white px-3.5 py-2 text-sm text-piedra shadow-sm hover:bg-crema disabled:opacity-60"
        >
          <CheckCheck className="h-4 w-4" /> Marcar todas como leídas (
          {sinLeer.length})
        </button>
      )}

      <div className="space-y-2">
        {notificaciones.map((n) => {
          const contenido = (
            <>
              <div className="flex items-start justify-between gap-2">
                <p className={`text-sm ${n.leida_at ? "" : "font-semibold"}`}>
                  {n.titulo}
                </p>
                <span className="shrink-0 text-xs text-piedra">
                  {fmtFecha(n.created_at)}
                </span>
              </div>
              {n.cuerpo && (
                <p className="mt-0.5 text-sm text-piedra">{n.cuerpo}</p>
              )}
            </>
          );
          return (
            <div
              key={n.id}
              className={`flex items-start gap-2 rounded-2xl border px-4 py-3 shadow-sm ${
                n.leida_at
                  ? "border-borde bg-white opacity-70"
                  : "border-celeste bg-celeste-soft/40"
              }`}
            >
              <div className="min-w-0 flex-1">
                {n.url ? (
                  <Link
                    href={n.url}
                    onClick={() => {
                      if (!n.leida_at)
                        startTransition(
                          async () => void (await marcarNotificacionLeida(n.id))
                        );
                    }}
                    className="block"
                  >
                    {contenido}
                  </Link>
                ) : (
                  contenido
                )}
              </div>
              {!n.leida_at && (
                <button
                  type="button"
                  disabled={pending}
                  aria-label="Marcar leída"
                  onClick={() =>
                    startTransition(
                      async () => void (await marcarNotificacionLeida(n.id))
                    )
                  }
                  className="shrink-0 rounded-full border border-borde bg-white p-1.5 text-piedra hover:text-green-700"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
