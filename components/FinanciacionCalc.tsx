"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { calcularOpciones } from "@/lib/financiacion";
import { dinero } from "@/lib/format";

const inputCls =
  "w-full rounded-2xl border border-borde bg-white shadow-sm px-4 py-3 text-base outline-none focus:border-tinta";

function numero(v: string): number {
  // Acepta "3664,18", "3.664,18" o "3664.18"
  const limpio = v.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(limpio);
  return isNaN(n) ? 0 : n;
}

export default function FinanciacionCalc({ tnaDefault }: { tnaDefault: number }) {
  const [modo, setModo] = useState<"usd" | "pesos">("usd");
  const [usd, setUsd] = useState("");
  const [tc, setTc] = useState("");
  const [pesos, setPesos] = useState("");
  const [tna, setTna] = useState(String(tnaDefault));
  const [cliente, setCliente] = useState("");
  const [equipo, setEquipo] = useState("");
  const [excluidos, setExcluidos] = useState<string[]>([]);
  const [conDetalle, setConDetalle] = useState(true);

  const montoUsd = numero(usd);
  const tipoCambio = numero(tc);
  const monto = modo === "usd" ? montoUsd * tipoCambio : numero(pesos);
  const tasa = numero(tna);
  const opciones = calcularOpciones(monto, tasa);

  const incluidas = opciones.filter((o) => !excluidos.includes(o.clave));

  const paramsPdf = new URLSearchParams();
  paramsPdf.set("monto", String(Math.round(monto * 100) / 100));
  paramsPdf.set("tna", String(tasa));
  if (modo === "usd" && montoUsd > 0) {
    paramsPdf.set("usd", String(montoUsd));
    paramsPdf.set("tc", String(tipoCambio));
  }
  if (cliente.trim()) paramsPdf.set("cliente", cliente.trim());
  if (equipo.trim()) paramsPdf.set("equipo", equipo.trim());
  if (excluidos.length > 0)
    paramsPdf.set("planes", incluidas.map((o) => o.clave).join(","));
  if (conDetalle) paramsPdf.set("detalle", "1");

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-borde bg-white p-4 shadow-sm">
        <div className="mb-3 flex gap-1.5">
          <button
            type="button"
            onClick={() => setModo("usd")}
            className={`flex-1 rounded-2xl px-3 py-2.5 text-sm font-medium ${
              modo === "usd"
                ? "bg-tinta text-white"
                : "border border-borde bg-white text-piedra"
            }`}
          >
            Monto en U$D + tipo de cambio
          </button>
          <button
            type="button"
            onClick={() => setModo("pesos")}
            className={`flex-1 rounded-2xl px-3 py-2.5 text-sm font-medium ${
              modo === "pesos"
                ? "bg-tinta text-white"
                : "border border-borde bg-white text-piedra"
            }`}
          >
            Directo en pesos
          </button>
        </div>

        {modo === "usd" ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-piedra">
                Monto U$D
              </p>
              <input
                type="text"
                inputMode="decimal"
                placeholder="3.664,18"
                value={usd}
                onChange={(e) => setUsd(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-piedra">
                Tipo de cambio
              </p>
              <input
                type="text"
                inputMode="decimal"
                placeholder="1.520"
                value={tc}
                onChange={(e) => setTc(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
        ) : (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-piedra">
              Monto en pesos
            </p>
            <input
              type="text"
              inputMode="decimal"
              placeholder="5.569.553"
              value={pesos}
              onChange={(e) => setPesos(e.target.value)}
              className={inputCls}
            />
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-piedra">
              Tasa TNA % (BNA vigente)
            </p>
            <input
              type="text"
              inputMode="decimal"
              value={tna}
              onChange={(e) => setTna(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-piedra">
              Monto a financiar
            </p>
            <p className="rounded-2xl bg-crema px-4 py-3 text-base font-semibold">
              {monto > 0 ? dinero(monto) : "—"}
            </p>
          </div>
        </div>
      </div>

      {opciones.length > 0 && (
        <>
          {/* Tabla escritorio */}
          <div className="hidden overflow-hidden rounded-2xl border border-borde bg-white shadow-sm sm:block">
            <table className="w-full text-sm">
              <thead className="border-b border-borde bg-crema/60 text-left">
                <tr>
                  <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-piedra">
                    Plan
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-piedra">
                    Cuota promedio
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-piedra">
                    1ª / última
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-piedra">
                    Total a devolver
                  </th>
                </tr>
              </thead>
              <tbody>
                {opciones.map((o) => (
                  <tr key={o.clave} className="border-b border-borde/60 last:border-0">
                    <td className="px-3 py-2.5">
                      <p className="font-medium">{o.titulo}</p>
                      <p className="text-xs text-piedra">{o.canal}</p>
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium">
                      {o.cuotas > 1 ? dinero(o.cuotaPromedio) : "Pago único"}
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs text-piedra">
                      {o.cuotas > 1
                        ? `${dinero(o.primeraCuota)} / ${dinero(o.ultimaCuota)}`
                        : dinero(o.total)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <p className="font-semibold">{dinero(o.total)}</p>
                      <p className="text-xs text-piedra">
                        +{o.recargoPct.toFixed(1)}%
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tarjetas mobile */}
          <div className="space-y-2 sm:hidden">
            {opciones.map((o) => (
              <div
                key={o.clave}
                className="rounded-2xl border border-borde bg-white p-3 shadow-sm"
              >
                <p className="text-sm font-medium">{o.titulo}</p>
                <p className="text-xs text-piedra">{o.canal}</p>
                <p className="mt-1 text-sm">
                  {o.cuotas > 1
                    ? `${o.cuotas} × ${dinero(o.cuotaPromedio)} (prom.)`
                    : `Pago único ${dinero(o.total)}`}
                  {" · total "}
                  <span className="font-semibold">{dinero(o.total)}</span>
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-borde bg-white p-4 shadow-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-piedra">
              Hoja para el cliente (opcional: personalizala)
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                type="text"
                placeholder="Nombre del cliente (opcional)"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                className={inputCls}
              />
              <input
                type="text"
                placeholder="Equipo cotizado (opcional): Zumex Speed Up…"
                value={equipo}
                onChange={(e) => setEquipo(e.target.value)}
                className={inputCls}
              />
            </div>

            <p className="mt-3 mb-1.5 text-xs text-piedra">
              Planes que van en la hoja (tocá para sacar alguno):
            </p>
            <div className="flex flex-wrap gap-1.5">
              {opciones.map((o) => {
                const activo = !excluidos.includes(o.clave);
                return (
                  <button
                    key={o.clave}
                    type="button"
                    onClick={() =>
                      setExcluidos(
                        activo
                          ? [...excluidos, o.clave]
                          : excluidos.filter((c) => c !== o.clave)
                      )
                    }
                    className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                      activo
                        ? "bg-tinta text-white"
                        : "border border-borde bg-white text-piedra line-through"
                    }`}
                  >
                    {o.titulo}
                  </button>
                );
              })}
            </div>

            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={conDetalle}
                onChange={(e) => setConDetalle(e.target.checked)}
                className="h-4 w-4 accent-tinta"
              />
              Incluir el desglose cuota por cuota (saldo, interés, IVA y
              capital, como el simulador del banco)
            </label>

            <a
              href={`/propuesta-financiacion?${paramsPdf.toString()}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`mt-3 flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-medium ${
                incluidas.length === 0
                  ? "pointer-events-none bg-crema-deep text-piedra"
                  : "bg-tinta text-white"
              }`}
            >
              <FileText className="h-4 w-4" /> Generar hoja para el cliente
              (imprimir / PDF)
            </a>
          </div>
        </>
      )}

      <p className="text-xs text-piedra">
        Simulación orientativa con tasas del Banco Nación (planes PymeNación /
        AgroNación, IVA 10,5% sobre intereses). No constituye oferta del banco:
        la operación queda sujeta a su aprobación. Cuando el BNA actualice la
        tasa, cambiala arriba y listo.
      </p>
    </div>
  );
}
