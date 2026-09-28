"use client";

import { useState, useTransition } from "react";
import { asignarResponsableTerritorio } from "@/lib/actions";

type Territorio = { codigo: string; nombre: string; zonas: string[]; responsable_id: string | null };

/**
 * Territorios (manual 1.1 paso 2): el lugar de entrega decide a quién va la
 * consulta. Si el puesto está vacante, responde dirección general.
 */
export default function TerritoriosAdmin({
  territorios,
  vendedores,
  puedeEditar,
}: {
  territorios: Territorio[];
  vendedores: { id: string; nombre: string; puesto: string }[];
  puedeEditar: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [mensaje, setMensaje] = useState<{ codigo: string; texto: string; error?: boolean } | null>(null);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-extrabold">Territorios</h2>
        <p className="text-[14px] text-piedra">
          Cada consulta nueva va al responsable del territorio donde se entrega. Si queda vacante, la atiende dirección general.
        </p>
      </div>
      <div className="grid gap-2 lg:grid-cols-2">
        {territorios.map((t) => (
          <div key={t.codigo} className="rounded-2xl border border-borde bg-white p-4 shadow-sm">
            <p className="text-[16px] font-extrabold">{t.nombre}</p>
            <p className="mb-2 text-[14px] text-piedra">{t.zonas.join(" · ")}</p>
            <select
              value={t.responsable_id ?? ""}
              disabled={!puedeEditar || pending}
              aria-label={`Responsable de ${t.nombre}`}
              onChange={(e) => {
                const id = e.target.value || null;
                startTransition(async () => {
                  const r = await asignarResponsableTerritorio(t.codigo, id);
                  setMensaje(
                    r && "error" in r && r.error
                      ? { codigo: t.codigo, texto: r.error, error: true }
                      : { codigo: t.codigo, texto: "Guardado" }
                  );
                });
              }}
              className="min-h-11 w-full rounded-xl border border-borde bg-white px-3 text-[15px] outline-none focus:border-marino"
            >
              <option value="">Vacante: responde dirección general</option>
              {vendedores.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nombre} · {v.puesto}
                </option>
              ))}
            </select>
            {mensaje?.codigo === t.codigo && (
              <p className={`mt-1 text-[14px] font-bold ${mensaje.error ? "text-red-600" : "text-verde"}`}>{mensaje.texto}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
