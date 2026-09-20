"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { cambiarEtapa, cambiarProductoInteres, setTemperatura } from "@/lib/actions";
import { ETAPAS, MOTIVOS_PERDIDA, NIVELES_INTERES } from "@/lib/constants";
import { diasDesde, dinero, fechaCorta } from "@/lib/format";
import CotizacionForm from "@/components/CotizacionForm";
import DiagnosticoForm from "@/components/DiagnosticoForm";
import ObjecionControl from "@/components/ObjecionControl";
import PlantillaCopiar from "@/components/PlantillaCopiar";
import MaterialItem from "@/components/MaterialItem";
import IAMensaje from "@/components/IAMensaje";
import { SelectorProductos, chipCls } from "@/components/InteresAgregar";
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
};
export type Guion = { id: string; nombre: string; texto: string };
export type MaterialLite = { id: string; nombre: string; tipo: string; url: string | null };

const COLOR_ETAPA: Record<string, string> = {
  nueva: "bg-celeste-soft text-sky-800",
  cotizada: "bg-amber-100 text-amber-700",
  seguimiento: "bg-cyan-100 text-cyan-700",
  espera: "bg-orange-100 text-orange-700",
};
const PUNTO_NIVEL: Record<string, string> = {
  caliente: "bg-red-500",
  tibio: "bg-amber-400",
  frio: "bg-gray-300",
};

/** Puntito de color con el nivel de interés (se usa en todas las listas). */
export function PuntoNivel({ nivel, conTexto = false }: { nivel: string | null; conTexto?: boolean }) {
  const label = NIVELES_INTERES.find((n) => n.value === nivel)?.label ?? "Sin nivel";
  return (
    <span className="inline-flex items-center gap-1 text-xs text-piedra" title={label}>
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${PUNTO_NIVEL[nivel ?? ""] ?? "bg-gray-200"}`} />
      {conTexto ? label : null}
    </span>
  );
}

/** Texto de la próxima fecha: atrasado / hoy / fecha / sin fecha. */
export function textoProximo(proximo: string | null, nota: string | null, hoy: string) {
  if (!proximo) return { texto: "Sin próxima fecha", clase: "text-piedra" };
  const n = nota ? ` · ${nota}` : "";
  if (proximo < hoy) return { texto: `Atrasado: era el ${fechaCorta(proximo)}${n}`, clase: "text-red-600 font-medium" };
  if (proximo === hoy) return { texto: `Contactar hoy${n}`, clase: "text-tinta font-medium" };
  return { texto: `Volver a contactar el ${fechaCorta(proximo)}${n}`, clase: "text-sky-800" };
}

/**
 * Un interés abierto en la ficha: qué quiere, cuánto, en qué está, cuándo
 * volver a hablarle. Botones: Cotizar · Me compró · Lista de espera · No se
 * dio · Más (nivel, producto, guiones, diagnóstico, calculadora, IA, material).
 */
export default function InteresTarjeta({
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
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [panel, setPanel] = useState<"nada" | "cotizar" | "perdida" | "mas">(abierta ? "mas" : "nada");
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
      setPanel("nada");
      router.refresh();
    });
  }

  const btn = (extra: string) =>
    `min-h-11 flex-1 rounded-xl px-2 text-[14px] font-medium disabled:opacity-50 ${extra}`;

  return (
    <div
      id={`interes-${interes.id}`}
      className={`rounded-2xl border p-3.5 ${
        enEspera ? "border-orange-200 bg-orange-50" : "border-borde bg-crema"
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <PuntoNivel nivel={interes.temperatura} />
        <p className="text-[15px] font-semibold">{nombre}</p>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${COLOR_ETAPA[interes.etapa] ?? "bg-crema-deep text-piedra"}`}>
          {etapaLabel}
        </span>
      </div>
      <p className={`mt-1 text-sm ${prox.clase}`}>{prox.texto}</p>
      <p className="text-xs text-piedra">
        {NIVELES_INTERES.find((n) => n.value === interes.temperatura)?.label ?? "Sin nivel"}
        {" · "}desde {fechaCorta(interes.created_at)}
        {interes.origen && interes.origen !== "Otro" ? ` · ${interes.origen}` : ""}
        {vigente ? ` · cotizado ${dinero(vigente.total ?? 0, vigente.moneda)}` : ""}
        {sinMovimiento > 7 ? (
          <span className="text-amber-700"> · hace {sinMovimiento} días sin movimiento</span>
        ) : null}
      </p>
      {stockTexto && (
        <p className={`mt-0.5 text-xs ${stockTexto.startsWith("Hay") ? "text-green-700" : "text-amber-700"}`}>
          {stockTexto}
        </p>
      )}

      {aviso && <p className="mt-2 text-sm font-medium text-green-700">✓ {aviso}</p>}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {panel === "perdida" ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <select
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-borde bg-white px-3 text-[15px] outline-none focus:border-tinta"
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
            className="min-h-11 rounded-xl bg-tinta px-4 text-[14px] font-medium text-white disabled:opacity-50"
          >
            Confirmar
          </button>
          <button type="button" onClick={() => setPanel("nada")} className="px-2 text-sm text-piedra underline">
            Cancelar
          </button>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setPanel(panel === "cotizar" ? "nada" : "cotizar")}
            className={btn(panel === "cotizar" ? "bg-tinta text-white" : "border border-borde bg-white text-tinta")}
          >
            Cotizar
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => correr(() => cambiarEtapa(interes.id, "ganada"), "Venta registrada")}
            className={btn("bg-green-600 text-white")}
          >
            Me compró
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              correr(
                () => cambiarEtapa(interes.id, enEspera ? "seguimiento" : "espera"),
                enEspera ? "Salió de la lista de espera" : "Pasó a lista de espera"
              )
            }
            className={btn(enEspera ? "border border-orange-300 bg-white text-orange-800" : "border border-borde bg-white text-tinta")}
          >
            {enEspera ? "Sacar de la espera" : "Lista de espera"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setPanel("perdida")}
            className={btn("border border-borde bg-white text-piedra")}
          >
            No se dio
          </button>
          <button
            type="button"
            onClick={() => setPanel(panel === "mas" ? "nada" : "mas")}
            className={btn(panel === "mas" ? "bg-tinta text-white" : "border border-borde bg-white text-piedra")}
          >
            {panel === "mas" ? "Menos" : "Más"}
          </button>
        </div>
      )}

      {panel === "cotizar" && (
        <div className="mt-3 space-y-2 rounded-2xl border border-borde bg-white p-3">
          {versiones.map((v) => (
            <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-crema px-3 py-2 text-sm">
              <span>
                <span className="font-medium">
                  Cotización N° {v.numeroCot}
                  {v.version > 1 ? ` v${v.version}` : ""}
                </span>
                {v.id === vigente?.id && (
                  <span className="ml-1.5 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    vigente
                  </span>
                )}{" "}
                · {dinero(v.total ?? 0, v.moneda)}
                {v.forma_pago ? ` · ${v.forma_pago}` : ""}
                <span className="text-piedra"> · {fechaCorta(v.created_at)}</span>
              </span>
              <span className="flex shrink-0 gap-3">
                <Link href={`/cotizacion/${v.cotizacion_id}?v=${v.version}`} className="text-sky-700 underline">
                  Imprimir
                </Link>
                {v.archivoUrl && (
                  <a href={v.archivoUrl} target="_blank" rel="noopener noreferrer" className="text-sky-700 underline">
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
      )}

      {panel === "mas" && (
        <div className="mt-3 space-y-3 rounded-2xl border border-borde bg-white p-3">
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-piedra">Cuánto le interesa</p>
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
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-piedra">Cambiar producto</p>
            <SelectorProductos productos={productos} elegidos={ids} onChange={setIds} />
            <input
              type="text"
              placeholder="…o con tus palabras"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              className="mt-1.5 min-h-11 w-full rounded-2xl border border-borde bg-white px-3 py-2 text-[15px] outline-none focus:border-tinta"
            />
            <button
              type="button"
              disabled={pending}
              onClick={() => correr(() => cambiarProductoInteres(interes.id, ids, texto), "Guardado")}
              className="mt-1.5 min-h-11 rounded-xl border border-tinta px-4 text-[14px] font-medium disabled:opacity-50"
            >
              Guardar producto
            </button>
          </div>

          {conDiagnostico && (
            <details className="group">
              <summary className="cursor-pointer list-none text-[15px] font-medium [&::-webkit-details-marker]:hidden">
                Diagnóstico {categoria === "exprimidora" ? "Zumex (cuenta de recupero)" : "GX"} ›
              </summary>
              <div className="mt-2">
                <DiagnosticoForm oportunidadId={interes.id} categoria={categoria} diagnostico={interes.diagnostico ?? {}} />
              </div>
            </details>
          )}

          {guiones.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer list-none text-[15px] font-medium [&::-webkit-details-marker]:hidden">
                Guiones para mandar ({guiones.length}) ›
              </summary>
              <div className="mt-2 space-y-2">
                {guiones.map((g) => (
                  <PlantillaCopiar key={g.id} nombre={g.nombre} texto={g.texto} telefono={telefono} />
                ))}
              </div>
            </details>
          )}

          <details className="group">
            <summary className="cursor-pointer list-none text-[15px] font-medium [&::-webkit-details-marker]:hidden">
              Objeción principal{interes.objecion_principal ? `: ${interes.objecion_principal}` : ""} ›
            </summary>
            <div className="mt-2">
              <ObjecionControl oportunidadId={interes.id} objecion={interes.objecion_principal} />
            </div>
          </details>

          <div className="flex flex-wrap gap-2">
            <Link href="/calculadora" className="min-h-11 rounded-xl border border-borde bg-white px-4 py-2.5 text-[14px] font-medium">
              Calculadora Zumex
            </Link>
            <Link href="/financiacion" className="min-h-11 rounded-xl border border-borde bg-white px-4 py-2.5 text-[14px] font-medium">
              Financiación
            </Link>
          </div>

          {iaOn && (
            <div>
              <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-piedra">
                <Sparkles className="h-3.5 w-3.5" /> Mensaje con IA
              </p>
              <IAMensaje oportunidadId={interes.id} telefono={telefono} />
            </div>
          )}

          {materiales.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer list-none text-[15px] font-medium [&::-webkit-details-marker]:hidden">
                Material para mandar ({materiales.length}) ›
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
