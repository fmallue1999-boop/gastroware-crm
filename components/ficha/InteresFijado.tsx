"use client";

import { useState, useTransition } from "react";
import { nombreLinea } from "@/lib/actividad";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, FileText, Sparkles } from "lucide-react";
import { cambiarEtapa, cambiarProductoInteres, setTemperatura } from "@/lib/actions";
import { ETAPAS, MOTIVOS_PERDIDA, NIVELES_INTERES } from "@/lib/constants";
import { dinero, fechaCorta, diasDesde } from "@/lib/format";
import BotonesPdfCotizacion from "@/components/BotonesPdfCotizacion";
import DiagnosticoForm from "@/components/DiagnosticoForm";
import ObjecionControl from "@/components/ObjecionControl";
import PlantillaCopiar from "@/components/PlantillaCopiar";
import MaterialItem from "@/components/MaterialItem";
import IAMensaje from "@/components/IAMensaje";
import { SelectorProductos, chipCls } from "@/components/InteresAgregar";
import { COLOR_ETAPA, PuntoNivel, textoProximo } from "@/components/PuntoNivel";
import AsignacionInteres from "@/components/ficha/AsignacionInteres";
import { CadenciaInteres, CalificacionInteres } from "@/components/ficha/TrabajarInteres";
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
export type Guion = { id: string; nombre: string; texto: string };
export type MaterialLite = { id: string; nombre: string; tipo: string; url: string | null };

/** Un grupo desplegable dentro de "Más opciones". */
function Grupo({ titulo, children, abierto = false }: { titulo: string; children: React.ReactNode; abierto?: boolean }) {
  return (
    <details className="group border-b border-borde/70 last:border-0" open={abierto}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
        {titulo}
        <ChevronDown className="h-4 w-4 shrink-0 text-piedra transition-transform group-open:rotate-180" />
      </summary>
      <div className="pb-3">{children}</div>
    </details>
  );
}

/**
 * Un interés abierto en la pestaña Operaciones de la ficha (v1.9): qué
 * quiere, en qué está y el próximo paso; la cotización a la vista (Cotizar,
 * o Ver PDF / Compartir); Me compró / No se dio; y "Más opciones" ordenado
 * en grupos (seguimiento, producto, para mandar, herramientas).
 */
export default function InteresFijado({
  interes,
  nombre,
  productos,
  stockTexto,
  versiones,
  guiones,
  materiales,
  telefono,
  iaOn,
  abierta = false,
  hoy,
  rol = "comercial",
  miId = "",
  responsableNombre = null,
  ahoraMs = 0,
}: {
  interes: Oportunidad;
  nombre: string;
  productos: Producto[];
  stockTexto: string | null;
  versiones: VersionCot[];
  guiones: Guion[];
  materiales: MaterialLite[];
  telefono: string | null;
  iaOn: boolean;
  abierta?: boolean;
  hoy: string;
  rol?: string;
  miId?: string;
  responsableNombre?: string | null;
  ahoraMs?: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mas, setMas] = useState(false);
  const [perdida, setPerdida] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [ids, setIds] = useState<string[]>([interes.producto_id, ...(interes.productos_extra ?? [])].filter(Boolean) as string[]);
  const [texto, setTexto] = useState(interes.mensaje_inicial ?? "");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const enEspera = interes.etapa === "espera";
  const etapaLabel = ETAPAS.find((e) => e.value === interes.etapa)?.label ?? interes.etapa;
  const prox = textoProximo(interes.proximo_contacto ?? null, interes.proximo_nota ?? null, hoy, interes.proxima_accion);
  const sinMovimiento = diasDesde(interes.ultimo_movimiento_at ?? interes.created_at);
  const categoria = interes.producto?.categoria ?? "otro";
  const conDiagnostico = categoria === "exprimidora" || categoria === "licuadora";
  const vigente = versiones[0] ?? null;
  const bloqueada = vigente?.aprobacion === "pendiente" || vigente?.aprobacion === "rechazada";
  const cotizarHref = `/cotizar/${interes.id}`;

  function correr(fn: () => Promise<unknown>, textoOk: string) {
    setError(null);
    startTransition(async () => {
      const res = (await fn()) as { error?: string } | null | undefined;
      if (res && typeof res === "object" && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      setAviso(textoOk);
      setTimeout(() => setAviso(null), 2000);
      setPerdida(false);
      router.refresh();
    });
  }

  const sub = "mb-1.5 text-xs font-bold uppercase tracking-wide text-piedra";
  const botonSec = "inline-flex min-h-11 items-center rounded-xl border border-borde bg-white px-4 text-[15px] font-bold";

  return (
    <div
      id={`interes-${interes.id}`}
      className={`rounded-2xl border p-3.5 shadow-sm ${enEspera ? "border-naranja/30 bg-naranja-soft" : "border-borde bg-white"} ${abierta ? "ring-2 ring-marino/60" : ""}`}
    >
      {/* Qué quiere y en qué está */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <PuntoNivel nivel={interes.temperatura} />
        <p className="text-[17px] font-extrabold leading-tight">{nombre}</p>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${COLOR_ETAPA[interes.etapa] ?? "bg-crema-deep text-piedra"}`}>{etapaLabel}</span>
        {interes.linea && interes.linea !== "equipos" && (
          <span className="rounded-full bg-crema px-2.5 py-0.5 text-xs font-bold text-marino">{nombreLinea(interes.linea)}</span>
        )}
      </div>
      <p className={`mt-1 text-[15px] font-semibold ${prox.clase}`}>{prox.texto}</p>
      <p className="text-xs text-piedra">
        {NIVELES_INTERES.find((n) => n.value === interes.temperatura)?.label ?? "Sin nivel"} · desde {fechaCorta(interes.created_at)}
        {stockTexto ? ` · ${stockTexto}` : ""}
        {sinMovimiento > 7 ? ` · ${sinMovimiento} días sin movimiento` : ""}
      </p>
      <AsignacionInteres interes={interes} rol={rol} miId={miId} responsableNombre={responsableNombre} ahoraMs={ahoraMs} />
      {!enEspera && (
        <CadenciaInteres
          interes={interes}
          hoy={hoy}
          fechaPropuesta={vigente ? new Date(vigente.created_at).toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }) : null}
        />
      )}

      {/* La cotización, siempre a la vista */}
      <div className="mt-3 rounded-xl bg-crema p-3">
        {vigente ? (
          <div className="space-y-2">
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
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <Link href={cotizarHref} className="font-bold text-marino underline">
                {vigente.aprobacion === "rechazada" ? "Armar nueva versión" : "Nueva versión"}
              </Link>
              {versiones.length > 1 && <IrAPestana a="cotizaciones">Ver las {versiones.length} versiones</IrAPestana>}
              {vigente.archivoUrl && (
                <a href={vigente.archivoUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-marino underline">
                  PDF propio
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Link href={cotizarHref} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-marino px-5 text-[15px] font-extrabold text-white">
              <FileText className="h-4 w-4" /> Cotizar
            </Link>
            <span className="text-sm text-piedra">Sale el PDF listo para mandar, con las fichas de los productos.</span>
          </div>
        )}
      </div>

      {aviso && <p className="mt-2 text-sm font-semibold text-verde">✓ {aviso}</p>}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}

      {/* Cierre */}
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
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => correr(() => cambiarEtapa(interes.id, "ganada"), "Venta registrada")}
            className="min-h-11 flex-1 rounded-xl bg-verde text-[15px] font-extrabold text-white disabled:opacity-50"
          >
            Me compró
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setPerdida(true)}
            className="min-h-11 flex-1 rounded-xl border border-borde bg-white text-[15px] font-bold text-tinta disabled:opacity-50"
          >
            No se dio
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setMas(!mas)}
        aria-expanded={mas}
        className="mt-2 flex min-h-10 w-full items-center justify-center gap-1 text-[14px] font-bold text-piedra hover:text-tinta"
      >
        {mas ? "Menos opciones" : "Más opciones"} <ChevronDown className={`h-4 w-4 transition-transform ${mas ? "rotate-180" : ""}`} />
      </button>

      {mas && (
        <div className="mt-1 rounded-xl border border-borde bg-white px-3">
          <Grupo titulo="Seguimiento: nivel, calificación, objeción, lista de espera">
            <div className="space-y-3">
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
                <p className={sub}>Calificación (cantidad, plazo, quién decide)</p>
                <CalificacionInteres interes={interes} />
              </div>
              <div>
                <p className={sub}>Objeción principal</p>
                <ObjecionControl oportunidadId={interes.id} objecion={interes.objecion_principal} />
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => correr(() => cambiarEtapa(interes.id, enEspera ? "seguimiento" : "espera"), enEspera ? "Salió de la lista de espera" : "Pasó a lista de espera")}
                className={`min-h-11 rounded-xl px-4 text-[15px] font-bold ${enEspera ? "border border-naranja bg-white text-naranja" : "border border-borde bg-white text-tinta"} disabled:opacity-50`}
              >
                {enEspera ? "Sacar de la lista de espera" : "Poner en lista de espera (espera stock)"}
              </button>
            </div>
          </Grupo>

          <Grupo titulo={conDiagnostico ? "Producto y diagnóstico" : "Cambiar producto"}>
            <SelectorProductos productos={productos} elegidos={ids} onChange={setIds} />
            <input
              type="text"
              placeholder="…o con tus palabras"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              className="mt-1.5 min-h-11 w-full rounded-2xl border border-borde bg-white px-3 py-2 text-[15px] outline-none focus:border-marino"
            />
            <button
              type="button"
              disabled={pending}
              onClick={() => correr(() => cambiarProductoInteres(interes.id, ids, texto), "Guardado")}
              className="mt-1.5 min-h-11 rounded-xl border border-marino px-4 text-[15px] font-bold disabled:opacity-50"
            >
              Guardar producto
            </button>
            {conDiagnostico && (
              <div className="mt-3">
                <p className={sub}>Diagnóstico {categoria === "exprimidora" ? "Zumex (cuenta de recupero)" : "GX"}</p>
                <DiagnosticoForm oportunidadId={interes.id} categoria={categoria} diagnostico={interes.diagnostico ?? {}} />
              </div>
            )}
          </Grupo>

          {(guiones.length > 0 || materiales.length > 0 || iaOn) && (
            <Grupo titulo="Para mandarle: guiones, material, mensaje con IA">
              <div className="space-y-3">
                {iaOn && (
                  <div>
                    <p className={`${sub} flex items-center gap-1`}>
                      <Sparkles className="h-3.5 w-3.5" /> Mensaje con IA
                    </p>
                    <IAMensaje oportunidadId={interes.id} telefono={telefono} />
                  </div>
                )}
                {guiones.map((g) => (
                  <PlantillaCopiar key={g.id} nombre={g.nombre} texto={g.texto} telefono={telefono} />
                ))}
                {materiales.map((m) => (
                  <MaterialItem key={m.id} material={m} telefono={telefono} />
                ))}
              </div>
            </Grupo>
          )}

          <Grupo titulo="Herramientas: calculadora y financiación">
            <div className="flex flex-wrap gap-2">
              <Link href="/calculadora" className={botonSec}>
                Calculadora Zumex
              </Link>
              <Link href="/financiacion" className={botonSec}>
                Financiación
              </Link>
            </div>
          </Grupo>
        </div>
      )}
    </div>
  );
}
