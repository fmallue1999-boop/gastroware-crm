"use client";

import { useState } from "react";

const inputCls =
  "w-full rounded-xl border border-borde bg-white px-3 py-2.5 text-sm outline-none focus:border-tinta";

const fmt = (n: number) =>
  "$" + new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(n);

export default function CalculadoraZumex() {
  const [vasos, setVasos] = useState("");
  const [precio, setPrecio] = useState("");
  const [naranja, setNaranja] = useState("");
  const [otros, setOtros] = useState("");
  const [dias, setDias] = useState("26");
  const [equipo, setEquipo] = useState("");
  const [copiado, setCopiado] = useState(false);

  const n = (s: string) => Number(s) || 0;
  const margenVaso = n(precio) - n(naranja) - n(otros);
  const diasMes = n(dias) || 26;

  const escenarios = [
    { nombre: "Conservador", factor: 0.7 },
    { nombre: "Base", factor: 1 },
    { nombre: "Optimista", factor: 1.3 },
  ].map((e) => {
    const vasosDia = Math.round(n(vasos) * e.factor);
    const facturacion = vasosDia * n(precio) * diasMes;
    const margen = vasosDia * margenVaso * diasMes;
    const recupero = margen > 0 && n(equipo) > 0 ? n(equipo) / margen : 0;
    return { ...e, vasosDia, facturacion, margen, recupero };
  });

  const listo = n(vasos) > 0 && n(precio) > 0 && margenVaso > 0;
  const base = escenarios[1];

  const resumen = listo
    ? `🍊 *Jugo natural como unidad de negocio*

Con ${base.vasosDia} vasos por día a ${fmt(n(precio))}:
• Facturación mensual: ${fmt(base.facturacion)}
• Margen bruto mensual: ${fmt(base.margen)}${
        base.recupero > 0
          ? `
• Recuperás la inversión en ${redondear(base.recupero)} meses`
          : ""
      }

Incluso en un escenario conservador (${escenarios[0].vasosDia} vasos/día)${
        escenarios[0].recupero > 0
          ? ` la inversión se recupera en ${redondear(escenarios[0].recupero)} meses`
          : ` el margen mensual es ${fmt(escenarios[0].margen)}`
      }.

Más que el precio del equipo, lo importante es el negocio que genera todos los días.`
    : "";

  async function copiar() {
    await navigator.clipboard.writeText(resumen);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-borde bg-white p-4 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm text-piedra">
            Vasos por día (estimado)
            <input type="number" value={vasos} onChange={(e) => setVasos(e.target.value)} className={`${inputCls} mt-1`} placeholder="80" />
          </label>
          <label className="text-sm text-piedra">
            Precio de venta por vaso
            <input type="number" value={precio} onChange={(e) => setPrecio(e.target.value)} className={`${inputCls} mt-1`} placeholder="3500" />
          </label>
          <label className="text-sm text-piedra">
            Costo de naranja por vaso
            <input type="number" value={naranja} onChange={(e) => setNaranja(e.target.value)} className={`${inputCls} mt-1`} placeholder="900" />
          </label>
          <label className="text-sm text-piedra">
            Otros costos por vaso
            <input type="number" value={otros} onChange={(e) => setOtros(e.target.value)} className={`${inputCls} mt-1`} placeholder="200" />
          </label>
          <label className="text-sm text-piedra">
            Días operativos por mes
            <input type="number" value={dias} onChange={(e) => setDias(e.target.value)} className={`${inputCls} mt-1`} />
          </label>
          <label className="text-sm text-piedra">
            Valor del equipo (en pesos)
            <input type="number" value={equipo} onChange={(e) => setEquipo(e.target.value)} className={`${inputCls} mt-1`} placeholder="12000000" />
          </label>
        </div>
      </div>

      {listo && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {escenarios.map((e) => (
              <div
                key={e.nombre}
                className={`rounded-xl border p-3 ${
                  e.nombre === "Base"
                    ? "border-celeste-deep bg-celeste-soft"
                    : "border-borde bg-white"
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-piedra">
                  {e.nombre}
                </p>
                <p className="text-xs text-piedra mt-1">{e.vasosDia} vasos/día</p>
                <p className="mt-2 text-sm font-semibold">{fmt(e.margen)}</p>
                <p className="text-xs text-piedra">margen/mes</p>
                {e.recupero > 0 && (
                  <p className="mt-1.5 text-sm">
                    <span className="font-semibold">{redondear(e.recupero)}</span>{" "}
                    <span className="text-xs text-piedra">meses de recupero</span>
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-borde bg-white p-4">
            <p className="text-sm font-semibold mb-2">
              Resumen listo para el cliente
            </p>
            <p className="whitespace-pre-wrap rounded-lg bg-crema p-3 text-sm text-tinta/80">
              {resumen}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={copiar}
                className="flex-1 rounded-xl bg-tinta py-2.5 text-sm font-medium text-white"
              >
                {copiado ? "¡Copiado!" : "Copiar resumen"}
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(resumen)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 rounded-xl bg-green-600 py-2.5 text-center text-sm font-medium text-white"
              >
                Mandar por WhatsApp
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function redondear(x: number) {
  return (Math.round(x * 10) / 10).toLocaleString("es-AR");
}
