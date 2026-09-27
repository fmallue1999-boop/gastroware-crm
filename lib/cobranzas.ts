import { habilesEntre } from "@/lib/habiles";

/**
 * Cobranzas del día (manual 4.4, hoja de la administrativa): vencidas,
 * vencen hoy y vencen en 48 h; estado pagó / prometió / sin respuesta.
 */

export type FacturaCobranza = {
  id: string;
  vencimiento: string | null;
  cobro_estado: string;
  promesa_fecha: string | null;
};

export function diasDeAtraso(vencimiento: string | null, hoy: string): number {
  if (!vencimiento || vencimiento >= hoy) return 0;
  return Math.round((Date.parse(hoy + "T12:00:00Z") - Date.parse(vencimiento + "T12:00:00Z")) / 86400000);
}

export function clasificarFacturas<T extends FacturaCobranza>(facturas: T[], hoy: string) {
  const r = {
    vencidas: [] as T[],
    hoy: [] as T[],
    en48: [] as T[],
    prometidas: [] as T[],
    alDia: [] as T[],
    cobradas: [] as T[],
  };
  for (const f of facturas) {
    if (f.cobro_estado === "cobrado") r.cobradas.push(f);
    else if (f.cobro_estado === "prometido" && f.promesa_fecha && f.promesa_fecha >= hoy) r.prometidas.push(f);
    else if (!f.vencimiento) r.alDia.push(f);
    else if (f.vencimiento < hoy) r.vencidas.push(f);
    else if (f.vencimiento === hoy) r.hoy.push(f);
    else if (habilesEntre(hoy, f.vencimiento) <= 2) r.en48.push(f);
    else r.alDia.push(f);
  }
  r.vencidas.sort((a, b) => (a.vencimiento ?? "").localeCompare(b.vencimiento ?? ""));
  r.en48.sort((a, b) => (a.vencimiento ?? "").localeCompare(b.vencimiento ?? ""));
  r.prometidas.sort((a, b) => (a.promesa_fecha ?? "").localeCompare(b.promesa_fecha ?? ""));
  return r;
}

/** Mensaje de reclamo para WhatsApp (tono cordial, con el dato concreto). */
export function mensajeReclamo(f: { numero: string; vencimiento: string | null; montoTexto: string }, hoy: string): string {
  const vencida = f.vencimiento && f.vencimiento < hoy;
  const fecha = f.vencimiento ? f.vencimiento.split("-").reverse().join("/") : "";
  return vencida
    ? `Hola, ¿cómo estás? Te escribo de GastroWare por la factura ${f.numero} por ${f.montoTexto}, que venció el ${fecha}. ¿Me confirmás cuándo la podés abonar? Gracias.`
    : `Hola, ¿cómo estás? Te recuerdo que la factura ${f.numero} por ${f.montoTexto} vence el ${fecha}. Cualquier cosa me avisás. Gracias.`;
}
