"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, MessageCircle, Phone, Star } from "lucide-react";
import { actualizarFeriaLead, asignarFeriaLead } from "@/lib/actions";
import { ESTADOS_FERIA } from "@/lib/constants";
import { fechaCorta, linkWhatsApp, telefonoProlijo } from "@/lib/format";
import type { FeriaLead } from "@/lib/types";

/**
 * Un contacto escaneado en la feria: quién es, cómo contactarlo, en qué
 * estado está, quién lo contactó, calificación con estrellas, a quién
 * está asignado y observaciones. Todo se cambia con un toque.
 */
export default function FeriaLeadFila({
  lead,
  nombres,
  vendedores,
  esGestor,
}: {
  lead: FeriaLead;
  nombres: Record<string, string>;
  vendedores: { id: string; nombre: string }[];
  esGestor: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [obs, setObs] = useState(lead.observaciones ?? "");
  const [editandoObs, setEditandoObs] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function correr(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      const res = (await fn()) as { error?: string } | null | undefined;
      if (res && typeof res === "object" && "error" in res && res.error) setError(res.error);
      router.refresh();
    });
  }

  const nombre = lead.nombre || lead.empresa || "Sin nombre";
  const estadoDef = ESTADOS_FERIA.find((e) => e.value === lead.estado);

  return (
    <div className="rounded-2xl border border-borde bg-white p-3.5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link href={`/clientes/${lead.cliente_id}`} className="truncate text-[15px] font-semibold hover:underline">
              {nombre}
            </Link>
            {estadoDef && (
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${estadoDef.color}`}>
                {estadoDef.label}
              </span>
            )}
            {lead.numero && <span className="text-[11px] text-piedra">#{lead.numero}</span>}
          </div>
          <p className="text-xs text-piedra">
            {[lead.nombre && lead.empresa ? lead.empresa : null, lead.cargo].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-0.5 text-xs text-piedra">
            {lead.telefono ? telefonoProlijo(lead.telefono) : "sin teléfono"}
            {lead.email ? ` · ${lead.email}` : ""}
          </p>
          {lead.contactado_at && lead.estado !== "inicial" && (
            <p className="mt-0.5 text-xs text-sky-800">
              {estadoDef?.label} por {nombres[lead.contactado_por ?? ""] ?? "alguien"} el{" "}
              {fechaCorta(lead.contactado_at)}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-1.5">
          {lead.telefono && (
            <>
              <a
                href={linkWhatsApp(lead.telefono)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-green-600 text-white"
              >
                <MessageCircle className="h-4 w-4" />
              </a>
              <a
                href={`tel:${lead.telefono}`}
                aria-label="Llamar"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-borde text-tinta"
              >
                <Phone className="h-4 w-4" />
              </a>
            </>
          )}
          {lead.email && (
            <a
              href={`mailto:${lead.email}`}
              aria-label="Email"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-borde text-tinta"
            >
              <Mail className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>

      {/* Estado + estrellas */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {ESTADOS_FERIA.map((e) => (
          <button
            key={e.value}
            type="button"
            disabled={pending}
            onClick={() => correr(() => actualizarFeriaLead(lead.id, { estado: e.value }))}
            className={`rounded-full px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
              lead.estado === e.value ? "bg-tinta text-white" : "border border-borde bg-white text-piedra"
            }`}
          >
            {e.label}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-0.5" aria-label="Calificación">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              disabled={pending}
              aria-label={`${n} estrellas`}
              onClick={() =>
                correr(() =>
                  actualizarFeriaLead(lead.id, {
                    calificacion: lead.calificacion === n ? null : n,
                  })
                )
              }
              className="p-0.5 disabled:opacity-50"
            >
              <Star
                className={`h-5 w-5 ${
                  (lead.calificacion ?? 0) >= n ? "fill-amber-400 text-amber-400" : "text-borde"
                }`}
              />
            </button>
          ))}
        </span>
      </div>

      {/* Asignación y observaciones */}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {esGestor ? (
          <select
            value={lead.asignado_a ?? ""}
            disabled={pending}
            onChange={(e) => correr(() => asignarFeriaLead(lead.id, e.target.value || null))}
            className="rounded-xl border border-borde bg-white px-3 py-1.5 text-xs outline-none focus:border-tinta"
          >
            <option value="">Sin asignar (lo ven todos)</option>
            {vendedores.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nombre}
              </option>
            ))}
          </select>
        ) : (
          lead.asignado_a && (
            <span className="text-xs text-piedra">
              Asignado a {nombres[lead.asignado_a] ?? "un vendedor"}
            </span>
          )
        )}
        {!editandoObs ? (
          <button
            type="button"
            onClick={() => setEditandoObs(true)}
            className="min-w-0 flex-1 truncate text-left text-xs text-piedra underline"
          >
            {lead.observaciones ? lead.observaciones : "Agregar observación"}
          </button>
        ) : null}
      </div>
      {editandoObs && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            correr(async () => {
              const r = await actualizarFeriaLead(lead.id, { observaciones: obs });
              setEditandoObs(false);
              return r;
            });
          }}
          className="mt-2 flex gap-2"
        >
          <input
            type="text"
            autoFocus
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="Observaciones"
            className="flex-1 rounded-xl border border-borde bg-white px-3 py-2 text-sm outline-none focus:border-tinta"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-tinta px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
          >
            Guardar
          </button>
          <button
            type="button"
            onClick={() => {
              setEditandoObs(false);
              setObs(lead.observaciones ?? "");
            }}
            className="text-xs text-piedra underline"
          >
            Cancelar
          </button>
        </form>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
