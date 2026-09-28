"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Sparkles } from "lucide-react";
import { cambiarEtapa, cambiarProductoInteres, setTemperatura } from "@/lib/actions";
import { ETAPAS, MOTIVOS_PERDIDA, NIVELES_INTERES } from "@/lib/constants";
import { dinero, fechaCorta, diasDesde } from "@/lib/format";
import CotizacionForm from "@/components/CotizacionForm";
import DiagnosticoForm from "@/components/DiagnosticoForm";
import ObjecionControl from "@/components/ObjecionControl";
import PlantillaCopiar from "@/components/PlantillaCopiar";
import MaterialItem from "@/components/MaterialItem";
import IAMensaje from "@/components/IAMensaje";
import { SelectorProductos, chipCls } from "@/components/InteresAgregar";
import { COLOR_ETAPA, PuntoNivel, textoProximo } from "@/components/PuntoNivel";
import AsignacionInteres from "@/components/ficha/AsignacionInteres";
import { CadenciaInteres, CalificacionInteres } from "@/components/ficha/TrabajarInteres";
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
};
export type Guion = { id: string; nombre: string; texto: string };
export type MaterialLite = { id: string; nombre: string; tipo: string; url: string | null };

/**
 * Un interés abierto, fijo arriba del chat de la ficha: qué quiere, cuánto,
 * en qué está y cuándo volver a hablarle. Dos botones (Me compró / No se
 * dio) y "Más" para cotizar, lista de espera, nivel, producto, diagnóstico,
 * guiones, objeción, IA y material.
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
  const [mas, setMas] = useState(abierta);
  const [perdida, setPerdida] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [ids, setIds] = useState<string[]>(
    [interes.producto_id, ...(interes.productos_extra ?? [])].filter(Boolean) as string[]
  );
  const [texto, setTexto] = useState(interes.mensaje_inicial ?? "");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const enEspera = interes.etapa === "espera";
  const etapaLabel = ETAPAS.find((e) => e.value === interes.etapa)?.label ?? interes.etapa;
  const prox = textoProximo(interes.proximo_contacto ?? null, interes.proximo_nota ?? null, hoy);
  const sinMovimiento = diasDesde(interes.ultimo_movimiento_at ?? interes.created_at);
  const categoria = interes.producto?.categoria ?? "otro";
  const conDiagnostico = categoria === "exprimidora" || categoria === "licuadora";
  const vigente = versiones[0] ?? null;

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
  const resumen = "flex min-h-10 cursor-pointer list-none items-center justify-between text-[15px] font-semibold [&::-webkit-details-marker]:hidden";

  return (
    <div id={`interes-${interes.id}`} className={`rounded-2xl p-3.5 ${enEspera ? "bg-naranja-soft" : "bg-azul-soft"}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <PuntoNivel nivel={interes.temperatura} />
        <p className="text-[16px] font-extrabold">{nombre}</p>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${COLOR_ETAPA[interes.etapa] ?? "bg-crema-deep text-piedra"}`}>
          {etapaLabel}
        </span>
      </div>
      <p className={`mt-0.5 text-[15px] ${prox.clase}`}>{prox.texto}</p>
      <p className="text-xs text-piedra">
        {NIVELES_INTERES.find((n) => n.value === interes.temperatura)?.label ?? "Sin nivel"} · desde{" "}
        {fechaCorta(interes.created_at)}
        {vigente ? ` · cotizado ${dinero(vigente.total ?? 0, vigente.moneda)}` : ""}
        {stockTexto ? ` · ${stockTexto}` : ""}
        {sinMovimiento > 7 ? ` · ${sinMovimiento} días sin movimiento` : ""}
      </p>
      <AsignacionInteres interes={interes} rol={rol} miId={miId} responsableNombre={responsableNombre} ahoraMs={ahoraMs} />
      {!enEspera && (
        <CadenciaInteres
          interes={interes}
          hoy={hoy}
          fechaPropuesta={
            vigente ? new Date(vigente.created_at).toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }) : null
          }
        />
      )}

      {aviso && <p className="mt-2 text-sm font-semibold text-verde">✓ {aviso}</p>}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}

      {perdida ? (
        <div className="mt-2.5 flex flex-wrap gap-2">
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
        <div className="mt-2.5 flex gap-2">
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
          <button
            type="button"
            onClick={() => setMas(!mas)}
            aria-expanded={mas}
            className={`inline-flex min-h-11 items-center gap-1 rounded-xl px-3 text-[15px] font-bold ${
              mas ? "bg-marino text-white" : "border border-borde bg-white text-tinta"
            }`}
          >
            Más <ChevronDown className={`h-4 w-4 transition-transform ${mas ? "rotate-180" : ""}`} />
          </button>
        </div>
      )}

      {mas && (
        <div className="mt-3 space-y-3 rounded-2xl bg-white p-3">
          <details className="group" open={abierta}>
            <summary className={resumen}>
              Cotizar {versiones.length ? `(${versiones.length} hechas)` : ""}
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-2 space-y-2">
              {versiones.map((v) => (
                <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-crema px-3 py-2 text-sm">
                  <span>
                    <span className="font-semibold">
                      Cotización N° {v.numeroCot}
                      {v.version > 1 ? ` v${v.version}` : ""}
                    </span>
                    {v.id === vigente?.id && (
                      <span className="ml-1.5 rounded-full bg-verde-soft px-2 py-0.5 text-xs font-bold text-verde">vigente</span>
                    )}{" "}
                    · {dinero(v.total ?? 0, v.moneda)}
                    {v.forma_pago ? ` · ${v.forma_pago}` : ""}
                    <span className="text-piedra"> · {fechaCorta(v.created_at)}</span>
                    {v.aprobacion === "pendiente" && (
                      <span className="ml-1.5 rounded-full bg-ambar-soft px-2 py-0.5 text-xs font-bold text-ambar">esperando aprobación</span>
                    )}
                    {v.aprobacion === "aprobada" && (
                      <span className="ml-1.5 rounded-full bg-verde-soft px-2 py-0.5 text-xs font-bold text-verde">aprobada</span>
                    )}
                    {v.aprobacion === "rechazada" && (
                      <span className="ml-1.5 block text-xs font-bold text-red-600">Rechazada: {v.aprobacion_nota}</span>
                    )}
                  </span>
                  <span className="flex shrink-0 gap-3">
                    {v.aprobacion !== "pendiente" && v.aprobacion !== "rechazada" && (
                      <Link href={`/cotizacion/${v.cotizacion_id}?v=${v.version}`} className="text-azul underline">
                        Imprimir
                      </Link>
                    )}
                    {v.archivoUrl && (
                      <a href={v.archivoUrl} target="_blank" rel="noopener noreferrer" className="text-azul underline">
                        PDF
                      </a>
                    )}
                  </span>
                </div>
              ))}
              <CotizacionForm
                oportunidadId={interes.id}
                monedaDefault={interes.producto?.moneda ?? "ARS"}
                productos={productos}
                advertencia={null}
              />
            </div>
          </details>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                correr(
                  () => cambiarEtapa(interes.id, enEspera ? "seguimiento" : "espera"),
                  enEspera ? "Salió de la lista de espera" : "Pasó a lista de espera"
                )
              }
              className={`min-h-11 rounded-xl px-4 text-[15px] font-bold ${
                enEspera ? "border border-naranja bg-white text-naranja" : "border border-borde bg-white text-tinta"
              } disabled:opacity-50`}
            >
              {enEspera ? "Sacar de la lista de espera" : "Poner en lista de espera"}
            </button>
            <Link href="/calculadora" className="min-h-11 rounded-xl border border-borde bg-white px-4 py-2.5 text-[15px] font-bold">
              Calculadora Zumex
            </Link>
            <Link href="/financiacion" className="min-h-11 rounded-xl border border-borde bg-white px-4 py-2.5 text-[15px] font-bold">
              Financiación
            </Link>
          </div>

          <details className="group">
            <summary className={resumen}>
              Calificación{interes.cantidad || interes.plazo_compra || interes.decisor ? " ✓" : " (cantidad, plazo, quién decide)"}
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-2">
              <CalificacionInteres interes={interes} />
            </div>
          </details>

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

          <details className="group">
            <summary className={resumen}>
              Cambiar producto
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-2">
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
            </div>
          </details>

          {conDiagnostico && (
            <details className="group">
              <summary className={resumen}>
                Diagnóstico {categoria === "exprimidora" ? "Zumex (cuenta de recupero)" : "GX"}
                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-2">
                <DiagnosticoForm oportunidadId={interes.id} categoria={categoria} diagnostico={interes.diagnostico ?? {}} />
              </div>
            </details>
          )}

          {guiones.length > 0 && (
            <details className="group">
              <summary className={resumen}>
                Guiones para mandar ({guiones.length})
                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-2 space-y-2">
                {guiones.map((g) => (
                  <PlantillaCopiar key={g.id} nombre={g.nombre} texto={g.texto} telefono={telefono} />
                ))}
              </div>
            </details>
          )}

          <details className="group">
            <summary className={resumen}>
              Objeción principal{interes.objecion_principal ? `: ${interes.objecion_principal}` : ""}
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-2">
              <ObjecionControl oportunidadId={interes.id} objecion={interes.objecion_principal} />
            </div>
          </details>

          {iaOn && (
            <div>
              <p className={`${sub} flex items-center gap-1`}>
                <Sparkles className="h-3.5 w-3.5" /> Mensaje con IA
              </p>
              <IAMensaje oportunidadId={interes.id} telefono={telefono} />
            </div>
          )}

          {materiales.length > 0 && (
            <details className="group">
              <summary className={resumen}>
                Material para mandar ({materiales.length})
                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-2 space-y-2">
                {materiales.map((m) => (
                  <MaterialItem key={m.id} material={m} telefono={telefono} />
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
