"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, X } from "lucide-react";
import { buscarClientes, cargarServiceHecho, listarEquiposCliente } from "@/lib/actions";
import { hoyISO } from "@/lib/format";
import { TIPOS_OT } from "@/lib/constants";
import type { Cliente } from "@/lib/types";

const inputCls =
  "w-full rounded-2xl border border-borde bg-white shadow-sm px-4 py-3.5 text-base outline-none focus:border-tinta";
const chipCls = (activo: boolean) =>
  `rounded-full px-3.5 py-2 text-sm font-medium ${
    activo ? "bg-tinta text-white" : "border border-borde bg-white text-piedra"
  }`;

/** Reduce la foto a máx 1100px y la devuelve como JPEG base64 (sin prefijo). */
async function comprimirFoto(archivo: File): Promise<string> {
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, 1100 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.78).split(",")[1];
}

type Item = { descripcion: string; monto: string };

/**
 * "Cargar service hecho": para el técnico que terminó y quiere dejarlo
 * asentado en un minuto. Cliente (buscado o escrito), equipo (opcional),
 * qué se hizo, y listo. Horas, repuestos y foto son opcionales.
 */
export default function ServiceHechoForm({
  clienteInicial = null,
  equiposIniciales = [],
}: {
  clienteInicial?: Cliente | null;
  equiposIniciales?: { id: string; etiqueta: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<Cliente[]>([]);
  const [cliente, setCliente] = useState<Cliente | null>(clienteInicial);
  const [equipos, setEquipos] = useState(equiposIniciales);
  const [equipoId, setEquipoId] = useState("");
  const [equipoTexto, setEquipoTexto] = useState("");
  const [tipo, setTipo] = useState("correctivo");
  const [fecha, setFecha] = useState(hoyISO());
  const [trabajo, setTrabajo] = useState("");
  const [horas, setHoras] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [cobertura, setCobertura] = useState<"facturable" | "garantia" | "contrato">("facturable");
  const [foto, setFoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fotoInput = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function buscar(valor: string) {
    setQ(valor);
    if (timer.current) clearTimeout(timer.current);
    if (valor.trim().length < 2) {
      setResultados([]);
      return;
    }
    timer.current = setTimeout(async () => setResultados(await buscarClientes(valor)), 250);
  }

  async function elegir(c: Cliente) {
    setCliente(c);
    setResultados([]);
    setEquipos(await listarEquiposCliente(c.id));
  }

  async function elegirFoto(archivo: File | null) {
    if (!archivo) return;
    try {
      setFoto(await comprimirFoto(archivo));
    } catch {
      setError("No se pudo leer la foto");
    }
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await cargarServiceHecho({
        clienteId: cliente?.id,
        clienteTexto: cliente ? undefined : q,
        equipoId: equipoId || null,
        equipoTexto: equipoId ? undefined : equipoTexto,
        tipo,
        fecha,
        trabajo,
        horas: parseFloat(horas.replace(",", ".")) || null,
        items: items
          .filter((i) => i.descripcion.trim())
          .map((i) => ({
            descripcion: i.descripcion,
            monto: parseFloat(i.monto.replace(/\./g, "").replace(",", ".")) || 0,
          })),
        cobertura,
        fotoBase64: foto ?? undefined,
      });
      if (res && "error" in res && res.error) setError(res.error);
    });
  }

  return (
    <form onSubmit={enviar} className="space-y-3">
      {/* 1. Cliente */}
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-piedra">
          1 · ¿De quién?
        </p>
        {cliente ? (
          <div className="flex items-center justify-between rounded-2xl bg-celeste-soft px-4 py-3">
            <p className="text-sm font-medium">{cliente.nombre_comercial}</p>
            {!clienteInicial && (
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
            )}
          </div>
        ) : (
          <>
            <input
              type="search"
              autoFocus
              placeholder="Nombre o teléfono (si no está, se crea solo)"
              value={q}
              onChange={(e) => buscar(e.target.value)}
              className={inputCls}
            />
            {resultados.length > 0 && (
              <div className="mt-1.5 space-y-1">
                {resultados.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => elegir(c)}
                    className="block w-full rounded-2xl border border-borde bg-white p-3 text-left text-sm shadow-sm"
                  >
                    <span className="font-medium">{c.nombre_comercial}</span>
                    <span className="text-piedra">
                      {c.ciudad ? ` · ${c.ciudad}` : ""}
                      {c.telefono ? ` · ${c.telefono}` : ""}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* 2. Equipo */}
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-piedra">
          2 · ¿Qué equipo? (opcional)
        </p>
        {equipos.length > 0 && (
          <select value={equipoId} onChange={(e) => setEquipoId(e.target.value)} className={inputCls}>
            <option value="">Elegir de los equipos del cliente…</option>
            {equipos.map((eq) => (
              <option key={eq.id} value={eq.id}>
                {eq.etiqueta}
              </option>
            ))}
          </select>
        )}
        {!equipoId && (
          <input
            type="text"
            placeholder={equipos.length ? "…o escribí otro (marca y modelo)" : "Marca y modelo (ej: Rational iCombi Pro)"}
            value={equipoTexto}
            onChange={(e) => setEquipoTexto(e.target.value)}
            className={`${inputCls} ${equipos.length ? "mt-1.5" : ""}`}
          />
        )}
      </div>

      {/* 3. Qué se hizo */}
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-piedra">
          3 · ¿Qué se hizo?
        </p>
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {TIPOS_OT.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => {
                setTipo(t.value);
                if (t.value === "garantia") setCobertura("garantia");
              }}
              className={chipCls(tipo === t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <textarea
          required
          placeholder="Contalo en una o dos líneas: qué tenía, qué se hizo, cómo quedó"
          value={trabajo}
          onChange={(e) => setTrabajo(e.target.value)}
          rows={3}
          className={inputCls}
        />
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          <label className="block text-xs text-piedra">
            Fecha
            <input
              type="date"
              value={fecha}
              max={hoyISO()}
              onChange={(e) => setFecha(e.target.value)}
              className={`${inputCls} mt-1`}
            />
          </label>
          <label className="block text-xs text-piedra">
            Horas (opcional)
            <input
              type="text"
              inputMode="decimal"
              placeholder="1,5"
              value={horas}
              onChange={(e) => setHoras(e.target.value)}
              className={`${inputCls} mt-1`}
            />
          </label>
        </div>
      </div>

      {/* 4. Cobro y extras */}
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            { v: "facturable", l: "Se cobra" },
            { v: "garantia", l: "Por garantía" },
            { v: "contrato", l: "Por contrato" },
          ] as const
        ).map((c) => (
          <button
            key={c.v}
            type="button"
            onClick={() => setCobertura(c.v)}
            className={chipCls(cobertura === c.v)}
          >
            {c.l}
          </button>
        ))}
      </div>

      <details>
        <summary className="cursor-pointer text-sm text-sky-700 underline list-none [&::-webkit-details-marker]:hidden">
          Repuestos, gastos y foto (opcional)
        </summary>
        <div className="mt-2 space-y-2">
          {items.map((it, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                placeholder="Repuesto o gasto"
                value={it.descripcion}
                onChange={(e) =>
                  setItems(items.map((x, j) => (j === i ? { ...x, descripcion: e.target.value } : x)))
                }
                className={`${inputCls} flex-1`}
              />
              <input
                type="text"
                inputMode="decimal"
                placeholder="$"
                value={it.monto}
                onChange={(e) =>
                  setItems(items.map((x, j) => (j === i ? { ...x, monto: e.target.value } : x)))
                }
                className={`${inputCls} w-28`}
              />
              <button
                type="button"
                onClick={() => setItems(items.filter((_, j) => j !== i))}
                aria-label="Quitar"
                className="text-piedra"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setItems([...items, { descripcion: "", monto: "" }])}
            className="w-full rounded-2xl border border-dashed border-borde py-2 text-sm text-piedra"
          >
            + Agregar repuesto o gasto
          </button>

          <input
            ref={fotoInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => elegirFoto(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => fotoInput.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-borde bg-white py-3 text-sm font-medium"
          >
            <Camera className="h-4 w-4" />
            {foto ? "✓ Foto lista (tocá para cambiar)" : "Sacar foto del trabajo"}
          </button>
        </div>
      </details>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending || !trabajo.trim() || (!cliente && q.trim().length < 2)}
        className="w-full rounded-2xl bg-tinta py-4 text-base font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Guardar service"}
      </button>
      <p className="text-center text-xs text-piedra">
        Queda en la ficha del cliente y en Services para que administración lo apruebe y cobre.
      </p>
    </form>
  );
}
