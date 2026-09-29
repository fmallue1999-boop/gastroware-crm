/**
 * Datos del cliente que hacen falta para cotizar (v1.9): la cotización
 * siempre va a un cliente con razón social, CUIT, dirección, localidad y
 * email. Funciones puras: las usan el formulario y el servidor.
 */

export type DatosFiscales = {
  razon_social: string | null | undefined;
  cuit: string | null | undefined;
  email: string | null | undefined;
  direccion: string | null | undefined;
  ciudad: string | null | undefined;
};

const PESOS_CUIT = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

/** CUIT/CUIL de 11 números con el dígito verificador correcto. */
export function cuitValido(cuit: string | null | undefined): boolean {
  const d = (cuit ?? "").replace(/\D/g, "");
  if (d.length !== 11) return false;
  const suma = PESOS_CUIT.reduce((s, p, i) => s + p * Number(d[i]), 0);
  let dv = 11 - (suma % 11);
  if (dv === 11) dv = 0;
  if (dv === 10) dv = 9;
  return dv === Number(d[10]);
}

/** "30719056187" → "30-71905618-7" (si no tiene 11 números, queda como está). */
export function cuitProlijo(cuit: string | null | undefined): string {
  const d = (cuit ?? "").replace(/\D/g, "");
  return d.length === 11 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}` : (cuit ?? "").trim();
}

export const emailValido = (email: string | null | undefined) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((email ?? "").trim());

/** Qué falta (o está mal) para poder cotizar, en palabras del equipo. Vacío = listo. */
export function faltanParaCotizar(d: DatosFiscales): string[] {
  const faltan: string[] = [];
  if (!d.razon_social?.trim()) faltan.push("razón social");
  if (!d.cuit?.trim()) faltan.push("CUIT");
  else if (!cuitValido(d.cuit)) faltan.push("CUIT válido");
  if (!d.direccion?.trim()) faltan.push("dirección");
  if (!d.ciudad?.trim()) faltan.push("localidad");
  if (!d.email?.trim()) faltan.push("email");
  else if (!emailValido(d.email)) faltan.push("email válido");
  return faltan;
}

/** Los datos fiscales de un cliente con sus sucursales (la dirección es la de la principal). */
export function datosFiscalesDe(cliente: {
  razon_social?: string | null;
  cuit?: string | null;
  email?: string | null;
  sucursales?: { direccion?: string | null; ciudad?: string | null; es_principal?: boolean; deleted_at?: string | null }[] | null;
}): DatosFiscales {
  const sucursales = (cliente.sucursales ?? []).filter((s) => !s.deleted_at);
  const principal = sucursales.find((s) => s.es_principal) ?? sucursales[0];
  return {
    razon_social: cliente.razon_social,
    cuit: cliente.cuit,
    email: cliente.email,
    direccion: principal?.direccion,
    ciudad: principal?.ciudad,
  };
}
