"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { buscarClientes, listarEquiposCliente, crearOT } from "@/lib/actions";
import { TIPOS_OT, PRIORIDADES_OT } from "@/lib/constants";
import type { Cliente, Usuario } from "@/lib/types";

const inputCls =
  "w-full rounded-2xl border border-borde bg-white shadow-sm px-3 py-2.5 text-sm outline-none focus:border-tinta";

export default function OTForm({
  usuarios,
  clienteInicial = null,
  equiposIniciales = [],
  equipoInicialId = "",
  tipoInicial,
}: {
  usuarios: Usuario[];
  clienteInicial?: Cliente | null;
  equiposIniciales?: { id: string; etiqueta: string }[];
  equipoInicialId?: string;
  tipoInicial?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<Cliente[]>([]);
  const [cliente, setCliente] = useState<Cliente | null>(clienteInicial);
  const [equipos, setEquipos] = useState<{ id: string; etiqueta: string }[]>(
    equiposIniciales
  );
  const [equipoId, setEquipoId] = useState(equipoInicialId);
  const [tipo, setTipo] = useState(
    TIPOS_OT.some((t) => t.value === tipoInicial) ? tipoInicial! : "correctivo"
  );
  const [prioridad, setPrioridad] = useState("normal");
  const [fecha, setFecha] = useState("");
  const [tecnicoId, setTecnicoId] = useState("");
  const [problema, setProblema] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function buscar(valor: string) {
    setQ(valor);
    if (valor.trim().length < 2) {
      setResultados([]);
      return;
    }
    setResultados(await buscarClientes(valor));
  }

  async function elegirCliente(c: Cliente) {
    setCliente(c);
    setResultados([]);
    setEquipos(await listarEquiposCliente(c.id));
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!cliente) return;
    setError(null);
    startTransition(async () => {
      const res = await crearOT({
        clienteId: cliente.id,
        equipoId: equipoId || null,
        tipo,
        prioridad,
        fechaProgramada: fecha || null,
        tecnicoId: tecnicoId || null,
        problema,
      });
      if (res && "error" in res && res.error) setError(res.error);
    });
  }

  return (
    <form onSubmit={enviar} className="space-y-3">
      {!cliente ? (
        <div>
          <input
            type="search"
            autoFocus
            placeholder="Buscar cliente por nombre, teléfono o n° de serie…"
            value={q}
            onChange={(e) => buscar(e.target.value)}
            className={inputCls}
          />
          <div className="mt-2 space-y-1.5">
            {resultados.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => elegirCliente(c)}
                className="block w-full rounded-2xl border border-borde bg-white shadow-sm p-3 text-left text-sm"
              >
                <span className="font-medium">{c.nombre_comercial}</span>
                <span className="text-piedra">
                  {" "}
                  · {c.rubro}
                  {c.ciudad ? ` · ${c.ciudad}` : ""}
                </span>
              </button>
            ))}
            {q.trim().length >= 2 && resultados.length === 0 && (
              <p className="rounded-2xl border border-dashed border-borde p-3 text-sm text-piedra">
                No aparece.{" "}
                <Link href="/alta" className="text-sky-700 underline">
                  Crear cliente nuevo
                </Link>{" "}
                y después volvé a abrir la orden.
              </p>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between rounded-2xl bg-celeste-soft px-4 py-3">
            <p className="text-sm font-medium">{cliente.nombre_comercial}</p>
            <button
              type="button"
              onClick={() => {
                setCliente(null);
                setEquipos([]);
                setEquipoId("");
              }}
              className="text-xs text-sky-800 underline"
            >
              Cambiar
            </button>
          </div>

          <select
            value={equipoId}
            onChange={(e) => setEquipoId(e.target.value)}
            className={inputCls}
          >
            <option value="">
              {equipos.length === 0
                ? "Sin equipos cargados (se puede asignar después)"
                : "¿Sobre qué equipo?…"}
            </option>
            {equipos.map((eq) => (
              <option key={eq.id} value={eq.id}>
                {eq.etiqueta}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-2">
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputCls}>
              {TIPOS_OT.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <select value={prioridad} onChange={(e) => setPrioridad(e.target.value)} className={inputCls}>
              {PRIORIDADES_OT.map((p) => (
                <option key={p.value} value={p.value}>
                  Prioridad {p.label.toLowerCase()}
                </option>
              ))}
            </select>
          </div>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className={`${inputCls} w-full`}
          />

          <select
            value={tecnicoId}
            onChange={(e) => setTecnicoId(e.target.value)}
            className={inputCls}
          >
            <option value="">Asignar técnico (yo mismo si queda vacío)…</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre} {u.rol === "tecnico" ? "(técnico)" : `(${u.rol})`}
              </option>
            ))}
          </select>

          <textarea
            placeholder="¿Qué problema reporta el cliente?"
            value={problema}
            onChange={(e) => setProblema(e.target.value)}
            rows={3}
            className={inputCls}
          />

          {tipo === "garantia" && (
            <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
              Orden por garantía: la mano de obra no se factura.
            </p>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-2xl bg-tinta py-3 font-medium text-white disabled:opacity-60"
          >
            {pending ? "Creando…" : "Crear orden de trabajo"}
          </button>
        </>
      )}
    </form>
  );
}
