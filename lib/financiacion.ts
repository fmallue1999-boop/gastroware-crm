/*
 * Motor de financiación bancaria (planes PymeNación / AgroNación del BNA),
 * replicando el simulador oficial que usa Franco (Excel "Simulador"):
 * - Sistema alemán: cuota de capital fija, interés sobre saldo deudor.
 * - Interés mensual = saldo × TNA × 30 / 36500 (año de 365 días).
 * - IVA sobre intereses: 10,5%.
 * - Diferidos: el interés del período de gracia se devenga sobre el capital
 *   total y se cobra con el/los pagos (en el 6+6 se prorratea en las cuotas).
 * Es una simulación orientativa: la oferta real la hace el banco.
 */

export type OpcionFinanciacion = {
  clave: string;
  titulo: string;
  canal: string;
  cuotas: number;
  /** Meses de gracia antes de la primera cuota. */
  diferimientoMeses: number;
  primeraCuota: number;
  ultimaCuota: number;
  cuotaPromedio: number;
  interesTotal: number;
  ivaTotal: number;
  total: number;
  /** Recargo total sobre el monto financiado, en %. */
  recargoPct: number;
};

function planCuotas(
  monto: number,
  n: number,
  tna: number,
  ivaPct: number,
  diferMeses = 0
) {
  const capitalCuota = monto / n;
  // Interés devengado durante la gracia, sobre el capital completo
  const interesDiferido = (monto * tna * diferMeses * 30) / 36500;
  const ivaDiferido = interesDiferido * ivaPct;
  const extraPorCuota = (interesDiferido + ivaDiferido) / n;

  let saldo = monto;
  let interesTotal = interesDiferido;
  let ivaTotal = ivaDiferido;
  const importes: number[] = [];
  for (let i = 0; i < n; i++) {
    const interes = (saldo * tna * 30) / 36500;
    const iva = interes * ivaPct;
    interesTotal += interes;
    ivaTotal += iva;
    importes.push(capitalCuota + interes + iva + extraPorCuota);
    saldo -= capitalCuota;
  }
  const total = importes.reduce((s, x) => s + x, 0);
  return {
    primeraCuota: importes[0],
    ultimaCuota: importes[n - 1],
    cuotaPromedio: total / n,
    interesTotal,
    ivaTotal,
    total,
  };
}

/** Diferido: un único pago a los `meses` meses (capital + interés + IVA). */
function planDiferido(monto: number, meses: number, tna: number, ivaPct: number) {
  const interes = (monto * tna * meses * 30) / 36500;
  const iva = interes * ivaPct;
  const total = monto + interes + iva;
  return {
    primeraCuota: total,
    ultimaCuota: total,
    cuotaPromedio: total,
    interesTotal: interes,
    ivaTotal: iva,
    total,
  };
}

export function calcularOpciones(
  monto: number,
  tna: number,
  ivaPct = 0.105
): OpcionFinanciacion[] {
  if (!monto || monto <= 0) return [];
  const arma = (
    clave: string,
    titulo: string,
    canal: string,
    cuotas: number,
    diferimientoMeses: number,
    calc: ReturnType<typeof planCuotas>
  ): OpcionFinanciacion => ({
    clave,
    titulo,
    canal,
    cuotas,
    diferimientoMeses,
    ...calc,
    recargoPct: ((calc.total - monto) / monto) * 100,
  });

  return [
    arma(
      "c12",
      "12 cuotas mensuales",
      "Botón de Pago (Nación Pos Web)",
      12,
      0,
      planCuotas(monto, 12, tna, ivaPct)
    ),
    arma(
      "c18",
      "18 cuotas mensuales",
      "BNA Conecta (e-commerce)",
      18,
      0,
      planCuotas(monto, 18, tna, ivaPct)
    ),
    arma(
      "c24",
      "24 cuotas mensuales",
      "BNA Conecta (e-commerce)",
      24,
      0,
      planCuotas(monto, 24, tna, ivaPct)
    ),
    arma(
      "c36",
      "36 cuotas mensuales",
      "BNA Conecta (e-commerce)",
      36,
      0,
      planCuotas(monto, 36, tna, ivaPct)
    ),
    arma(
      "d6c6",
      "6 meses de gracia + 6 cuotas",
      "Botón de Pago (Nación Pos Web)",
      6,
      6,
      planCuotas(monto, 6, tna, ivaPct, 6)
    ),
    arma(
      "d12",
      "12 meses de gracia, 1 solo pago",
      "Botón de Pago / BNA Conecta",
      1,
      12,
      planDiferido(monto, 12, tna, ivaPct)
    ),
  ];
}
