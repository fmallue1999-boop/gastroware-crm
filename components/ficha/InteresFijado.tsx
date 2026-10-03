"use client";

import { useState, useTransition } from "react";
import { nombreLinea, textoActividad } from "@/lib/actividad";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, FileText, MoreHorizontal, Pencil, Sparkles, X } from "lucide-react";
import { cambiarEtapa, cambiarProductoInteres, setTemperatura } from "@/lib/actions";
import { ETAPAS, MOTIVOS_PERDIDA, NIVELES_INTERES } from "@/lib/constants";
import { dinero, fechaCorta, diasDesde } from "@/lib/format";
import BotonesPdfCotizacion from "@/components/BotonesPdfCotizacion";
import ConversacionInteres, { type ResumenCharla } from "@/components/ConversacionInteres";
import IAMensaje from "@/components/IAMensaje";
import { SelectorProductos, chipCls } from "@/components/InteresAgregar";
import { COLOR_ETAPA, PuntoNivel, textoProximo } from "@/components/PuntoNivel";
import AsignacionInteres, { PrimerContacto } from "@/components/ficha/AsignacionInteres";
import { PanelReprogramar } from "@/components/ReprogramarInteres";
import EliminarOperacion from "@/components/EliminarOperacion";
import { esGestor } from "@/lib/puestos";
import { CadenciaInteres } from "@/components/ficha/TrabajarInteres";
import { IrAPestana } from "@/components/ficha/FichaTabs";
import type { Oportunidad, Producto } from "@/lib/types";

export type VersionCot = {
  id: string;
  cotizacion_id: string;
  numeroCot: number;
  version: number;
  total: number | null;
  moneda: string;
  forma_pago: string | null;
  created_at: string;
  archivoUrl: string | null;
  aprobacion?: string;
  aprobacion_nota?: string | null;
  /** IVA que se suma en el PDF (el total es sin IVA). */
  iva_pct?: number | null;
};

/** Un movimiento del interés con quién lo hizo (v1.21). */
export type MovimientoInteres = {
  id: string;
  tipo: string;
  contenido: string | null;
  medio?: string | null;
  resultado?: string | null;
  created_at: string;
  /** Nombre de quien lo cargó; null = lo hizo el sistema. */
  autor: string | null;
  /** Con quién se habló (persona del cliente). */
  conPersona?: string | null;
};

const TIPO_MOVIMIENTO: Record<string, string> = {
  nota: "nota",
  cotizacion: "cotización",
  interes: "seguimiento",
  cambio_etapa: "etapa",
  pedido: "venta",
  feria: "feria",
};

/** "hoy 10:40", "ayer 18:02" o "12 sept". */
function cuandoCorto(iso: string) {
  const d = diasDesde(iso);
  const hora = new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Argentina/Buenos_Aires" });
  return d === 0 ? `hoy ${hora}` : d === 1 ? `ayer ${hora}` : fechaCorta(iso);
}

/**
 * Un interés abierto en la ficha (v1.21, rehecho a pedido de dirección):
 * arriba qué quiere y en qué etapa está (con el lápiz se cambian producto y
 * nivel); el recuadro del próximo paso con los botones rápidos (primer
 * contacto, no respondió, reprogramar); la cotización si hay; Cotizar / Me
 * compró / No se dio; la conversación del equipo (v1.26) y los movimientos
 * de este interés con quién los hizo.
 * Lo que se usa poco (IA, lista de espera, financiación, eliminar) va en "⋯".
 */
export default function InteresFijado({
  interes,
  nombre,
  productos,
  stockTexto,
  versiones,
  telefono,
  iaOn,
  abierta = false,
  hoy,
  rol = "comercial",
  miId = "",
  responsableNombre = null,
  ahoraMs = 0,
  movimientos = [],
  charla = null,
}: {
  interes: Oportunidad;
  nombre: string;
  productos: Producto[];
  stockTexto: string | null;
  versiones: VersionCot[];
  telefono: string | null;
  iaOn: boolean;
  abierta?: boolean;
  hoy: string;
  rol?: string;
  miId?: string;
  responsableNombre?: string | null;
  ahoraMs?: number;
  /** Lo que pasó con este interés, lo más nuevo primero. */
  movimientos?: MovimientoInteres[];
  /** La conversación del equipo de este interés (total, sin leer y el último mensaje). */
  charla?: ResumenCharla | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [panel, setPanel] = useState<null | "editar" | "mas">(null);
  const [reprogramando, setReprogramando] = useState(false);
  const [verTodos, setVerTodos] = useState(false);
  const [perdida, setPerdida] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [ids, setIds] = useState<string[]>([interes.producto_id, ...(interes.productos_extra ?? [])].filter(Boolean) as string[]);
  const [texto, setTexto] = useState(interes.mensaje_inicial ?? "");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const enEspera = interes.etapa === "espera";
  const etapaLabel = ETAPAS.find((e) => e.value === interes.etapa)?.label ?? interes.etapa;
  const prox = textoProximo(interes.proximo_contacto ?? null, interes.proximo_nota ?? null, hoy, interes.proxima_accion, interes.proximo_hora);
  const p = interes.proximo_contacto ?? null;
  const momento = !p ? "sin" : p < hoy ? "atrasado" : p === hoy ? "hoy" : "futuro";
  const sinMovimiento = diasDesde(interes.ultimo_movimiento_at ?? interes.created_at);
  const categoria = interes.producto?.categoria ?? "otro";
  const vigente = versiones[0] ?? null;
  const bloqueada = vigente?.aprobacion === "pendiente" || vigente?.aprobacion === "rechazada";
  const cotizarHref = `/cotizar/${interes.id}`;
  const sinPrimerContacto = Boolean(interes.comercial_id && !interes.primer_contacto_at && interes.asignado_at);
  const visibles = verTodos ? movimientos : movimientos.slice(0, 5);

  function correr(fn: () => Promise<unknown>, textoOk: string, despues?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = (await fn()) as { error?: string } | null | undefined;
      if (res && typeof res === "object" && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      setAviso(textoOk);
      setTimeout(() => setAviso(null), 2500);
      setPerdida(false);
      despues?.();
      router.refresh();
    });
  }

  const sub = "mb-1.5 text-xs font-bold uppercase tracking-wide text-piedra";
  const botonSec = "inline-flex min-h-11 items-center rounded-xl border border-borde bg-white px-4 text-[15px] font-bold";
  const icono = (activo: boolean) =>
    `flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${activo ? "border-marino bg-marino text-white" : "border-borde bg-white text-piedra"}`;
  const cajaProximo = {
    atrasado: "border-red-200 bg-red-50",
    hoy: "border-ambar/30 bg-ambar-soft",
    futuro: "border-borde bg-crema/60",
    sin: "border-borde bg-crema/60",
  }[momento];

  return (
    <div
      id={`interes-${interes.id}`}
      className={`rounded-2xl border p-3.5 shadow-sm ${enEspera ? "border-naranja/30 bg-naranja-soft" : "border-borde bg-white"} ${abierta ? "ring-2 ring-marino/60" : ""}`}
    >
      {/* Qué quiere, en qué etapa está y el lápiz para cambiarlo */}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <PuntoNivel nivel={interes.temperatura} />
            <p className="text-[17px] font-extrabold leading-tight">{nombre}</p>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${COLOR_ETAPA[interes.etapa] ?? "bg-crema-deep text-piedra"}`}>{etapaLabel}</span>
            {interes.linea && interes.linea !== "equipos" && (
              <span className="rounded-full bg-crema px-2.5 py-0.5 text-xs font-bold text-marino">{nombreLinea(interes.linea)}</span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-piedra">
            {NIVELES_INTERES.find((n) => n.value === interes.temperatura)?.label ?? "Sin nivel"} · desde {fechaCorta(interes.created_at)}
            {stockTexto ? ` · ${stockTexto}` : ""}
            {sinMovimiento > 7 ? ` · ${sinMovimiento} días sin movimiento` : ""}
          </p>
        </div>
        <button type="button" onClick={() => setPanel(panel === "editar" ? null : "editar")} aria-label="Cambiar producto y nivel" className={icono(panel === "editar")}>
          <Pencil className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => setPanel(panel === "mas" ? null : "mas")} aria-label="Más opciones" className={icono(panel === "mas")}>
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </div>

      {panel === "editar" && (
        <div className="mt-2 space-y-3 rounded-xl border border-borde bg-white p-3">
          <div>
            <p className={sub}>Cuánto le interesa</p>
            <div className="flex flex-wrap gap-1.5">
              {NIVELES_INTERES.map((n) => (
                <button
                  key={n.value}
                  type="button"
                  disabled={pending}
                  onClick={() => correr(() => setTemperatura(interes.id, n.value), "Guardado")}
                  className={chipCls(interes.temperatura === n.value)}
                >
                  {n.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className={sub}>Qué le interesa</p>
            <SelectorProductos productos={productos} elegidos={ids} onChange={setIds} />
            <input
              type="text"
              placeholder="…o con tus palabras"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              className="mt-1.5 min-h-11 w-full rounded-2xl border border-borde bg-white px-3 py-2 text-[15px] outline-none focus:border-marino"
            />
            <div className="mt-1.5 flex gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => correr(() => cambiarProductoInteres(interes.id, ids, texto), "Guardado", () => setPanel(null))}
                className="min-h-11 rounded-xl bg-marino px-4 text-[15px] font-bold text-white disabled:opacity-50"
              >
                Guardar
              </button>
              <button type="button" onClick={() => setPanel(null)} className={botonSec}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      <AsignacionInteres interes={interes} rol={rol} miId={miId} responsableNombre={responsableNombre} />

      {/* El próximo paso, con lo que se hace desde acá */}
      <div className={`mt-2 rounded-xl border px-3 py-2.5 ${cajaProximo}`}>
        <p className={`text-[15px] font-bold ${prox.clase}`}>{prox.texto}</p>
        {sinPrimerContacto && <PrimerContacto interes={interes} ahoraMs={ahoraMs} />}
        <CadenciaInteres
          interes={interes}
          hoy={hoy}
          fechaPropuesta={vigente ? new Date(vigente.created_at).toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }) : null}
          conNoRespondio={!enEspera}
        >
          <button
            type="button"
            onClick={() => setReprogramando(!reprogramando)}
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-3 text-[14px] font-bold ${
              reprogramando ? "border-marino bg-marino text-white" : "border-borde bg-white text-tinta"
            }`}
          >
            <CalendarClock className="h-4 w-4" /> Reprogramar
          </button>
        </CadenciaInteres>
        {reprogramando && (
          <div className="mt-2">
            <PanelReprogramar
              oportunidadId={interes.id}
              accion={interes.proxima_accion}
              onListo={(t) => {
                setAviso(t);
                setReprogramando(false);
              }}
              onCancelar={() => setReprogramando(false)}
            />
          </div>
        )}
      </div>

      {/* La cotización, si hay */}
      {vigente && (
        <div className="mt-2 space-y-2 rounded-xl bg-crema p-3">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px]">
            <FileText className="h-4 w-4 text-piedra" />
            <span className="font-bold">
              Cotización N° {vigente.numeroCot}
              {vigente.version > 1 ? ` v${vigente.version}` : ""}
            </span>
            <span>
              {dinero(vigente.total ?? 0, vigente.moneda)}
              {Number(vigente.iva_pct ?? 0) > 0 ? " + IVA" : ""}
            </span>
            <span className="text-sm text-piedra">· {fechaCorta(vigente.created_at)}</span>
            {vigente.aprobacion === "pendiente" && <span className="rounded-full bg-ambar-soft px-2 py-0.5 text-xs font-bold text-ambar">esperando aprobación</span>}
            {vigente.aprobacion === "aprobada" && <span className="rounded-full bg-verde-soft px-2 py-0.5 text-xs font-bold text-verde">aprobada</span>}
          </p>
          {vigente.aprobacion === "rechazada" && <p className="text-sm font-bold text-red-600">Dirección la rechazó: {vigente.aprobacion_nota ?? "armá una nueva versión"}</p>}
          {vigente.aprobacion === "pendiente" && <p className="text-sm text-piedra">Cuando dirección la apruebe te llega el aviso y la podés mandar.</p>}
          {!bloqueada && <BotonesPdfCotizacion cotizacionId={vigente.cotizacion_id} version={vigente.version} />}
          {(versiones.length > 1 || vigente.archivoUrl) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              {versiones.length > 1 && <IrAPestana a="cotizaciones">Ver las {versiones.length} versiones</IrAPestana>}
              {vigente.archivoUrl && (
                <a href={vigente.archivoUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-marino underline">
                  PDF propio
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {aviso && <p className="mt-2 text-sm font-semibold text-verde">✓ {aviso}</p>}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}

      {/* Cotizar, Me compró, No se dio */}
      {perdida ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <select
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-borde bg-white px-3 text-[15px] outline-none focus:border-marino"
          >
            <option value="">¿Por qué no se dio?…</option>
            {MOTIVOS_PERDIDA.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={pending || !motivo}
            onClick={() => correr(() => cambiarEtapa(interes.id, "perdida", motivo), "Marcado como no se dio")}
            className="min-h-11 rounded-xl bg-marino px-4 text-[15px] font-bold text-white disabled:opacity-50"
          >
            Confirmar
          </button>
          <button type="button" onClick={() => setPerdida(false)} className="px-2 text-sm text-piedra underline">
            Cancelar
          </button>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Link
            href={cotizarHref}
            className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-marino px-2 text-center text-[14px] font-extrabold leading-tight text-white"
          >
            <FileText className="h-4 w-4 shrink-0" /> {vigente ? "Nueva versión" : "Cotizar"}
          </Link>
          <button
            type="button"
            disabled={pending}
            onClick={() => correr(() => cambiarEtapa(interes.id, "ganada"), "Venta registrada")}
            className="min-h-11 rounded-xl bg-verde px-2 text-[14px] font-extrabold text-white disabled:opacity-50"
          >
            Me compró
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setPerdida(true)}
            className="min-h-11 rounded-xl border border-borde bg-white px-2 text-[14px] font-bold text-tinta disabled:opacity-50"
          >
            No se dio
          </button>
        </div>
      )}

      {/* La conversación del equipo (interna) */}
      <div className="mt-3">
        <ConversacionInteres oportunidadId={interes.id} resumen={charla} />
      </div>

      {/* Lo que pasó con este interés, con quién lo hizo */}
      <div className="mt-3 border-t border-borde pt-2.5">
        <p className="text-xs font-bold uppercase tracking-wide text-piedra">Movimientos{movimientos.length ? ` (${movimientos.length})` : ""}</p>
        {movimientos.length === 0 ? (
          <p className="mt-1 text-[14px] text-piedra">Todavía no hay movimientos. Anotá abajo qué hablaron.</p>
        ) : (
          <ol className="mt-1.5 space-y-2 border-l-2 border-borde pl-3">
            {visibles.map((m) => {
              const comoFue = m.medio ? textoActividad(m.medio, m.resultado) : (TIPO_MOVIMIENTO[m.tipo] ?? "movimiento");
              const repetido = m.medio && m.contenido === textoActividad(m.medio, m.resultado);
              return (
                <li key={m.id} className="min-w-0">
                  <p className="text-[13px] leading-snug">
                    <span className={`font-bold ${m.autor ? "text-tinta" : "text-piedra"}`}>{m.autor ?? "Sistema"}</span>
                    <span className="text-piedra">
                      {" "}
                      · {cuandoCorto(m.created_at)} · {comoFue}
                      {m.conPersona ? ` · con ${m.conPersona}` : ""}
                    </span>
                  </p>
                  {m.contenido && !repetido && <p className="whitespace-pre-wrap break-words text-[14px] text-tinta/85">{m.contenido}</p>}
                </li>
              );
            })}
          </ol>
        )}
        {movimientos.length > 5 && (
          <button type="button" onClick={() => setVerTodos(!verTodos)} className="mt-1.5 min-h-9 text-[14px] font-bold text-marino underline">
            {verTodos ? "Ver menos" : `Ver los ${movimientos.length} movimientos`}
          </button>
        )}
      </div>

      {/* Lo que se usa poco */}
      {panel === "mas" && (
        <div className="mt-3 space-y-3 rounded-xl border border-borde bg-white p-3">
          <div className="flex items-center justify-between">
            <p className={sub}>Más opciones</p>
            <button type="button" onClick={() => setPanel(null)} aria-label="Cerrar" className="flex h-9 w-9 items-center justify-center text-piedra">
              <X className="h-4 w-4" />
            </button>
          </div>
          {iaOn && (
            <div>
              <p className={`${sub} flex items-center gap-1`}>
                <Sparkles className="h-3.5 w-3.5" /> Mensaje con IA
              </p>
              <IAMensaje oportunidadId={interes.id} telefono={telefono} />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => correr(() => cambiarEtapa(interes.id, enEspera ? "seguimiento" : "espera"), enEspera ? "Salió de la lista de espera" : "Pasó a lista de espera")}
              className={`min-h-11 rounded-xl px-4 text-[15px] font-bold ${enEspera ? "border border-naranja bg-white text-naranja" : "border border-borde bg-white text-tinta"} disabled:opacity-50`}
            >
              {enEspera ? "Sacar de la lista de espera" : "Lista de espera (no hay stock)"}
            </button>
            {categoria === "exprimidora" && (
              <Link href="/calculadora" className={botonSec}>
                Calculadora Zumex
              </Link>
            )}
            <Link href="/financiacion" className={botonSec}>
              Financiación
            </Link>
          </div>
          {esGestor(rol) && (
            <div className="border-t border-borde pt-2">
              <EliminarOperacion oportunidadId={interes.id} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
