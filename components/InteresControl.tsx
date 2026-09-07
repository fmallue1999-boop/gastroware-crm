"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import {
  cambiarEtapa,
  crearInteres,
  crearPedidoDirecto,
  setTemperatura,
} from "@/lib/actions";
import { CATEGORIAS_PRODUCTO, MOTIVOS_PERDIDA, NIVELES_INTERES } from "@/lib/constants";
import { fechaCorta } from "@/lib/format";
import { textoStock, type InfoStock } from "@/lib/stock";
import type { Oportunidad, Producto } from "@/lib/types";

const inputCls =
  "w-full rounded-2xl border border-borde bg-white px-3 py-2.5 text-sm outline-none focus:border-tinta";
const chipCls = (activo: boolean) =>
  `rounded-full px-3 py-1.5 text-xs font-medium ${
    activo ? "bg-tinta text-white" : "border border-borde bg-white text-piedra"
  }`;

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
 * "Le interesa" de un contacto: sus consultas abiertas con cuánto le
 * interesa, si hay stock, y los botones Le vendí / No se dio / Lista de
 * espera. Más accesos para agregar un interés o cargar una venta directa.
 */
export default function InteresControl({
  clienteId,
  abiertas,
  productos,
  stockInfo = {},
}: {
  clienteId: string;
  abiertas: Oportunidad[];
  productos: Producto[];
  stockInfo?: Record<string, InfoStock>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [modo, setModo] = useState<"nada" | "interes" | "venta" | "perdida">("nada");
  const [oppSel, setOppSel] = useState<string | null>(null);
  const [ids, setIds] = useState<string[]>([]);
  const [texto, setTexto] = useState("");
  const [monto, setMonto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [nivel, setNivel] = useState("tibio");
  const [enEspera, setEnEspera] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sinStockElegido = ids.some((id) => (stockInfo[id]?.stock ?? 1) <= 0);

  const nombreProducto = (o: Oportunidad) => {
    const extra = (o.productos_extra ?? [])
      .map((id) => productos.find((p) => p.id === id)?.nombre)
      .filter(Boolean) as string[];
    return [o.producto?.nombre, ...extra].filter(Boolean).join(", ") || o.mensaje_inicial || "Consulta";
  };

  function correr(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      const res = (await fn()) as { error?: string } | null | undefined;
      if (res && typeof res === "object" && "error" in res && res.error) setError(res.error);
      router.refresh();
    });
  }

  function noSeDio(e: React.FormEvent) {
    e.preventDefault();
    if (!oppSel || !motivo) return;
    correr(async () => {
      const res = await cambiarEtapa(oppSel, "perdida", motivo);
      setModo("nada");
      setOppSel(null);
      setMotivo("");
      return res;
    });
  }

  function guardarInteres(e: React.FormEvent) {
    e.preventDefault();
    correr(async () => {
      const res = await crearInteres({
        clienteId,
        productoIds: ids,
        texto,
        nivel,
        enEspera: enEspera && sinStockElegido,
      });
      if (!(res && "error" in res && res.error)) {
        setModo("nada");
        setIds([]);
        setTexto("");
        setEnEspera(false);
      }
      return res;
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
        {abiertas.map((o) => {
          const info = o.producto_id ? stockInfo[o.producto_id] : undefined;
          const enListaEspera = o.etapa === "espera";
          return (
            <div
              key={o.id}
              className={`rounded-xl px-3 py-2.5 ${enListaEspera ? "border border-orange-200 bg-orange-50" : "bg-crema"}`}
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="text-sm font-medium">{nombreProducto(o)}</p>
                {enListaEspera && (
                  <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-medium text-orange-700">
                    En lista de espera
                  </span>
                )}
              </div>
              <p className="text-xs text-piedra">
                {o.origen} · {fechaCorta(o.created_at)}
                {o.monto_estimado ? " · cotizado" : ""}
                {" · "}
                <Link href={`/oportunidades/${o.id}`} className="underline">
                  ver detalle
                </Link>
              </p>
              {info && (
                <p className={`mt-0.5 text-xs ${info.stock > 0 ? "text-green-700" : "text-amber-700"}`}>
                  {textoStock(info, fechaCorta)}
                </p>
              )}

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
                  <>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-piedra">Le interesa:</span>
                      {NIVELES_INTERES.map((n) => (
                        <button
                          key={n.value}
                          type="button"
                          disabled={pending}
                          onClick={() => correr(() => setTemperatura(o.id, n.value))}
                          className={chipCls(o.temperatura === n.value)}
                        >
                          {n.label}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => correr(() => cambiarEtapa(o.id, "ganada"))}
                        className="flex-1 rounded-xl bg-green-600 py-2 text-xs font-medium text-white disabled:opacity-50"
                      >
                        ✓ Le vendí esto
                      </button>
                      {enListaEspera ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => correr(() => cambiarEtapa(o.id, "seguimiento"))}
                          className="flex-1 rounded-xl border border-orange-300 bg-white py-2 text-xs font-medium text-orange-800 disabled:opacity-50"
                        >
                          Sacar de la espera
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => correr(() => cambiarEtapa(o.id, "espera"))}
                          className="flex-1 rounded-xl border border-borde bg-white py-2 text-xs font-medium text-tinta disabled:opacity-50"
                        >
                          Lista de espera
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          setModo("perdida");
                          setOppSel(o.id);
                        }}
                        className="flex-1 rounded-xl border border-borde bg-white py-2 text-xs font-medium text-piedra disabled:opacity-50"
                      >
                        ✗ No se dio
                      </button>
                    </div>
                  </>
                )
              )}
            </div>
          );
        })}
      </div>

      {(modo === "interes" || modo === "venta") && (
        <form
          onSubmit={modo === "interes" ? guardarInteres : guardarVenta}
          className="mt-3 space-y-2 rounded-xl border border-borde bg-crema/60 p-3"
        >
          <p className="text-xs font-semibold text-tinta">
            {modo === "interes" ? "¿Qué le interesa?" : "¿Qué le vendiste?"}
          </p>
          <SelectorProductos
            productos={productos}
            elegidos={ids}
            onChange={(nuevos) => {
              setIds(nuevos);
              if (nuevos.some((id) => (stockInfo[id]?.stock ?? 1) <= 0)) setEnEspera(true);
            }}
          />
          {ids.length > 0 && (
            <div className="space-y-0.5">
              {ids.map((id) => {
                const info = stockInfo[id];
                if (!info) return null;
                return (
                  <p key={id} className={`text-xs ${info.stock > 0 ? "text-green-700" : "text-amber-700"}`}>
                    {productos.find((p) => p.id === id)?.nombre}: {textoStock(info, fechaCorta)}
                  </p>
                );
              })}
            </div>
          )}
          <input
            type="text"
            placeholder={modo === "interes" ? "…o escribilo con tus palabras" : "Nota (o qué se vendió, si no está en el catálogo)"}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className={inputCls}
          />
          {modo === "interes" && (
            <>
              <div className="flex flex-wrap gap-1.5">
                {NIVELES_INTERES.map((n) => (
                  <button
                    key={n.value}
                    type="button"
                    onClick={() => setNivel(n.value)}
                    className={chipCls(nivel === n.value)}
                  >
                    {n.label}
                  </button>
                ))}
              </div>
              {sinStockElegido && (
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <input
                    type="checkbox"
                    checked={enEspera}
                    onChange={(e) => setEnEspera(e.target.checked)}
                    className="h-4 w-4 accent-tinta"
                  />
                  Ponerlo en lista de espera: lo quiere y no hay stock
                </label>
              )}
            </>
          )}
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
