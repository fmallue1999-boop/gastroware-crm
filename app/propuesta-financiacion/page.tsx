import LogoEmpresa from "@/components/LogoEmpresa";
import BotonImprimir from "@/components/BotonImprimir";
import { calcularOpciones } from "@/lib/financiacion";
import { dinero, fechaCorta, hoyISO } from "@/lib/format";

/**
 * Propuesta formal de financiación para entregar al cliente. Se genera desde
 * la calculadora (/financiacion); imprime o guarda en PDF. Acepta `planes`
 * (claves separadas por coma) y `detalle=1` para el desglose cuota por cuota.
 */
export default async function PropuestaFinanciacionPage({
  searchParams,
}: {
  searchParams: Promise<{
    monto?: string;
    tna?: string;
    usd?: string;
    tc?: string;
    cliente?: string;
    equipo?: string;
    planes?: string;
    detalle?: string;
  }>;
}) {
  const sp = await searchParams;
  const monto = parseFloat(sp.monto ?? "0") || 0;
  const tna = parseFloat(sp.tna ?? "29") || 29;
  const usd = parseFloat(sp.usd ?? "0") || 0;
  const tc = parseFloat(sp.tc ?? "0") || 0;
  const conDetalle = sp.detalle === "1";
  const filtro = (sp.planes ?? "").split(",").filter(Boolean);

  let opciones = calcularOpciones(monto, tna);
  if (filtro.length > 0)
    opciones = opciones.filter((o) => filtro.includes(o.clave));

  if (monto <= 0 || opciones.length === 0) {
    return (
      <p className="p-8 text-sm text-piedra">
        Falta el monto. Generá la hoja desde Financiación.
      </p>
    );
  }

  const usdFmt = (v: number) =>
    "U$D " +
    v.toLocaleString("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-tinta print:p-0">
      {/* Membrete */}
      <div className="flex items-center justify-between gap-4 border-b-4 border-tinta pb-4">
        <div className="flex items-center gap-3">
          <LogoEmpresa />
          <div>
            <p className="text-xl font-bold leading-tight">GastroWare</p>
            <p className="text-xs text-piedra">
              Equipamiento gastronómico profesional
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-piedra">
            Propuesta de
          </p>
          <p className="text-lg font-bold leading-tight">Financiación</p>
          <p className="mt-0.5 text-xs text-piedra">{fechaCorta(hoyISO())}</p>
        </div>
      </div>

      {/* Cliente / equipo */}
      {(sp.cliente || sp.equipo) && (
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          {sp.cliente && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-piedra">
                Preparado para
              </p>
              <p className="font-medium">{sp.cliente}</p>
            </div>
          )}
          {sp.equipo && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-piedra">
                Equipo
              </p>
              <p className="font-medium">{sp.equipo}</p>
            </div>
          )}
        </div>
      )}

      {/* Monto */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-tinta px-5 py-4 text-white">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">
            Monto a financiar
          </p>
          <p className="text-2xl font-bold">{dinero(monto)}</p>
        </div>
        {usd > 0 && tc > 0 && (
          <p className="text-right text-xs opacity-80">
            {usdFmt(usd)} · tipo de cambio de referencia $
            {tc.toLocaleString("es-AR")}
          </p>
        )}
      </div>
      <p className="mt-2 text-xs text-piedra">
        Financiación del Banco de la Nación Argentina — planes PymeNación /
        AgroNación · TNA {tna}% · IVA sobre intereses 10,5% · Tasas vigentes a
        la fecha.
      </p>

      {/* Resumen de opciones */}
      <table className="mt-4 w-full border-collapse text-sm">
        <thead>
          <tr className="bg-crema text-left">
            <th className="rounded-l-lg px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-piedra">
              Plan
            </th>
            <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-piedra">
              Valor de cuota*
            </th>
            <th className="rounded-r-lg px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-piedra">
              Total a devolver
            </th>
          </tr>
        </thead>
        <tbody>
          {opciones.map((o) => (
            <tr key={o.clave} className="border-b border-borde/70">
              <td className="px-3 py-2.5">
                <p className="font-semibold">{o.titulo}</p>
                <p className="text-xs text-piedra">{o.canal}</p>
              </td>
              <td className="px-3 py-2.5 text-right align-top">
                {o.cuotas > 1 ? (
                  <>
                    <p className="font-semibold">
                      {o.cuotas} × {dinero(o.cuotaPromedio)}
                    </p>
                    <p className="text-xs text-piedra">
                      de {dinero(o.primeraCuota)} a {dinero(o.ultimaCuota)}
                    </p>
                  </>
                ) : (
                  <p className="font-semibold">
                    Pago único{o.diferimientoMeses > 0 ? " al año" : ""}
                  </p>
                )}
              </td>
              <td className="px-3 py-2.5 text-right align-top">
                <p className="font-bold">{dinero(o.total)}</p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Desglose cuota por cuota, como el simulador del banco */}
      {conDetalle && (
        <div className="mt-6 space-y-6">
          <p className="border-b-2 border-tinta pb-1 text-sm font-bold uppercase tracking-wide">
            Desglose cuota por cuota
          </p>
          {opciones.map((o) => (
            <div key={o.clave} className="print:break-inside-avoid">
              <p className="text-sm font-semibold">
                {o.titulo}{" "}
                <span className="font-normal text-piedra">— {o.canal}</span>
              </p>
              <table className="mt-1.5 w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-crema/70 text-piedra">
                    <th className="px-2 py-1.5 text-left font-semibold">Cuota</th>
                    <th className="px-2 py-1.5 text-right font-semibold">
                      Saldo deudor
                    </th>
                    <th className="px-2 py-1.5 text-right font-semibold">
                      Interés
                    </th>
                    <th className="px-2 py-1.5 text-right font-semibold">IVA</th>
                    <th className="px-2 py-1.5 text-right font-semibold">
                      Capital
                    </th>
                    <th className="px-2 py-1.5 text-right font-semibold">
                      Importe cuota
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {o.filas.map((f) => (
                    <tr key={f.etiqueta} className="border-b border-borde/50">
                      <td className="px-2 py-1">{f.etiqueta}</td>
                      <td className="px-2 py-1 text-right">{dinero(f.saldo)}</td>
                      <td className="px-2 py-1 text-right">{dinero(f.interes)}</td>
                      <td className="px-2 py-1 text-right">{dinero(f.iva)}</td>
                      <td className="px-2 py-1 text-right">{dinero(f.capital)}</td>
                      <td className="px-2 py-1 text-right font-medium">
                        {dinero(f.importe)}
                      </td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td className="px-2 py-1.5" colSpan={2}>
                      Total
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      {dinero(o.interesTotal)}
                    </td>
                    <td className="px-2 py-1.5 text-right">{dinero(o.ivaTotal)}</td>
                    <td className="px-2 py-1.5 text-right">{dinero(monto)}</td>
                    <td className="px-2 py-1.5 text-right">{dinero(o.total)}</td>
                  </tr>
                </tbody>
              </table>
              {o.diferimientoMeses > 0 && o.cuotas > 1 && (
                <p className="mt-1 text-[11px] text-piedra">
                  Las cuotas incluyen, prorrateado, el interés devengado
                  durante los {o.diferimientoMeses} meses de gracia.
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Condiciones */}
      <div className="mt-6 space-y-1 text-[11px] leading-relaxed text-piedra">
        <p>
          * Cuotas del sistema alemán: capital fijo e interés sobre saldo
          deudor (la cuota baja mes a mes); el valor indicado es el promedio.
          Interés calculado a 30 días sobre año de 365.
        </p>
        <p>
          Operatoria según canal: Botón de Pago (Nación Pos Web) o BNA Conecta
          (e-commerce). Los planes con gracia devengan interés durante el
          período diferido.
        </p>
        <p>
          El presente desarrollo tiene carácter informativo y orientativo, y
          no constituye oferta del Banco de la Nación Argentina. La operación
          queda sujeta a la aprobación crediticia del cliente ante el banco.
          Montos en pesos argentinos con IVA sobre intereses incluido.
        </p>
      </div>

      {/* Pie */}
      <div className="mt-5 flex items-center justify-between border-t-2 border-tinta pt-3 text-[11px] text-piedra">
        <p className="font-semibold text-tinta">
          GastroWare — Equipamiento gastronómico
        </p>
        <p>
          Mitre 2007, Mar del Plata · WhatsApp +54 9 223 340-0755 ·
          www.gastroware.com.ar
        </p>
      </div>

      <BotonImprimir />
    </div>
  );
}
