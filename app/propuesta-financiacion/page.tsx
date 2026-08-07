import Logo from "@/components/Logo";
import BotonImprimir from "@/components/BotonImprimir";
import { calcularOpciones } from "@/lib/financiacion";
import { dinero, fechaCorta, hoyISO } from "@/lib/format";

/**
 * Hoja formal de opciones de financiación para entregar al cliente.
 * Se genera desde la calculadora (/financiacion) y se imprime o guarda en PDF.
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
  }>;
}) {
  const sp = await searchParams;
  const monto = parseFloat(sp.monto ?? "0") || 0;
  const tna = parseFloat(sp.tna ?? "29") || 29;
  const usd = parseFloat(sp.usd ?? "0") || 0;
  const tc = parseFloat(sp.tc ?? "0") || 0;
  const opciones = calcularOpciones(monto, tna);

  if (monto <= 0 || opciones.length === 0) {
    return (
      <p className="p-8 text-sm text-piedra">
        Falta el monto. Generá la hoja desde Financiación.
      </p>
    );
  }

  const usdFmt = (v: number) =>
    "U$D " + v.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="mx-auto max-w-2xl bg-white p-8 text-tinta print:p-0">
      <div className="mb-5 flex items-start justify-between border-b-2 border-tinta pb-4">
        <div className="flex items-center gap-3">
          <Logo tamano="lg" />
          <div>
            <h1 className="text-xl font-bold">GastroWare</h1>
            <p className="text-sm text-piedra">
              Equipamiento gastronómico profesional
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-base font-bold">Opciones de financiación</p>
          <p className="text-sm text-piedra">{fechaCorta(hoyISO())}</p>
        </div>
      </div>

      {(sp.cliente || sp.equipo) && (
        <div className="mb-4 text-sm">
          {sp.cliente && (
            <p>
              <span className="font-semibold">Preparado para:</span>{" "}
              {sp.cliente}
            </p>
          )}
          {sp.equipo && (
            <p>
              <span className="font-semibold">Equipo:</span> {sp.equipo}
            </p>
          )}
        </div>
      )}

      <div className="mb-5 rounded-xl border border-borde bg-crema/60 p-4 text-sm">
        <p className="font-semibold">
          Monto a financiar: {dinero(monto)}
        </p>
        {usd > 0 && tc > 0 && (
          <p className="text-piedra">
            {usdFmt(usd)} al tipo de cambio de referencia $
            {tc.toLocaleString("es-AR")}
          </p>
        )}
        <p className="mt-1 text-piedra">
          Financiación bancaria del Banco de la Nación Argentina — planes
          PymeNación / AgroNación · TNA {tna}% · IVA sobre intereses 10,5%
        </p>
      </div>

      <table className="mb-5 w-full text-sm">
        <thead>
          <tr className="border-b border-tinta text-left">
            <th className="py-1.5 pr-2">Plan</th>
            <th className="py-1.5 text-right">Valor de cuota*</th>
            <th className="py-1.5 text-right">Total a devolver</th>
          </tr>
        </thead>
        <tbody>
          {opciones.map((o) => (
            <tr key={o.clave} className="border-b border-borde">
              <td className="py-2 pr-2">
                <p className="font-medium">{o.titulo}</p>
                <p className="text-xs text-piedra">{o.canal}</p>
              </td>
              <td className="py-2 text-right align-top">
                {o.cuotas > 1 ? (
                  <>
                    <p className="font-medium">
                      {o.cuotas} × {dinero(o.cuotaPromedio)}
                    </p>
                    <p className="text-xs text-piedra">
                      (de {dinero(o.primeraCuota)} a {dinero(o.ultimaCuota)})
                    </p>
                  </>
                ) : (
                  <p className="font-medium">
                    Pago único{o.diferimientoMeses > 0 ? " al año" : ""}
                  </p>
                )}
              </td>
              <td className="py-2 text-right align-top font-semibold">
                {dinero(o.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mb-5 space-y-1 text-xs text-piedra">
        <p>
          * Cuotas del sistema alemán: capital fijo e interés sobre saldo, por
          eso la cuota baja mes a mes. El valor indicado es el promedio.
        </p>
        <p>
          Los planes con gracia devengan interés durante el período diferido.
          Operatoria según canal: Botón de Pago (Nación Pos Web) o BNA Conecta
          (e-commerce).
        </p>
        <p>
          Simulación de carácter informativo y orientativo, elaborada con las
          tasas vigentes del Banco de la Nación Argentina a la fecha. No
          constituye oferta del banco: la operación está sujeta a la
          aprobación crediticia del cliente ante el BNA. Montos expresados en
          pesos argentinos, IVA sobre intereses incluido.
        </p>
      </div>

      <div className="border-t border-borde pt-3 text-xs text-piedra">
        <p className="font-semibold text-tinta">
          GastroWare — Equipamiento gastronómico
        </p>
        <p>
          Mitre 2007 · Mar del Plata · WhatsApp +54 9 223 340-0755 ·
          www.gastroware.com.ar
        </p>
      </div>

      <BotonImprimir />
    </div>
  );
}
