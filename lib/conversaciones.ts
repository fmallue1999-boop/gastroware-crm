/**
 * Conversaciones de las cotizaciones (v1.24): menciones con @ y quién puede
 * ver cada cotización. Funciones puras.
 */

export type Persona = { id: string; nombre: string };

/** Minúsculas y sin tildes, para comparar nombres. */
export const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

const esLetra = (ch: string | undefined) => Boolean(ch && /[\p{L}\p{N}]/u.test(ch));

/**
 * Cómo se puede mencionar a cada uno: con el nombre completo siempre y con
 * el primer nombre solo si nadie más se llama igual. Lo más largo primero.
 */
function formasDeMencionar(personas: Persona[]): { id: string; forma: string }[] {
  const primero = (n: string) => n.trim().split(/\s+/)[0] ?? "";
  const cuantos = new Map<string, number>();
  for (const p of personas) {
    const k = normalizar(primero(p.nombre));
    cuantos.set(k, (cuantos.get(k) ?? 0) + 1);
  }
  const formas: { id: string; forma: string }[] = [];
  for (const p of personas) {
    const completo = p.nombre.trim();
    if (!completo) continue;
    formas.push({ id: p.id, forma: completo });
    const pn = primero(completo);
    if (pn && pn !== completo && cuantos.get(normalizar(pn)) === 1) formas.push({ id: p.id, forma: pn });
  }
  return formas.sort((a, b) => b.forma.length - a.forma.length);
}

/** La mención que empieza en texto[i] (que es "@"), si hay. */
function mencionEn(texto: string, i: number, formas: { id: string; forma: string }[]) {
  for (const f of formas) {
    const trozo = texto.slice(i + 1, i + 1 + f.forma.length);
    if (normalizar(trozo) === normalizar(f.forma) && !esLetra(texto[i + 1 + f.forma.length])) return { id: f.id, largo: 1 + f.forma.length };
  }
  return null;
}

/** A quiénes se mencionó con @ (nombre completo o primer nombre si no se repite). */
export function detectarMenciones(texto: string, personas: Persona[]): string[] {
  const formas = formasDeMencionar(personas);
  const ids = new Set<string>();
  for (let i = 0; i < texto.length; i++) {
    if (texto[i] !== "@" || esLetra(texto[i - 1])) continue;
    const m = mencionEn(texto, i, formas);
    if (m) {
      ids.add(m.id);
      i += m.largo - 1;
    }
  }
  return [...ids];
}

/** El mensaje en partes, para resaltar las menciones. */
export function partesMensaje(texto: string, personas: Persona[]): { texto: string; mencion: boolean }[] {
  const formas = formasDeMencionar(personas);
  const partes: { texto: string; mencion: boolean }[] = [];
  let desde = 0;
  for (let i = 0; i < texto.length; i++) {
    if (texto[i] !== "@" || esLetra(texto[i - 1])) continue;
    const m = mencionEn(texto, i, formas);
    if (!m) continue;
    if (i > desde) partes.push({ texto: texto.slice(desde, i), mencion: false });
    partes.push({ texto: texto.slice(i, i + m.largo), mencion: true });
    desde = i + m.largo;
    i = desde - 1;
  }
  if (desde < texto.length) partes.push({ texto: texto.slice(desde), mencion: false });
  return partes;
}

/** Si se está escribiendo una mención justo antes del cursor: lo que va después de "@". */
export function mencionEnCurso(textoHastaCursor: string): string | null {
  const m = /(?:^|[^\p{L}\p{N}])@([\p{L}\p{N}]*(?: [\p{L}\p{N}]*)?)$/u.exec(textoHastaCursor);
  return m ? m[1] : null;
}

/** Los que coinciden con lo que se escribió después de "@". */
export function sugerirPersonas(busqueda: string, personas: Persona[]): Persona[] {
  const b = normalizar(busqueda.trim());
  if (!b) return personas;
  return personas.filter((p) => normalizar(p.nombre).split(/\s+/).some((parte) => parte.startsWith(b)) || normalizar(p.nombre).startsWith(b));
}

/**
 * Quién puede ver una cotización (igual que la base): los que ven toda la
 * operación, el vendedor del interés, y todos si el interés no tiene vendedor.
 */
export function veLaCotizacion(u: { id: string; rol: string }, comercialId: string | null): boolean {
  if (["direccion", "admin", "administrativa", "servicio"].includes(u.rol)) return true;
  if (!comercialId) return true;
  return u.id === comercialId;
}

const ZONA = "America/Argentina/Buenos_Aires";
const diaDe = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: ZONA });

/** "10:40" si es de hoy, "ayer 10:40" o "12 sept 10:40" (hora de Argentina, 24 h). */
export function cuandoMensaje(iso: string, ahora: Date = new Date()): string {
  const d = new Date(iso);
  const hora = d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: ZONA });
  if (diaDe(d) === diaDe(ahora)) return hora;
  if (diaDe(d) === diaDe(new Date(ahora.getTime() - 86400000))) return `ayer ${hora}`;
  return `${d.toLocaleDateString("es-AR", { day: "numeric", month: "short", timeZone: ZONA })} ${hora}`;
}

/** "3 mensajes", "1 mensaje". */
export const cuantosMensajes = (n: number) => `${n} ${n === 1 ? "mensaje" : "mensajes"}`;
