"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { cambiarEtapa, crearInteres, crearPedidoDirecto } from "@/lib/actions";
import { CATEGORIAS_PRODUCTO, MOTIVOS_PERDIDA } from "@/lib/constants";
import { fechaCorta } from "@/lib/format";
import type { Oportunidad, Producto } from "@/lib/types";

const inputCls =
  "w-full rounded-2xl border border-borde bg-white px-3 py-2.5 text-sm outline-none focus:border-tinta";

function SelectorProductos({
  productos,
  elegidos,
  onChange,
}: {
  productos: Producto[];
  elegidos: string[];
  onChange: (ids: string[]) => void;
}) {
  const grupos = Object.entries(CATEGORIAS_PRODUCTO)
    .map(([cat, label]) => ({ label, items: productos.filter((p) => p.categoria === cat) }))
    .filter((g) => g.items.length > 0);
  return (
    <div>
      {elegidos.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {elegidos.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1.5 rounded-full bg-tinta px-3 py-1 text-xs text-white"
            >
              {productos.find((p) => p.id === id)?.nombre ?? "Producto"}
              <button type="button" onClick={() => onChange(elegidos.filter((x) => x !== id))} aria-label="Quitar">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <select
        value=""
        onChange={(e) => {
          const id = e.target.value;
          if (id && !elegidos.includes(id)) onChange([...elegidos, id]);
        }}
        className={inputCls}
      >
        <option value="">{elegidos.length === 0 ? "Elegir del catálogo…" : "Agregar otro…"}</option>
        {grupos.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.items.map((p) => (
              <option key={p.id} value={p.id} disabled={elegidos.includes(p.id)}>
                {p.nombre}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

/**
 * "Le interesa" de un contacto: sus consultas abiertas con dos botones
 * (Le vendí / No se dio), y accesos para agregar un interés o cargar una
 * venta directa. Todo en la ficha, sin cambiar de pantalla.
 */
export default function InteresControl({
  clienteId,
  abiertas,
  productos,
}: {
  clienteId: string;
  abiertas: Oportunidad[];
  productos: Producto[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [modo, setModo] = useState<"nada" | "interes" | "venta" | "perdida">("nada");
  const [oppSel, setOppSel] = useState<string | null>(null);
  const [ids, setIds] = useState<string[]>([]);
  const [texto, setTexto] = useState("");
  const [monto, setMonto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const nombreProducto = (o: Oportunidad) => {
    const extra = (o.productos_extra ?? [])
      .map((id) => productos.find((p) => p.id === id)?.nombre)
      .filter(Boolean) as string[];
    return [o.producto?.nombre, ...extra].filter(Boolean).join(", ") || o.mensaje_inicial || "Consulta";
  };

  function vendi(oppId: string) {
    setError(null);
    startTransition(async () => {
      const res = await cambiarEtapa(oppId, "ganada");
      if (res && "error" in res && res.error) setError(res.error);
      router.refresh();
    });
  }

  function noSeDio(e: React.FormEvent) {
    e.preventDefault();
    if (!oppSel || !motivo) return;
    setError(null);
    startTransition(async () => {
      const res = await cambiarEtapa(oppSel, "perdida", motivo);
      if (res && "error" in res && res.error) setError(res.error);
      setModo("nada");
      setOppSel(null);
      setMotivo("");
      router.refresh();
    });
  }

  function guardarInteres(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await crearInteres({ clienteId, productoIds: ids, texto });
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      setModo("nada");
      setIds([]);
      setTexto("");
      router.refresh();
    });
  }

  function guardarVenta(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await crearPedidoDirecto({
        clienteId,
        productoIds: ids,
        monto: parseFloat(monto.replace(/\./g, "").replace(",", ".")) || null,
        nota: texto,
        volverA: `/clientes/${clienteId}`,
      });
      if (res && "error" in res && res.error) setError(res.error);
    });
  }

  const chip = "rounded-full border border-borde bg-white px-3 py-1.5 text-xs font-medium text-tinta";

  return (
    <section className="rounded-2xl border border-borde bg-white p-3.5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-piedra">
          Le interesa
        </h2>
        {modo === "nada" && (
          <div className="flex gap-1.5">
            <button type="button" onClick={() => setModo("interes")} className={chip}>
              + Interés
            </button>
            <button
              type="button"
              onClick={() => setModo("venta")}
              className="rounded-full bg-green-600 px-3 py-1.5 text-xs font-medium text-white"
            >
              + Le vendí
            </button>
          </div>
        )}
      </div>

      {abiertas.length === 0 && modo === "nada" && (
        <p className="mt-1 text-sm text-piedra">Nada anotado por ahora.</p>
      )}

      <div className="mt-2 space-y-2">
        {abiertas.map((o) => (
          <div key={o.id} className="rounded-xl bg-crema px-3 py-2.5">
            <p className="text-sm font-medium">{nombreProducto(o)}</p>
            <p className="text-xs text-piedra">
              {o.origen} · {fechaCorta(o.created_at)}
              {o.monto_estimado ? ` · cotizado` : ""}
              {" · "}
              <Link href={`/oportunidades/${o.id}`} className="underline">
                ver detalle
              </Link>
            </p>
            {modo === "perdida" && oppSel === o.id ? (
              <form onSubmit={noSeDio} className="mt-2 flex gap-2">
                <select
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  className={`${inputCls} flex-1`}
                >
                  <option value="">¿Por qué no se dio?…</option>
                  {MOTIVOS_PERDIDA.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={pending || !motivo}
                  className="rounded-xl bg-tinta px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                >
                  Listo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModo("nada");
                    setOppSel(null);
                  }}
                  className="text-xs text-piedra underline"
                >
                  Cancelar
                </button>
              </form>
            ) : (
              modo === "nada" && (
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => vendi(o.id)}
                    className="flex-1 rounded-xl bg-green-600 py-2 text-xs font-medium text-white disabled:opacity-50"
                  >
                    ✓ Le vendí esto
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setModo("perdida");
                      setOppSel(o.id);
                    }}
                    className="flex-1 rounded-xl border border-borde py-2 text-xs font-medium text-piedra disabled:opacity-50"
                  >
                    ✗ No se dio
                  </button>
                </div>
              )
            )}
          </div>
        ))}
      </div>

      {(modo === "interes" || modo === "venta") && (
        <form
          onSubmit={modo === "interes" ? guardarInteres : guardarVenta}
          className="mt-3 space-y-2 rounded-xl border border-borde bg-crema/60 p-3"
        >
          <p className="text-xs font-semibold text-tinta">
            {modo === "interes" ? "¿Qué le interesa?" : "¿Qué le vendiste?"}
          </p>
          <SelectorProductos productos={productos} elegidos={ids} onChange={setIds} />
          <input
            type="text"
            placeholder={modo === "interes" ? "…o escribilo con tus palabras" : "Nota (o qué se vendió, si no está en el catálogo)"}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className={inputCls}
          />
          {modo === "venta" && (
            <input
              type="text"
              inputMode="decimal"
              placeholder="Monto (opcional)"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className={inputCls}
            />
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending || (ids.length === 0 && !texto.trim())}
              className="flex-1 rounded-xl bg-tinta py-2 text-xs font-medium text-white disabled:opacity-50"
            >
              {pending ? "Guardando…" : modo === "interes" ? "Guardar interés" : "Cargar venta"}
            </button>
            <button
              type="button"
              onClick={() => {
                setModo("nada");
                setError(null);
              }}
              className="rounded-xl border border-borde px-3 py-2 text-xs text-piedra"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
      {error && modo === "nada" && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </section>
  );
}
