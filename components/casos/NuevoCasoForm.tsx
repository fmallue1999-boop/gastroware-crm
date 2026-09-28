"use client";

import { useState, useTransition } from "react";
import { abrirCaso, equiposDeCliente } from "@/lib/actions";
import { PRIORIDADES_CASO } from "@/lib/constants";
import ClienteSelector, { type ClienteElegido } from "@/components/ClienteSelector";

type EquipoMin = { id: string; nombre: string };

/** Abrir un caso: de quién, qué equipo, qué tan urgente y qué pasa. */
export default function NuevoCasoForm({
  clienteInicial = null,
  equiposIniciales = [],
  volverA = "/casos",
}: {
  clienteInicial?: ClienteElegido | null;
  equiposIniciales?: EquipoMin[];
  volverA?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [cliente, setCliente] = useState<ClienteElegido | null>(clienteInicial);
  const [equipos, setEquipos] = useState<EquipoMin[]>(equiposIniciales);
  const [equipoId, setEquipoId] = useState(equiposIniciales.length === 1 ? equiposIniciales[0].id : "");
  const [prioridad, setPrioridad] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [error, setError] = useState<string | null>(null);

  const chip = (activo: boolean) =>
    `min-h-11 rounded-full px-4 text-[15px] font-bold ${activo ? "bg-marino text-white" : "border border-borde bg-white text-piedra"}`;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!cliente) return setError("Elegí el cliente");
        if (!prioridad) return setError("Elegí qué tan urgente es");
        setError(null);
        startTransition(async () => {
          const r = await abrirCaso({ clienteId: cliente.id, equipoId: equipoId || null, prioridad, descripcion, volverA });
          if (r && "error" in r && r.error) setError(r.error);
        });
      }}
    >
      <section className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide text-piedra">¿De quién?</p>
        <ClienteSelector
          valor={cliente}
          onChange={async (c) => {
            setCliente(c);
            setEquipoId("");
            setEquipos(c ? await equiposDeCliente(c.id) : []);
          }}
        />
      </section>
      {equipos.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-piedra">¿Qué equipo?</p>
          <select
            value={equipoId}
            onChange={(e) => setEquipoId(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-borde bg-white px-3 text-[15px] outline-none focus:border-marino"
          >
            <option value="">No sé / otro</option>
            {equipos.map((eq) => (
              <option key={eq.id} value={eq.id}>
                {eq.nombre}
              </option>
            ))}
          </select>
        </section>
      )}
      <section className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide text-piedra">¿Qué tan urgente?</p>
        <div className="flex flex-wrap gap-1.5">
          {PRIORIDADES_CASO.map((p) => (
            <button key={p.value} type="button" onClick={() => setPrioridad(p.value)} className={chip(prioridad === p.value)}>
              {p.label}
            </button>
          ))}
        </div>
        {prioridad === "parado" && <p className="text-[14px] font-bold text-red-600">Equipo parado: primera respuesta dentro de la hora.</p>}
      </section>
      <section className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide text-piedra">¿Qué pasa?</p>
        <textarea
          required
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Lo que cuenta el cliente, con sus palabras"
          rows={3}
          className="w-full rounded-xl border border-borde bg-white px-3 py-2 text-[15px] outline-none focus:border-marino"
        />
      </section>
      {error && <p className="text-[14px] font-bold text-red-600">{error}</p>}
      <button disabled={pending} className="min-h-12 w-full rounded-2xl bg-verde text-base font-extrabold text-white disabled:opacity-50">
        {pending ? "Guardando…" : "Abrir caso"}
      </button>
    </form>
  );
}
