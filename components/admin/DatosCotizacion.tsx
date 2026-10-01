"use client";

import { useState, useTransition } from "react";
import { fijarProximoNumeroCotizacion, guardarDatosCotizacion } from "@/lib/actions";
import { CAMPOS_COTIZACION, numeroComprobante, type ClaveCotizacion } from "@/lib/cotizacion-pdf";

const inputCls = "mt-1 w-full rounded-xl border border-borde bg-white px-3 py-2.5 text-[15px] font-normal outline-none focus:border-marino";

/**
 * Administración → Marca: el membrete de la cotización en PDF (tal cual sale
 * arriba), el punto de venta, la nota de las cotizaciones en dólares y desde
 * qué número siguen.
 */
export default function DatosCotizacion({
  inicial,
  ultimoNumero,
  puedeEditar,
}: {
  inicial: Partial<Record<ClaveCotizacion, string>>;
  ultimoNumero: number;
  puedeEditar: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [valores, setValores] = useState(inicial);
  const [proximo, setProximo] = useState("");
  const [msg, setMsg] = useState<{ texto: string; error?: boolean } | null>(null);
  const [msgNum, setMsgNum] = useState<{ texto: string; error?: boolean } | null>(null);

  const cambiado = CAMPOS_COTIZACION.some((c) => (valores[c.clave] ?? "") !== (inicial[c.clave] ?? ""));
  const pv = valores.cotizacion_punto_venta ?? "";

  function guardar() {
    setMsg(null);
    startTransition(async () => {
      const r = await guardarDatosCotizacion(valores);
      setMsg(r && "error" in r && r.error ? { texto: r.error, error: true } : { texto: "Guardado ✓" });
    });
  }

  function fijarNumero() {
    setMsgNum(null);
    startTransition(async () => {
      const r = await fijarProximoNumeroCotizacion(Number(proximo));
      if (r && "error" in r && r.error) setMsgNum({ texto: r.error, error: true });
      else {
        setMsgNum({ texto: `Listo: la próxima cotización sale con el N° ${numeroComprobante(pv, Number(proximo))}` });
        setProximo("");
      }
    });
  }

  const campo = (clave: ClaveCotizacion) => CAMPOS_COTIZACION.find((c) => c.clave === clave)!;
  const input = (clave: ClaveCotizacion, extra?: { placeholder?: string; inputMode?: "numeric" }) => (
    <label key={clave} className="block text-sm font-semibold">
      {campo(clave).label}
      <input
        type="text"
        value={valores[clave] ?? ""}
        disabled={!puedeEditar}
        onChange={(e) => setValores({ ...valores, [clave]: e.target.value })}
        className={inputCls}
        {...extra}
      />
    </label>
  );

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-extrabold">Cotización en PDF</h2>
        <p className="text-[14px] text-piedra">
          Los datos de la empresa salen arriba de cada cotización, tal cual los escribas acá.
        </p>
      </div>

      <div className="grid gap-3 rounded-2xl border border-borde bg-white p-4 shadow-sm sm:grid-cols-2">
        {input("empresa_razon_social")}
        {input("empresa_condicion_iva", { placeholder: "Responsable Inscripto" })}
        {input("empresa_cuit")}
        {input("empresa_iibb")}
        {input("empresa_inicio_actividades", { placeholder: "dd/mm/aaaa" })}
        {input("empresa_telefono")}
        {input("empresa_email")}
        {input("empresa_direccion")}
        {input("empresa_localidad")}
        {input("cotizacion_punto_venta", { placeholder: "0007", inputMode: "numeric" })}
        <div className="space-y-3 rounded-xl bg-crema p-3 sm:col-span-2">
          <p className="text-[15px] font-extrabold">Cómo cotiza el vendedor</p>
          <label className="block text-sm font-semibold">
            {campo("cotizacion_moneda").label}
            <select
              value={valores.cotizacion_moneda ?? ""}
              disabled={!puedeEditar}
              onChange={(e) => setValores({ ...valores, cotizacion_moneda: e.target.value })}
              className={inputCls}
            >
              <option value="USD">Siempre en dólares</option>
              <option value="ARS">Siempre en pesos</option>
              <option value="">El vendedor elige (pesos o dólares)</option>
            </select>
            <span className="mt-1 block text-xs font-normal text-piedra">
              El vendedor cotiza a precio de catálogo en esa moneda y con el IVA de cada producto. Los descuentos van como “pedido especial” y los aprobás vos.
            </span>
          </label>
          {(["cotizacion_formas_pago", "cotizacion_plazos_entrega", "cotizacion_condiciones_entrega"] as const).map((k) => (
            <label key={k} className="block text-sm font-semibold">
              {campo(k).label}
              <span className="block text-xs font-normal text-piedra">Una opción por renglón: es lo que el vendedor elige en el desplegable.</span>
              <textarea
                rows={4}
                value={valores[k] ?? ""}
                disabled={!puedeEditar}
                onChange={(e) => setValores({ ...valores, [k]: e.target.value })}
                className={inputCls}
              />
            </label>
          ))}
        </div>
        <label className="block text-sm font-semibold sm:col-span-2">
          {campo("cotizacion_leyenda_usd").label}
          <span className="block text-xs font-normal text-piedra">
            Sale abajo en las cotizaciones en dólares. Donde escribas {"{total}"} va el total con IVA.
          </span>
          <textarea
            rows={4}
            value={valores.cotizacion_leyenda_usd ?? ""}
            disabled={!puedeEditar}
            onChange={(e) => setValores({ ...valores, cotizacion_leyenda_usd: e.target.value })}
            className={inputCls}
          />
        </label>
        {puedeEditar && (
          <div className="flex items-center gap-3 sm:col-span-2">
            <button
              type="button"
              disabled={pending || !cambiado}
              onClick={guardar}
              className="min-h-11 rounded-xl bg-marino px-5 text-[15px] font-bold text-white disabled:opacity-50"
            >
              {pending ? "Guardando…" : "Guardar datos"}
            </button>
            {msg && <p className={`text-sm font-bold ${msg.error ? "text-red-600" : "text-verde"}`}>{msg.texto}</p>}
          </div>
        )}
      </div>

      <div className="space-y-2 rounded-2xl border border-borde bg-white p-4 shadow-sm">
        <p className="text-[15px] font-bold">Numeración</p>
        <p className="text-sm text-piedra">
          {ultimoNumero
            ? `La última cotización salió con el N° ${numeroComprobante(pv, ultimoNumero)}. La próxima sigue con el ${numeroComprobante(pv, ultimoNumero + 1)}.`
            : "Todavía no hay cotizaciones."}{" "}
          Si querés que sigan desde otro número (por ejemplo, el que venían usando), ponelo acá. Tiene que ser mayor que el último.
        </p>
        {puedeEditar && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={ultimoNumero + 1}
              placeholder={String(ultimoNumero + 1)}
              value={proximo}
              onChange={(e) => setProximo(e.target.value)}
              className="w-40 rounded-xl border border-borde px-3 py-2.5 text-[15px]"
              aria-label="Próximo número de cotización"
            />
            <button
              type="button"
              disabled={pending || !proximo}
              onClick={fijarNumero}
              className="min-h-11 rounded-xl border border-borde bg-white px-4 text-[15px] font-bold disabled:opacity-50"
            >
              Seguir desde este número
            </button>
          </div>
        )}
        {msgNum && <p className={`text-sm font-bold ${msgNum.error ? "text-red-600" : "text-verde"}`}>{msgNum.texto}</p>}
      </div>
    </section>
  );
}
