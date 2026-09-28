import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Clock, MessageCircle, Package, X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { textoMontos } from "@/lib/dinero";
import { dinero, hoyISO, linkWhatsApp } from "@/lib/format";
import {
  PERIODOS,
  PROBABILIDAD_ETAPA,
  SIN_ASIGNAR,
  calcularTablero,
  cargarDatosTablero,
  listaDe,
  rangoPeriodo,
  variacion,
  type Alerta,
  type TipoPeriodo,
} from "@/lib/tablero";
import ConPanel from "@/components/ficha/ConPanel";
import LinkContacto from "@/components/LinkContacto";
import { PuntoNivel } from "@/components/PuntoNivel";
import FiltrosTablero from "@/components/tablero/FiltrosTablero";
import Operacion from "@/components/tablero/Operacion";
import Barras from "@/components/tablero/Barras";

type Params = { p?: string; v?: string; prod?: string; ver?: string; vv?: string; c?: string; interes?: string };

const ICONO_ALERTA: Record<Alerta["tipo"], typeof Clock> = {
  atrasados: Clock,
  sin_responder: MessageCircle,
  cotizacion_caida: AlertTriangle,
  stock_espera: Package,
};

function Cambio({ actual, anterior, contra }: { actual: number; anterior: number; contra: string }) {
  const v = variacion(actual, anterior);
  if (v === null) return <span className="text-xs text-piedra">antes: {anterior} ({contra})</span>;
  if (Math.abs(v) < 0.005) return <span className="text-xs text-piedra">igual que {contra}</span>;
  const sube = v > 0;
  const Icono = sube ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-bold ${sube ? "text-verde" : "text-ambar"}`}>
      <Icono className="h-3.5 w-3.5" aria-hidden />
      {sube ? "+" : ""}
      {Math.round(v * 100)} % <span className="font-normal text-piedra">vs {contra} ({anterior})</span>
    </span>
  );
}

/** Reloj fuera del render (la regla de pureza de React no deja llamarlo adentro). */
function ahoraMs(): number {
  return Date.now();
}

const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)} %`);

/**
 * Tablero de dirección (Etapa 2): el estado del negocio en una pantalla.
 * Solo dirección y administración.
 */
export default async function TableroPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: rol } = await supabase.rpc("fn_rol");
  if (!["direccion", "admin"].includes((rol as string) ?? "")) redirect("/");

  const hoy = hoyISO();
  const ahora = ahoraMs();
  const tipo = (PERIODOS.some((p) => p.key === sp.p) ? sp.p : "mes") as TipoPeriodo;
  const per = rangoPeriodo(tipo, hoy);
  const filtro = { vendedor: sp.v || null, producto: sp.prod || null };

  const [datos, { data: prods }] = await Promise.all([
    cargarDatosTablero(supabase, per, ahora),
    supabase.from("productos").select("id, nombre").eq("activo", true).order("nombre"),
  ]);
  const t = calcularTablero(datos, per, filtro, hoy, ahora);
  const n = t.negocio;
  const vendedoresSelect = datos.usuarios
    .filter((u) => u.activo && ["comercial", "direccion", "admin"].includes(u.rol))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  // URL con los filtros actuales y cambios
  const url = (cambios: Partial<Params>) => {
    const base: Params = { p: sp.p, v: sp.v, prod: sp.prod, ver: sp.ver, vv: sp.vv, ...cambios };
    const q = new URLSearchParams();
    for (const [k, val] of Object.entries(base)) if (val) q.set(k, val);
    const s = q.toString();
    return s ? `/tablero?${s}#lista` : "/tablero";
  };
  const ver = (clave: string, vendedor?: string) => url({ ver: clave, vv: vendedor, c: undefined, interes: undefined });
  const sinLista = url({ ver: undefined, vv: undefined }).replace("#lista", "");
  const lista = sp.ver ? listaDe(sp.ver, sp.vv || null, datos, per, filtro, hoy, ahora) : null;
  const cerrarPanel = sp.ver ? url({}).replace("#lista", "") : sinLista;

  const tile = "rounded-2xl bg-white p-4 shadow-sm transition-colors hover:ring-1 hover:ring-borde";
  const tileTitulo = "text-[11px] font-bold uppercase tracking-wide text-piedra";
  const contra = per.etiquetaAnt;
  const e = t.embudo;
  const pctDe = (x: number) => (e.creados ? ` · ${Math.round((x / e.creados) * 100)} %` : "");

  return (
    <ConPanel c={sp.c} interes={sp.interes} cerrarHref={cerrarPanel}>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Tablero</h1>
          <p className="text-[15px] text-piedra">
            {per.etiqueta} · comparado con {contra}
          </p>
        </div>
        <Suspense fallback={null}>
          <FiltrosTablero periodos={PERIODOS} vendedores={vendedoresSelect} productos={(prods ?? []) as { id: string; nombre: string }[]} />
        </Suspense>

        {lista && (
          <section id="lista" className="scroll-mt-6 rounded-2xl border-2 border-marino bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-[16px] font-extrabold">
                {lista.titulo} <span className="font-semibold text-piedra">({lista.filas.length})</span>
              </h2>
              <Link href={sinLista} aria-label="Cerrar lista" className="flex h-10 w-10 items-center justify-center rounded-full border border-borde">
                <X className="h-5 w-5" />
              </Link>
            </div>
            {lista.filas.length === 0 ? (
              <p className="text-[15px] text-piedra">No hay nada en esta lista.</p>
            ) : (
              <div className="grid gap-2 lg:grid-cols-2">
                {lista.filas.slice(0, 100).map((o) => (
                  <div key={o.id} className="flex items-center gap-3 rounded-xl bg-crema px-3 py-2.5">
                    <LinkContacto id={o.cliente_id} interes={o.id} className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-[15px] font-bold hover:underline">
                        <PuntoNivel nivel={o.temperatura} />
                        <span className="truncate">{o.nombre}</span>
                      </p>
                      <p className="truncate text-sm text-tinta/80">
                        {o.interes}
                        {o.monto_estimado != null ? ` · ${dinero(o.monto_estimado, o.moneda ?? "ARS")}` : ""}
                      </p>
                      <p className="truncate text-xs text-piedra">
                        {lista.detalle(o)}
                        {o.comercial_id ? ` · ${datos.usuarios.find((u) => u.id === o.comercial_id)?.nombre ?? ""}` : " · sin vendedor"}
                      </p>
                    </LinkContacto>
                    {o.telefono && (
                      <a
                        href={linkWhatsApp(o.telefono)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`WhatsApp a ${o.nombre}`}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-verde text-white"
                      >
                        <MessageCircle className="h-5 w-5" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
            {lista.filas.length > 100 && <p className="mt-2 text-xs text-piedra">Se muestran 100 de {lista.filas.length}.</p>}
          </section>
        )}

        {/* Cómo está el negocio */}
        <section className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Link href={ver("abiertos")} className={tile}>
            <p className={tileTitulo}>Intereses abiertos</p>
            <p className="text-2xl font-extrabold tracking-tight tabular-nums">{n.abiertos}</p>
            <p className="text-sm">{Object.keys(n.montoAbierto).length ? textoMontos(n.montoAbierto) : "sin montos cotizados"}</p>
            <p className="text-xs text-piedra">
              Ponderado: {Object.keys(n.ponderado).length ? textoMontos(n.ponderado) : "—"} · {n.sinCotizar} sin cotizar
            </p>
          </Link>
          <Link href={ver("vendidos")} className={tile}>
            <p className={tileTitulo}>Vendido</p>
            <p className="text-2xl font-extrabold tracking-tight tabular-nums">{textoMontos(n.vendido)}</p>
            <p className="text-sm">
              {n.vendidos} venta{n.vendidos === 1 ? "" : "s"}
              {Object.keys(n.vendidoAnt).length ? <span className="text-piedra"> · antes {textoMontos(n.vendidoAnt)}</span> : null}
            </p>
            <Cambio actual={n.vendidos} anterior={n.vendidosAnt} contra={contra} />
          </Link>
          <Link href={ver("atrasados")} className={tile}>
            <p className={tileTitulo}>Atrasados hoy</p>
            <p className={`text-2xl font-extrabold tracking-tight tabular-nums ${n.atrasados ? "text-ambar" : "text-verde"}`}>{n.atrasados}</p>
            <p className="text-sm">
              {n.atrasados ? `repartidos en ${n.vendedoresConAtrasados} vendedor${n.vendedoresConAtrasados === 1 ? "" : "es"}` : "nadie tiene atrasados"}
            </p>
          </Link>
          <Link href={ver("nodio")} className={tile}>
            <p className={tileTitulo}>Tasa de cierre</p>
            <p className="text-2xl font-extrabold tracking-tight tabular-nums">{pct(n.tasaCierre)}</p>
            <p className="text-sm">
              {n.ganadas} vendidos · {n.perdidas} no se dieron
            </p>
            <p className="text-xs text-piedra">antes: {pct(n.tasaCierreAnt)}</p>
          </Link>
        </section>

        {/* Alertas */}
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-piedra">Alertas</h2>
          {t.alertas.length === 0 ? (
            <p className="rounded-2xl bg-white px-4 py-3 text-[15px] font-bold text-verde shadow-sm">Sin alertas.</p>
          ) : (
            <div className="grid gap-2 lg:grid-cols-2">
              {t.alertas.map((a) => {
                const Icono = ICONO_ALERTA[a.tipo];
                return (
                  <Link
                    key={`${a.tipo}-${a.vendedor ?? a.ver}`}
                    href={ver(a.ver, a.vendedor)}
                    className="flex min-h-12 items-center gap-3 rounded-2xl bg-ambar-soft px-4 py-2.5 text-[15px] text-tinta"
                  >
                    <Icono className="h-5 w-5 shrink-0 text-ambar" aria-hidden />
                    <span className="min-w-0 flex-1">{a.texto}</span>
                    <span className="text-sm font-bold text-ambar">Ver</span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Por vendedor */}
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-piedra">Por vendedor · {per.etiqueta}</h2>
          {t.vendedores.length === 0 ? (
            <p className="rounded-2xl bg-white px-4 py-3 text-[15px] text-piedra shadow-sm">Sin movimiento en este período.</p>
          ) : (
            <>
              <div className="hidden overflow-x-auto rounded-2xl bg-white shadow-sm lg:block">
                <table className="w-full text-[15px] tabular-nums">
                  <thead>
                    <tr className="border-b border-borde text-left text-[11px] uppercase tracking-wide text-piedra">
                      <th className="px-4 py-2.5">Vendedor</th>
                      <th className="px-3 py-2.5 text-right">Contactos atendidos</th>
                      <th className="px-3 py-2.5 text-right">Intereses abiertos</th>
                      <th className="px-3 py-2.5 text-right">Atrasados</th>
                      <th className="px-3 py-2.5 text-right">Quietos</th>
                      <th className="px-3 py-2.5 text-right">Cotizaciones</th>
                      <th className="px-3 py-2.5 text-right">Vendido</th>
                      <th className="px-4 py-2.5 text-right">Ventas vs antes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.vendedores.map((f) => {
                      const celda = "px-3 py-2.5 text-right";
                      const link = (clave: string, valor: number, clase = "") =>
                        valor ? (
                          <Link href={ver(clave, f.id)} className={`font-bold underline decoration-borde underline-offset-4 hover:decoration-marino ${clase}`}>
                            {valor}
                          </Link>
                        ) : (
                          <span className="text-piedra">0</span>
                        );
                      return (
                        <tr key={f.id} className="border-b border-borde/60 last:border-0">
                          <td className="px-4 py-2.5 font-bold">{f.nombre}</td>
                          <td className={celda}>
                            {f.id === SIN_ASIGNAR ? (
                              <span className="text-piedra">—</span>
                            ) : f.atendidos ? (
                              <Link href={`/movimientos?quien=${f.id}`} className="font-bold underline decoration-borde underline-offset-4 hover:decoration-marino">
                                {f.atendidos}
                              </Link>
                            ) : (
                              <span className="text-piedra">0</span>
                            )}
                            <span className="ml-1 text-xs text-piedra">({f.atendidosAnt})</span>
                          </td>
                          <td className={celda}>{link("abiertos", f.abiertos)}</td>
                          <td className={celda}>{link("atrasados", f.atrasados, "text-ambar")}</td>
                          <td className={celda}>{link("quietos", f.quietos)}</td>
                          <td className={celda}>
                            {link("cotizadas", f.cotizaciones)}
                            {Object.keys(f.cotizado).length ? <span className="block text-xs text-piedra">{textoMontos(f.cotizado)}</span> : null}
                          </td>
                          <td className={celda}>
                            {f.vendidos ? (
                              <Link href={ver("vendidos", f.id)} className="font-bold underline decoration-borde underline-offset-4 hover:decoration-marino">
                                {textoMontos(f.vendido)}
                              </Link>
                            ) : (
                              <span className="text-piedra">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <b>{f.vendidos}</b> <span className="text-piedra">vs {f.vendidosAnt}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="px-4 pb-3 text-xs text-piedra">
                  Entre paréntesis, los contactos atendidos en {contra}. Quietos: intereses sin fecha y sin movimiento hace más de 7 días.
                </p>
              </div>

              <div className="grid gap-2 lg:hidden">
                {t.vendedores.map((f) => (
                  <div key={f.id} className="rounded-2xl bg-white p-4 shadow-sm">
                    <p className="text-[16px] font-extrabold">{f.nombre}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-[15px]">
                      <Link href={ver("vendidos", f.id)} className="rounded-xl bg-verde-soft px-3 py-2">
                        <span className="block text-xs font-bold text-verde">Vendido</span>
                        <b className="tabular-nums">{f.vendidos ? textoMontos(f.vendido) : "—"}</b>
                        <span className="block text-xs text-piedra">{f.vendidos} vs {f.vendidosAnt} antes</span>
                      </Link>
                      <Link href={ver("atrasados", f.id)} className="rounded-xl bg-ambar-soft px-3 py-2">
                        <span className="block text-xs font-bold text-ambar">Atrasados</span>
                        <b className="tabular-nums">{f.atrasados}</b>
                        <span className="block text-xs text-piedra">{f.quietos} quietos</span>
                      </Link>
                      <Link href={ver("abiertos", f.id)} className="rounded-xl bg-crema px-3 py-2">
                        <span className="block text-xs font-bold text-piedra">Intereses abiertos</span>
                        <b className="tabular-nums">{f.abiertos}</b>
                      </Link>
                      <div className="rounded-xl bg-crema px-3 py-2">
                        <span className="block text-xs font-bold text-piedra">Atendidos · cotizaciones</span>
                        <b className="tabular-nums">
                          {f.id === SIN_ASIGNAR ? "—" : f.atendidos} · {f.cotizaciones}
                        </b>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        <Operacion desde={per.desde} hasta={per.hasta} hoy={hoy} />

        {/* Reportes del período */}
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wide text-piedra">Reportes · {per.etiqueta}</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            <Barras
              titulo={`De los ${e.creados} intereses que entraron`}
              vacio="No entraron intereses en este período."
              datos={
                e.creados
                  ? [
                      { nombre: "Se cotizaron", valor: e.cotizados, detalle: pctDe(e.cotizados).replace(" · ", "") },
                      { nombre: "Se vendieron", valor: e.vendidos, detalle: pctDe(e.vendidos).replace(" · ", "") },
                      { nombre: "No se dieron", valor: e.noSeDio, detalle: pctDe(e.noSeDio).replace(" · ", "") },
                      { nombre: "Siguen abiertos", valor: e.abiertos, detalle: pctDe(e.abiertos).replace(" · ", "") },
                    ]
                  : []
              }
            />
            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-[15px] font-extrabold">Cuánto tarda una venta</h3>
              {t.ciclo.ventas === 0 ? (
                <p className="text-[15px] text-piedra">No hubo ventas del embudo en este período (las ventas directas no cuentan).</p>
              ) : (
                <dl className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-azul-soft px-2 py-3">
                    <dt className="text-xs font-bold text-azul">De interés a cotización</dt>
                    <dd className="text-2xl font-extrabold tabular-nums">{t.ciclo.aCotizar ?? "—"}</dd>
                    <dd className="text-xs text-piedra">días</dd>
                  </div>
                  <div className="rounded-xl bg-violeta-soft px-2 py-3">
                    <dt className="text-xs font-bold text-violeta">De cotización a venta</dt>
                    <dd className="text-2xl font-extrabold tabular-nums">{t.ciclo.aVender ?? "—"}</dd>
                    <dd className="text-xs text-piedra">días</dd>
                  </div>
                  <div className="rounded-xl bg-verde-soft px-2 py-3">
                    <dt className="text-xs font-bold text-verde">Total</dt>
                    <dd className="text-2xl font-extrabold tabular-nums">{t.ciclo.total ?? "—"}</dd>
                    <dd className="text-xs text-piedra">días</dd>
                  </div>
                </dl>
              )}
              <p className="mt-3 text-xs text-piedra">
                Promedio de {t.ciclo.ventas} venta{t.ciclo.ventas === 1 ? "" : "s"}. Intereses nuevos: {n.nuevos} (antes {n.nuevosAnt}). Cotizaciones:{" "}
                {n.cotizaciones} (antes {n.cotizacionesAnt}).
              </p>
            </section>
            <Barras titulo="Intereses por producto" datos={t.porProducto} />
            <Barras titulo="Intereses por origen" datos={t.porOrigen} />
            <Barras titulo="Por qué no se dieron" datos={t.motivos} vacio="Ninguno marcado como “no se dio” en este período." />
            <section className="rounded-2xl bg-white p-4 text-[14px] shadow-sm">
              <h3 className="mb-2 text-[15px] font-extrabold">Cómo se pondera</h3>
              <p className="text-piedra">
                “Ponderado” multiplica el monto cotizado de cada interés abierto por su chance de cierre según la etapa:
              </p>
              <ul className="mt-2 grid grid-cols-2 gap-1 tabular-nums">
                <li>Interesado: {Math.round(PROBABILIDAD_ETAPA.nueva * 100)} %</li>
                <li>Cotizado: {Math.round(PROBABILIDAD_ETAPA.cotizada * 100)} %</li>
                <li>En seguimiento: {Math.round(PROBABILIDAD_ETAPA.seguimiento * 100)} %</li>
                <li>Lista de espera: {Math.round(PROBABILIDAD_ETAPA.espera * 100)} %</li>
              </ul>
            </section>
          </div>
        </section>
      </div>
    </ConPanel>
  );
}
