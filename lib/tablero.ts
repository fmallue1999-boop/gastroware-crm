import type { SupabaseClient } from "@supabase/supabase-js";
import { sumarPorMoneda } from "@/lib/dinero";

/**
 * Tablero de dirección (Etapa 2). Este archivo tiene dos partes: la carga de
 * datos (`cargarDatosTablero`, recibe cualquier cliente de Supabase: el de la
 * sesión o el del cron) y los cálculos (`calcularTablero` y compañía), que son
 * funciones puras y se prueban en tests/unit/tablero.test.ts.
 */

export type Montos = Record<string, number>;

/** Probabilidad de cierre por etapa, para ponderar los intereses abiertos. */
export const PROBABILIDAD_ETAPA: Record<string, number> = {
  nueva: 0.1,
  cotizada: 0.3,
  seguimiento: 0.5,
  espera: 0.7,
};
const ABIERTAS = ["nueva", "cotizada", "seguimiento", "espera"];
/** Ventas que no pasan por el embudo: no cuentan para el ciclo ni la conversión. */
const ORIGENES_DIRECTOS = ["Venta directa", "Pedido directo"];

// ---------------------------------------------------------------------------
// Fechas (todo en días "YYYY-MM-DD" de Argentina)
// ---------------------------------------------------------------------------

export function fechaAR(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

export function masDias(fecha: string, dias: number): string {
  const d = new Date(fecha + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(hasta + "T12:00:00Z") - Date.parse(desde + "T12:00:00Z")) / 86400000);
}

function primeroDeMes(anio: number, mes: number): string {
  const d = new Date(Date.UTC(anio, mes - 1, 1, 12));
  return d.toISOString().slice(0, 10);
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const nombreMes = (fecha: string) => MESES[Number(fecha.slice(5, 7)) - 1];

export type TipoPeriodo = "mes" | "mes_pasado" | "trimestre" | "anio" | "semana_pasada";

export const PERIODOS: { key: TipoPeriodo; label: string }[] = [
  { key: "mes", label: "Este mes" },
  { key: "mes_pasado", label: "Mes pasado" },
  { key: "trimestre", label: "Últimos 3 meses" },
  { key: "anio", label: "Este año" },
];

export type Periodo = {
  tipo: TipoPeriodo;
  /** Primer día incluido. */
  desde: string;
  /** Primer día NO incluido. */
  hasta: string;
  antDesde: string;
  antHasta: string;
  etiqueta: string;
  etiquetaAnt: string;
};

/**
 * Período elegido y el anterior con el que se compara. Si el período está en
 * curso, el anterior se corta "al mismo día" para que la comparación sea justa.
 */
export function rangoPeriodo(tipo: TipoPeriodo, hoy: string): Periodo {
  const anio = Number(hoy.slice(0, 4));
  const mes = Number(hoy.slice(5, 7));
  const manana = masDias(hoy, 1);
  const alMismoDia = (desde: string, hasta: string, antDesde: string) => {
    const transcurridos = Math.min(diasEntre(desde, manana), diasEntre(desde, hasta));
    const antHasta = masDias(antDesde, transcurridos);
    return antHasta < desde ? antHasta : desde;
  };

  if (tipo === "mes_pasado") {
    const desde = primeroDeMes(anio, mes - 1);
    const antDesde = primeroDeMes(anio, mes - 2);
    return {
      tipo,
      desde,
      hasta: primeroDeMes(anio, mes),
      antDesde,
      antHasta: desde,
      etiqueta: `${cap(nombreMes(desde))} ${desde.slice(0, 4)}`,
      etiquetaAnt: nombreMes(antDesde),
    };
  }
  if (tipo === "trimestre") {
    const desde = primeroDeMes(anio, mes - 2);
    const hasta = primeroDeMes(anio, mes + 1);
    const antDesde = primeroDeMes(anio, mes - 5);
    return {
      tipo,
      desde,
      hasta,
      antDesde,
      antHasta: alMismoDia(desde, hasta, antDesde),
      etiqueta: `${cap(nombreMes(desde))} a ${nombreMes(masDias(hasta, -1))}`,
      etiquetaAnt: "los 3 meses anteriores",
    };
  }
  if (tipo === "anio") {
    const desde = `${anio}-01-01`;
    const hasta = `${anio + 1}-01-01`;
    const antDesde = `${anio - 1}-01-01`;
    return {
      tipo,
      desde,
      hasta,
      antDesde,
      antHasta: alMismoDia(desde, hasta, antDesde),
      etiqueta: `Año ${anio}`,
      etiquetaAnt: `${anio - 1} al mismo día`,
    };
  }
  if (tipo === "semana_pasada") {
    const dow = new Date(hoy + "T12:00:00Z").getUTCDay();
    const lunes = masDias(hoy, -((dow + 6) % 7));
    const desde = masDias(lunes, -7);
    return {
      tipo,
      desde,
      hasta: lunes,
      antDesde: masDias(lunes, -14),
      antHasta: desde,
      etiqueta: `Semana del ${Number(desde.slice(8, 10))} de ${nombreMes(desde)}`,
      etiquetaAnt: "la semana anterior",
    };
  }
  const desde = primeroDeMes(anio, mes);
  const hasta = primeroDeMes(anio, mes + 1);
  const antDesde = primeroDeMes(anio, mes - 1);
  return {
    tipo: "mes",
    desde,
    hasta,
    antDesde,
    antHasta: alMismoDia(desde, hasta, antDesde),
    etiqueta: `${cap(nombreMes(desde))} ${anio}`,
    etiquetaAnt: `${nombreMes(antDesde)} al mismo día`,
  };
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const enRango = (iso: string | null | undefined, desde: string, hasta: string) => {
  if (!iso) return false;
  const f = fechaAR(iso);
  return f >= desde && f < hasta;
};

// ---------------------------------------------------------------------------
// Filas que se cargan de la base
// ---------------------------------------------------------------------------

export type OppFila = {
  id: string;
  cliente_id: string;
  comercial_id: string | null;
  producto_id: string | null;
  etapa: string;
  temperatura: string | null;
  origen: string | null;
  monto_estimado: number | null;
  moneda: string | null;
  motivo_perdida: string | null;
  proximo_contacto: string | null;
  proximo_nota: string | null;
  ultimo_movimiento_at: string | null;
  created_at: string;
  closed_at: string | null;
  nombre: string;
  telefono: string | null;
  producto: string | null;
  interes: string;
};

export type CotFila = {
  id: string;
  oportunidad_id: string;
  created_at: string;
  /** Última versión de la cotización. */
  total: number | null;
  moneda: string;
  vigencia_dias: number | null;
  version_at: string;
};

export type ActFila = { cliente_id: string; created_by: string; created_at: string };

export type Usuario = { id: string; nombre: string; rol: string; activo: boolean };

export type DatosTablero = {
  abiertas: OppFila[];
  /** Intereses creados o cerrados desde el inicio del período anterior. */
  recientes: OppFila[];
  cotizaciones: CotFila[];
  /** Movimientos de personas desde el inicio del período anterior. */
  actividades: ActFila[];
  /** Ids de consultas web abiertas que ya tuvieron algún movimiento de una persona. */
  webAtendidas: string[];
  stock: Record<string, { nombre: string; stock: number }>;
  usuarios: Usuario[];
};

export type Filtro = { vendedor?: string | null; producto?: string | null };
export const SIN_ASIGNAR = "sin";

// ---------------------------------------------------------------------------
// Cálculos
// ---------------------------------------------------------------------------

export type FilaVendedor = {
  id: string;
  nombre: string;
  atendidos: number;
  atendidosAnt: number;
  abiertos: number;
  atrasados: number;
  masViejo: number;
  quietos: number;
  cotizaciones: number;
  cotizado: Montos;
  vendidos: number;
  vendido: Montos;
  vendidosAnt: number;
  vendidoAnt: Montos;
};

export type Alerta = {
  tipo: "atrasados" | "sin_responder" | "cotizacion_caida" | "stock_espera";
  texto: string;
  cantidad: number;
  ver: string;
  vendedor?: string;
};

export type Embudo = { creados: number; cotizados: number; vendidos: number; noSeDio: number; abiertos: number };
export type Barra = { nombre: string; valor: number; detalle: string };

export type Tablero = {
  negocio: {
    abiertos: number;
    montoAbierto: Montos;
    ponderado: Montos;
    sinCotizar: number;
    vendidos: number;
    vendido: Montos;
    vendidosAnt: number;
    vendidoAnt: Montos;
    atrasados: number;
    vendedoresConAtrasados: number;
    ganadas: number;
    perdidas: number;
    tasaCierre: number | null;
    tasaCierreAnt: number | null;
    nuevos: number;
    nuevosAnt: number;
    cotizaciones: number;
    cotizacionesAnt: number;
  };
  vendedores: FilaVendedor[];
  alertas: Alerta[];
  embudo: Embudo;
  embudoAnt: Embudo;
  ciclo: { aCotizar: number | null; aVender: number | null; total: number | null; ventas: number };
  porProducto: Barra[];
  porOrigen: Barra[];
  motivos: Barra[];
};

const monto = (o: { monto_estimado: number | null; moneda: string | null }) => ({
  monto: o.monto_estimado,
  moneda: o.moneda ?? "ARS",
});

export function ponderar(abiertas: Pick<OppFila, "etapa" | "monto_estimado" | "moneda">[]): Montos {
  return sumarPorMoneda(
    abiertas.map((o) => ({
      monto: o.monto_estimado == null ? null : Number(o.monto_estimado) * (PROBABILIDAD_ETAPA[o.etapa] ?? 0),
      moneda: o.moneda ?? "ARS",
    }))
  );
}

export function tasa(ganadas: number, perdidas: number): number | null {
  return ganadas + perdidas > 0 ? ganadas / (ganadas + perdidas) : null;
}

/** Variación relativa (0.25 = +25 %), o null si no hay base de comparación. */
export function variacion(actual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return (actual - anterior) / anterior;
}

function aplicarFiltro<T extends { comercial_id: string | null; producto_id: string | null }>(filas: T[], f: Filtro): T[] {
  return filas.filter(
    (o) =>
      (!f.vendedor || (f.vendedor === SIN_ASIGNAR ? !o.comercial_id : o.comercial_id === f.vendedor)) &&
      (!f.producto || o.producto_id === f.producto)
  );
}

function embudoDe(creados: OppFila[], cotizadas: Set<string>): Embudo {
  const flujo = creados.filter((o) => !ORIGENES_DIRECTOS.includes(o.origen ?? ""));
  return {
    creados: flujo.length,
    cotizados: flujo.filter((o) => cotizadas.has(o.id) || ["cotizada", "seguimiento"].includes(o.etapa)).length,
    vendidos: flujo.filter((o) => o.etapa === "ganada").length,
    noSeDio: flujo.filter((o) => o.etapa === "perdida").length,
    abiertos: flujo.filter((o) => ABIERTAS.includes(o.etapa)).length,
  };
}

function barras(mapa: Map<string, { valor: number; vendidos: number }>, detalle: (v: { valor: number; vendidos: number }) => string): Barra[] {
  return Array.from(mapa.entries())
    .map(([nombre, v]) => ({ nombre, valor: v.valor, detalle: detalle(v) }))
    .sort((a, b) => b.valor - a.valor);
}

/**
 * Todo lo que muestra el tablero (y el resumen semanal), a partir de los
 * datos cargados, el período, el filtro y el día de hoy. `ahora` en ms, para
 * la regla de "más de 24 horas".
 */
export function calcularTablero(datos: DatosTablero, per: Periodo, filtro: Filtro, hoy: string, ahora: number): Tablero {
  const abiertas = aplicarFiltro(datos.abiertas, filtro);
  const recientes = aplicarFiltro(datos.recientes, filtro);
  const oppPorId = new Map<string, OppFila>();
  for (const o of [...datos.abiertas, ...datos.recientes]) oppPorId.set(o.id, o);
  const cotizaciones = datos.cotizaciones.filter((c) => {
    const o = oppPorId.get(c.oportunidad_id);
    return o ? aplicarFiltro([o], filtro).length > 0 : !filtro.vendedor && !filtro.producto;
  });
  const actividades = datos.actividades.filter(
    (a) => !filtro.vendedor || (filtro.vendedor !== SIN_ASIGNAR && a.created_by === filtro.vendedor)
  );

  const cerradasEn = (desde: string, hasta: string, etapa: string) =>
    recientes.filter((o) => o.etapa === etapa && enRango(o.closed_at, desde, hasta));
  const vendidas = cerradasEn(per.desde, per.hasta, "ganada");
  const vendidasAnt = cerradasEn(per.antDesde, per.antHasta, "ganada");
  const perdidas = cerradasEn(per.desde, per.hasta, "perdida");
  const perdidasAnt = cerradasEn(per.antDesde, per.antHasta, "perdida");
  const creados = recientes.filter((o) => enRango(o.created_at, per.desde, per.hasta));
  const creadosAnt = recientes.filter((o) => enRango(o.created_at, per.antDesde, per.antHasta));
  const cotsEn = (desde: string, hasta: string) => cotizaciones.filter((c) => enRango(c.created_at, desde, hasta));
  const cots = cotsEn(per.desde, per.hasta);
  const cotsAnt = cotsEn(per.antDesde, per.antHasta);
  const cotizadasAlgunaVez = new Set(datos.cotizaciones.map((c) => c.oportunidad_id));

  const atrasadas = abiertas.filter((o) => o.proximo_contacto && o.proximo_contacto < hoy);
  const quietas = abiertas.filter(
    (o) => !o.proximo_contacto && (!o.ultimo_movimiento_at || fechaAR(o.ultimo_movimiento_at) < masDias(hoy, -7))
  );

  // ---- Por vendedor ----
  const nombres = new Map(datos.usuarios.map((u) => [u.id, u.nombre]));
  const fila = (id: string): FilaVendedor => ({
    id,
    nombre: id === SIN_ASIGNAR ? "Sin asignar" : (nombres.get(id) ?? "Usuario"),
    atendidos: 0,
    atendidosAnt: 0,
    abiertos: 0,
    atrasados: 0,
    masViejo: 0,
    quietos: 0,
    cotizaciones: 0,
    cotizado: {},
    vendidos: 0,
    vendido: {},
    vendidosAnt: 0,
    vendidoAnt: {},
  });
  const filas = new Map<string, FilaVendedor>();
  const de = (id: string | null) => {
    const k = id ?? SIN_ASIGNAR;
    if (!filas.has(k)) filas.set(k, fila(k));
    return filas.get(k)!;
  };
  for (const o of abiertas) de(o.comercial_id).abiertos++;
  for (const o of atrasadas) {
    const f = de(o.comercial_id);
    f.atrasados++;
    f.masViejo = Math.max(f.masViejo, diasEntre(o.proximo_contacto!, hoy));
  }
  for (const o of quietas) de(o.comercial_id).quietos++;
  const sumar = (m: Montos, o: { monto: number | null; moneda: string }) => {
    if (o.monto == null) return;
    m[o.moneda] = (m[o.moneda] ?? 0) + Number(o.monto);
  };
  for (const c of cots) {
    const f = de(oppPorId.get(c.oportunidad_id)?.comercial_id ?? null);
    f.cotizaciones++;
    sumar(f.cotizado, { monto: c.total, moneda: c.moneda });
  }
  for (const o of vendidas) {
    const f = de(o.comercial_id);
    f.vendidos++;
    sumar(f.vendido, monto(o));
  }
  for (const o of vendidasAnt) {
    const f = de(o.comercial_id);
    f.vendidosAnt++;
    sumar(f.vendidoAnt, monto(o));
  }
  const clientesPor = (desde: string, hasta: string) => {
    const m = new Map<string, Set<string>>();
    for (const a of actividades) {
      if (!enRango(a.created_at, desde, hasta)) continue;
      if (!m.has(a.created_by)) m.set(a.created_by, new Set());
      m.get(a.created_by)!.add(a.cliente_id);
    }
    return m;
  };
  const atend = clientesPor(per.desde, per.hasta);
  const atendAnt = clientesPor(per.antDesde, per.antHasta);
  const vendedoresActivos = datos.usuarios.filter((u) => u.activo && ["comercial", "direccion", "admin"].includes(u.rol));
  for (const u of vendedoresActivos) {
    if (filtro.vendedor && filtro.vendedor !== u.id) continue;
    const n = atend.get(u.id)?.size ?? 0;
    const nAnt = atendAnt.get(u.id)?.size ?? 0;
    if (n || nAnt || filas.has(u.id)) {
      const f = de(u.id);
      f.atendidos = n;
      f.atendidosAnt = nAnt;
    }
  }
  const vendedores = Array.from(filas.values())
    .filter((f) => f.atendidos + f.abiertos + f.vendidos + f.vendidosAnt + f.cotizaciones > 0)
    .sort((a, b) => {
      if (a.id === SIN_ASIGNAR) return 1;
      if (b.id === SIN_ASIGNAR) return -1;
      return b.vendidos - a.vendidos || b.abiertos - a.abiertos || a.nombre.localeCompare(b.nombre);
    });

  // ---- Alertas ----
  const alertas: Alerta[] = [];
  for (const f of vendedores.filter((v) => v.atrasados > 0).sort((a, b) => b.atrasados - a.atrasados)) {
    alertas.push({
      tipo: "atrasados",
      texto:
        f.id === SIN_ASIGNAR
          ? `${f.atrasados} interés${f.atrasados > 1 ? "es" : ""} sin vendedor con fecha pasada`
          : `${f.nombre} tiene ${f.atrasados} atrasado${f.atrasados > 1 ? "s" : ""} (el más viejo, hace ${f.masViejo} día${f.masViejo === 1 ? "" : "s"})`,
      cantidad: f.atrasados,
      ver: "atrasados",
      vendedor: f.id,
    });
  }
  const atendidasWeb = new Set(datos.webAtendidas);
  const sinResponder = abiertas.filter(
    (o) => o.origen === "Web" && o.etapa === "nueva" && ahora - Date.parse(o.created_at) > 86400000 && !atendidasWeb.has(o.id)
  );
  if (sinResponder.length)
    alertas.push({
      tipo: "sin_responder",
      texto: `${sinResponder.length} consulta${sinResponder.length > 1 ? "s" : ""} web sin responder hace más de 24 horas`,
      cantidad: sinResponder.length,
      ver: "sinresponder",
    });
  const caidas = cotizacionesCaidas(abiertas, datos.cotizaciones, hoy);
  if (caidas.length)
    alertas.push({
      tipo: "cotizacion_caida",
      texto: `${caidas.length} cotización${caidas.length > 1 ? "es" : ""} vencida${caidas.length > 1 ? "s" : ""} sin seguimiento`,
      cantidad: caidas.length,
      ver: "caidas",
    });
  const esperando = new Map<string, number>();
  for (const o of abiertas)
    if (o.etapa === "espera" && o.producto_id && (datos.stock[o.producto_id]?.stock ?? 0) > 0)
      esperando.set(o.producto_id, (esperando.get(o.producto_id) ?? 0) + 1);
  for (const [pid, n] of esperando)
    alertas.push({
      tipo: "stock_espera",
      texto: `Hay ${datos.stock[pid].stock} ${datos.stock[pid].nombre} en stock y ${n} ${n > 1 ? "esperan" : "espera"}`,
      cantidad: n,
      ver: `espera:${pid}`,
    });

  // ---- Reportes del período ----
  const ventasCiclo = vendidas.filter((o) => !ORIGENES_DIRECTOS.includes(o.origen ?? "") && o.closed_at);
  const primeraCot = new Map<string, string>();
  for (const c of datos.cotizaciones) {
    const previa = primeraCot.get(c.oportunidad_id);
    if (!previa || c.created_at < previa) primeraCot.set(c.oportunidad_id, c.created_at);
  }
  const promedio = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null);
  const conCot = ventasCiclo.filter((o) => primeraCot.has(o.id));
  const ciclo = {
    aCotizar: promedio(conCot.map((o) => diasEntre(fechaAR(o.created_at), fechaAR(primeraCot.get(o.id)!)))),
    aVender: promedio(conCot.map((o) => diasEntre(fechaAR(primeraCot.get(o.id)!), fechaAR(o.closed_at!)))),
    total: promedio(ventasCiclo.map((o) => diasEntre(fechaAR(o.created_at), fechaAR(o.closed_at!)))),
    ventas: ventasCiclo.length,
  };

  const agrupar = (clave: (o: OppFila) => string) => {
    const m = new Map<string, { valor: number; vendidos: number }>();
    for (const o of creados) {
      const k = clave(o) || "Sin dato";
      const v = m.get(k) ?? { valor: 0, vendidos: 0 };
      v.valor++;
      m.set(k, v);
    }
    for (const o of vendidas) {
      const k = clave(o) || "Sin dato";
      const v = m.get(k) ?? { valor: 0, vendidos: 0 };
      v.vendidos++;
      m.set(k, v);
    }
    return m;
  };
  const detalleVentas = (v: { valor: number; vendidos: number }) =>
    `${v.vendidos} venta${v.vendidos === 1 ? "" : "s"}`;
  const porProducto = barras(agrupar((o) => o.producto ?? "Otro (sin producto del catálogo)"), detalleVentas);
  const porOrigen = barras(agrupar((o) => o.origen ?? "Sin dato"), detalleVentas);
  const motivosMap = new Map<string, { valor: number; vendidos: number }>();
  for (const o of perdidas) {
    const k = o.motivo_perdida || "Sin motivo";
    const v = motivosMap.get(k) ?? { valor: 0, vendidos: 0 };
    v.valor++;
    motivosMap.set(k, v);
  }
  const motivos = barras(motivosMap, () => "");

  const montoAbierto = sumarPorMoneda(abiertas.map(monto));
  return {
    negocio: {
      abiertos: abiertas.length,
      montoAbierto,
      ponderado: ponderar(abiertas),
      sinCotizar: abiertas.filter((o) => o.monto_estimado == null).length,
      vendidos: vendidas.length,
      vendido: sumarPorMoneda(vendidas.map(monto)),
      vendidosAnt: vendidasAnt.length,
      vendidoAnt: sumarPorMoneda(vendidasAnt.map(monto)),
      atrasados: atrasadas.length,
      vendedoresConAtrasados: vendedores.filter((v) => v.atrasados > 0).length,
      ganadas: vendidas.length,
      perdidas: perdidas.length,
      tasaCierre: tasa(vendidas.length, perdidas.length),
      tasaCierreAnt: tasa(vendidasAnt.length, perdidasAnt.length),
      nuevos: creados.length,
      nuevosAnt: creadosAnt.length,
      cotizaciones: cots.length,
      cotizacionesAnt: cotsAnt.length,
    },
    vendedores,
    alertas,
    embudo: embudoDe(creados, cotizadasAlgunaVez),
    embudoAnt: embudoDe(creadosAnt, cotizadasAlgunaVez),
    ciclo,
    porProducto,
    porOrigen,
    motivos,
  };
}

/** Intereses cotizados cuya última cotización venció y no tuvieron movimiento después. */
export function cotizacionesCaidas(abiertas: OppFila[], cotizaciones: CotFila[], hoy: string): OppFila[] {
  const ultima = new Map<string, CotFila>();
  for (const c of cotizaciones) {
    const previa = ultima.get(c.oportunidad_id);
    if (!previa || c.version_at > previa.version_at) ultima.set(c.oportunidad_id, c);
  }
  return abiertas.filter((o) => {
    if (!["cotizada", "seguimiento"].includes(o.etapa)) return false;
    const c = ultima.get(o.id);
    if (!c || !c.vigencia_dias) return false;
    const vence = masDias(fechaAR(c.version_at), c.vigencia_dias);
    if (vence >= hoy) return false;
    return !o.ultimo_movimiento_at || fechaAR(o.ultimo_movimiento_at) <= vence;
  });
}

/** Lista para "tocás un número y ves los contactos". */
export function listaDe(
  ver: string,
  vendedor: string | null,
  datos: DatosTablero,
  per: Periodo,
  filtro: Filtro,
  hoy: string,
  ahora: number
): { titulo: string; filas: OppFila[]; detalle: (o: OppFila) => string } {
  const f: Filtro = { ...filtro, vendedor: vendedor ?? filtro.vendedor ?? null };
  const abiertas = aplicarFiltro(datos.abiertas, f);
  const recientes = aplicarFiltro(datos.recientes, f);
  const nombre = f.vendedor === SIN_ASIGNAR ? "sin vendedor" : f.vendedor ? `de ${datos.usuarios.find((u) => u.id === f.vendedor)?.nombre ?? "vendedor"}` : "";
  const proximo = (o: OppFila) => (o.proximo_contacto ? `volver el ${o.proximo_contacto.slice(8, 10)}/${o.proximo_contacto.slice(5, 7)}` : "sin fecha");

  if (ver === "atrasados")
    return {
      titulo: `Atrasados ${nombre}`,
      filas: abiertas
        .filter((o) => o.proximo_contacto && o.proximo_contacto < hoy)
        .sort((a, b) => a.proximo_contacto!.localeCompare(b.proximo_contacto!)),
      detalle: (o) => `hace ${diasEntre(o.proximo_contacto!, hoy)} días${o.proximo_nota ? ` · ${o.proximo_nota}` : ""}`,
    };
  if (ver === "quietos")
    return {
      titulo: `Sin fecha y sin movimiento ${nombre}`,
      filas: abiertas.filter(
        (o) => !o.proximo_contacto && (!o.ultimo_movimiento_at || fechaAR(o.ultimo_movimiento_at) < masDias(hoy, -7))
      ),
      detalle: (o) => (o.ultimo_movimiento_at ? `último movimiento hace ${diasEntre(fechaAR(o.ultimo_movimiento_at), hoy)} días` : "sin movimientos"),
    };
  if (ver === "vendidos")
    return {
      titulo: `Ventas ${nombre} · ${per.etiqueta}`,
      filas: recientes.filter((o) => o.etapa === "ganada" && enRango(o.closed_at, per.desde, per.hasta)),
      detalle: (o) => `vendido el ${fechaAR(o.closed_at!).slice(8, 10)}/${fechaAR(o.closed_at!).slice(5, 7)}`,
    };
  if (ver === "nodio")
    return {
      titulo: `No se dieron ${nombre} · ${per.etiqueta}`,
      filas: recientes.filter((o) => o.etapa === "perdida" && enRango(o.closed_at, per.desde, per.hasta)),
      detalle: (o) => o.motivo_perdida ?? "sin motivo",
    };
  if (ver === "cotizadas") {
    const ids = new Set(datos.cotizaciones.filter((c) => enRango(c.created_at, per.desde, per.hasta)).map((c) => c.oportunidad_id));
    return {
      titulo: `Cotizados ${nombre} · ${per.etiqueta}`,
      filas: [...abiertas, ...recientes].filter((o, i, arr) => ids.has(o.id) && arr.findIndex((x) => x.id === o.id) === i),
      detalle: proximo,
    };
  }
  if (ver === "sinresponder") {
    const atendidas = new Set(datos.webAtendidas);
    return {
      titulo: "Consultas web sin responder hace más de 24 horas",
      filas: abiertas.filter(
        (o) => o.origen === "Web" && o.etapa === "nueva" && ahora - Date.parse(o.created_at) > 86400000 && !atendidas.has(o.id)
      ),
      detalle: (o) => `entró el ${fechaAR(o.created_at).slice(8, 10)}/${fechaAR(o.created_at).slice(5, 7)}`,
    };
  }
  if (ver === "caidas")
    return { titulo: "Cotizaciones vencidas sin seguimiento", filas: cotizacionesCaidas(abiertas, datos.cotizaciones, hoy), detalle: proximo };
  if (ver.startsWith("espera:")) {
    const pid = ver.slice(7);
    return {
      titulo: `Esperan ${datos.stock[pid]?.nombre ?? "el producto"} (hay stock)`,
      filas: abiertas.filter((o) => o.etapa === "espera" && o.producto_id === pid),
      detalle: proximo,
    };
  }
  return { titulo: `Intereses abiertos ${nombre}`, filas: abiertas, detalle: proximo };
}

// ---------------------------------------------------------------------------
// Carga
// ---------------------------------------------------------------------------

type FilaCruda = Omit<OppFila, "nombre" | "telefono" | "producto" | "interes"> & {
  mensaje_inicial: string | null;
  cliente: { nombre_comercial: string; telefono: string | null } | null;
  prod: { nombre: string } | null;
};

const SELECT_OPP =
  "id, cliente_id, comercial_id, producto_id, etapa, temperatura, origen, monto_estimado, moneda, motivo_perdida, proximo_contacto, proximo_nota, ultimo_movimiento_at, created_at, closed_at, mensaje_inicial, prod:productos(nombre), cliente:clientes!inner(nombre_comercial, telefono, deleted_at)";

function aOpp(f: FilaCruda): OppFila {
  return {
    id: f.id,
    cliente_id: f.cliente_id,
    comercial_id: f.comercial_id,
    producto_id: f.producto_id,
    etapa: f.etapa,
    temperatura: f.temperatura,
    origen: f.origen,
    monto_estimado: f.monto_estimado == null ? null : Number(f.monto_estimado),
    moneda: f.moneda,
    motivo_perdida: f.motivo_perdida,
    proximo_contacto: f.proximo_contacto,
    proximo_nota: f.proximo_nota,
    ultimo_movimiento_at: f.ultimo_movimiento_at,
    created_at: f.created_at,
    closed_at: f.closed_at,
    nombre: f.cliente?.nombre_comercial ?? "Contacto",
    telefono: f.cliente?.telefono ?? null,
    producto: f.prod?.nombre ?? null,
    interes: f.prod?.nombre ?? f.mensaje_inicial ?? "Interés",
  };
}

/** Pagina de a 1000 (PostgREST corta ahí aunque se pida más). */
async function todas<T>(arma: (desde: number, hasta: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>, tope = 20000): Promise<T[]> {
  const out: T[] = [];
  for (let desde = 0; desde < tope; desde += 1000) {
    const { data, error } = await arma(desde, desde + 999);
    if (error) throw new Error(error.message);
    const pagina = (data ?? []) as T[];
    out.push(...pagina);
    if (pagina.length < 1000) break;
  }
  return out;
}

/**
 * Carga lo necesario para el tablero desde el inicio del período anterior.
 * Con la sesión del usuario respeta los permisos de la base; el cron usa la
 * service key.
 */
export async function cargarDatosTablero(db: SupabaseClient, per: Periodo, ahora: number): Promise<DatosTablero> {
  const desdeTs = `${per.antDesde}T00:00:00-03:00`;
  const [abiertasCrudas, recientesCrudas, cotsCrudas, actividades, productos, usuarios] = await Promise.all([
    todas<FilaCruda>((a, b) =>
      db.from("oportunidades").select(SELECT_OPP).in("etapa", ABIERTAS).is("cliente.deleted_at", null).order("id").range(a, b)
    ),
    todas<FilaCruda>((a, b) =>
      db
        .from("oportunidades")
        .select(SELECT_OPP)
        .or(`created_at.gte.${desdeTs},closed_at.gte.${desdeTs}`)
        .is("cliente.deleted_at", null)
        .order("id")
        .range(a, b)
    ),
    todas<{
      id: string;
      oportunidad_id: string;
      created_at: string;
      versiones: { total: number | null; moneda: string; version: number; vigencia_dias: number | null; created_at: string }[] | null;
    }>((a, b) =>
      db
        .from("cotizaciones")
        .select("id, oportunidad_id, created_at, versiones:cotizacion_versiones(total, moneda, version, vigencia_dias, created_at)")
        .order("id")
        .range(a, b)
    ),
    todas<ActFila>((a, b) =>
      db
        .from("actividades")
        .select("cliente_id, created_by, created_at")
        .not("created_by", "is", null)
        .gte("created_at", desdeTs)
        .order("id")
        .range(a, b)
    ),
    db.from("productos").select("id, nombre, stock").gt("stock", 0),
    db.from("usuarios").select("id, nombre, rol, activo"),
  ]);

  const abiertas = abiertasCrudas.map(aOpp);
  const cotizaciones: CotFila[] = cotsCrudas.flatMap((c) => {
    const vs = [...(c.versiones ?? [])].sort((x, y) => y.version - x.version);
    const v = vs[0];
    if (!v) return [];
    return [
      {
        id: c.id,
        oportunidad_id: c.oportunidad_id,
        created_at: c.created_at,
        total: v.total == null ? null : Number(v.total),
        moneda: v.moneda ?? "ARS",
        vigencia_dias: v.vigencia_dias,
        version_at: v.created_at,
      },
    ];
  });

  // Consultas web abiertas de más de 24 h: ¿alguna persona las tocó?
  const candidatas = abiertas
    .filter((o) => o.origen === "Web" && o.etapa === "nueva" && ahora - Date.parse(o.created_at) > 86400000)
    .map((o) => o.id);
  const webAtendidas: string[] = [];
  for (let i = 0; i < candidatas.length; i += 200) {
    const { data } = await db
      .from("actividades")
      .select("oportunidad_id")
      .in("oportunidad_id", candidatas.slice(i, i + 200))
      .not("created_by", "is", null);
    for (const a of (data ?? []) as { oportunidad_id: string }[]) webAtendidas.push(a.oportunidad_id);
  }

  const stock: Record<string, { nombre: string; stock: number }> = {};
  for (const p of (productos.data ?? []) as { id: string; nombre: string; stock: number }[]) stock[p.id] = { nombre: p.nombre, stock: p.stock };

  return {
    abiertas,
    recientes: recientesCrudas.map(aOpp),
    cotizaciones,
    actividades,
    webAtendidas,
    stock,
    usuarios: (usuarios.data ?? []) as Usuario[],
  };
}
