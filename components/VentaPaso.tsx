"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, PlayCircle } from "lucide-react";
import {
  aprobarCondicion,
  cargarFactura,
  despacharVenta,
  entregarVenta,
  facturarVenta,
  informarVenta,
  prepararVenta,
  registrarCobro,
} from "@/lib/actions";
import { FORMAS_PAGO_VENTA, RELEVAMIENTO_INSTALACION, VENTA_PASOS } from "@/lib/constants";
import { dinero, fechaCorta, sumarDias } from "@/lib/format";
import { esGestor, factura as puedeFacturar } from "@/lib/puestos";
import { pasoDe } from "@/lib/ventas";
import type { PedidoEstado } from "@/lib/types";

const inputCls =
  "min-h-11 w-full rounded-xl border border-borde bg-white px-3 py-2 text-[15px] outline-none focus:border-marino";
const btn =
  "inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-marino px-3 text-[15px] font-extrabold text-white disabled:opacity-50";
const btnSec =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-borde bg-white px-3 text-[15px] font-bold text-piedra";

export type VentaDatos = {
  id: string;
  cliente_id: string;
  pedido_estado: PedidoEstado | null;
  forma_pago?: string | null;
  direccion_entrega?: string | null;
  lleva_instalacion?: boolean;
  relevamiento?: Record<string, string> | null;
  remito_nro?: string | null;
  prioridad_despacho?: number | null;
  transporte?: string | null;
  nro_seguimiento?: string | null;
  nro_factura?: string | null;
  monto_estimado?: number | null;
  moneda?: string;
  entrega_estimada?: string | null;
  sucursal_id?: string | null;
  entregado_at?: string | null;
};

export type FacturaDatos = {
  id: string;
  numero: string;
  vencimiento: string | null;
  monto: number | null;
  moneda: string;
  cobro_estado: string;
  promesa_fecha: string | null;
  condicion_aprobada_at: string | null;
};

const TRANSPORTES = ["Flete propio", "Transporte / expreso", "Correo", "Lo lleva el técnico", "Retira el cliente"];
const COBRO_TEXTO: Record<string, string> = {
  pendiente: "cobro pendiente",
  prometido: "prometió pagar",
  sin_respuesta: "reclamada sin respuesta",
  cobrado: "cobrada",
};

/**
 * El circuito de la venta según el manual: el vendedor informa → la
 * administrativa factura → cobro (o condición de dirección) → preparar →
 * despachar → entregado. Cada puesto ve solo el botón que le toca.
 */
export default function VentaPaso({
  venta,
  rol,
  hoy,
  factura = null,
  pedirSerie = false,
  videoUrl = null,
  sucursales = [],
  direccionSugerida = "",
  compacto = false,
}: {
  venta: VentaDatos;
  rol: string;
  hoy: string;
  factura?: FacturaDatos | null;
  pedirSerie?: boolean;
  videoUrl?: string | null;
  sucursales?: { id: string; nombre: string; razon_social?: string | null }[];
  direccionSugerida?: string;
  compacto?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState<null | "informar" | "facturar" | "cobro" | "condicion" | "remito" | "despachar">(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; alerta: boolean } | null>(null);

  const estado = venta.pedido_estado ?? "comprometido";
  const idx = pasoDe(estado);
  const informada = Boolean(venta.forma_pago);
  const administra = puedeFacturar(rol);
  const gestor = esGestor(rol);

  // --- formularios ---
  const [formaPago, setFormaPago] = useState(venta.forma_pago ?? "");
  const [direccion, setDireccion] = useState(venta.direccion_entrega ?? direccionSugerida);
  const [sucursalId, setSucursalId] = useState(venta.sucursal_id ?? "");
  const [instalacion, setInstalacion] = useState(Boolean(venta.lleva_instalacion));
  const [relev, setRelev] = useState<Record<string, string>>(venta.relevamiento ?? {});
  const [entrega, setEntrega] = useState(venta.entrega_estimada ?? "");
  const [numero, setNumero] = useState(venta.nro_factura ?? "");
  const [fecha, setFecha] = useState(hoy);
  const [vence, setVence] = useState(/cuenta corriente/i.test(venta.forma_pago ?? "") ? sumarDias(30, hoy) : hoy);
  const [monto, setMonto] = useState(venta.monto_estimado != null ? String(venta.monto_estimado) : "");
  const [moneda, setMoneda] = useState(venta.moneda ?? "ARS");
  const [serie, setSerie] = useState("");
  const [motivo, setMotivo] = useState("");
  const [remito, setRemito] = useState(venta.remito_nro ?? "");
  const [urgente, setUrgente] = useState(venta.prioridad_despacho === 1);
  const [transporte, setTransporte] = useState(venta.transporte ?? "");
  const [seguimiento, setSeguimiento] = useState(venta.nro_seguimiento ?? "");
  const [videos, setVideos] = useState(false);

  function correr(fn: () => Promise<{ error?: string; aviso?: string } | { ok: true; aviso?: string } | undefined>, ok: string) {
    setError(null);
    startTransition(async () => {
      const res = (await fn()) as { error?: string; aviso?: string } | undefined;
      if (res?.error) {
        setError(res.error);
        return;
      }
      setAbierto(null);
      setAviso({ texto: res?.aviso ?? ok, alerta: Boolean(res?.aviso) });
      setTimeout(() => setAviso(null), res?.aviso ? 8000 : 2500);
      router.refresh();
    });
  }

  const conRazon = sucursales.filter((s) => s.razon_social);

  const formInformar = (
    <form
      className="mt-2 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        correr(
          () =>
            informarVenta(venta.id, {
              formaPago,
              direccionEntrega: direccion,
              sucursalId: sucursalId || null,
              llevaInstalacion: instalacion,
              relevamiento: relev,
              entregaEstimada: entrega || null,
            }),
          "Listo: administración ya la tiene para facturar"
        );
      }}
    >
      <select required value={formaPago} onChange={(e) => setFormaPago(e.target.value)} className={inputCls}>
        <option value="">Forma de pago…</option>
        {FORMAS_PAGO_VENTA.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>
      <input
        required
        value={direccion}
        onChange={(e) => setDireccion(e.target.value)}
        placeholder="¿Dónde se entrega? (dirección, localidad o “retira en el local”)"
        className={inputCls}
      />
      {conRazon.length > 0 && (
        <select value={sucursalId} onChange={(e) => setSucursalId(e.target.value)} className={inputCls}>
          <option value="">Facturar a la razón social del contacto</option>
          {conRazon.map((s) => (
            <option key={s.id} value={s.id}>
              Facturar a {s.razon_social} ({s.nombre})
            </option>
          ))}
        </select>
      )}
      <label className="flex items-center gap-2 text-[15px] text-tinta">
        <span className="shrink-0 text-piedra">Entrega estimada</span>
        <input type="date" value={entrega} onChange={(e) => setEntrega(e.target.value)} className={inputCls} />
      </label>
      <label className="flex min-h-11 items-center gap-2 text-[15px] font-bold">
        <input type="checkbox" checked={instalacion} onChange={(e) => setInstalacion(e.target.checked)} className="h-5 w-5" />
        Lleva instalación
      </label>
      {instalacion && (
        <div className="space-y-2 rounded-xl bg-crema p-2.5">
          <p className="text-xs font-bold uppercase tracking-wide text-piedra">Relevamiento del lugar (sin esto no se programa)</p>
          {RELEVAMIENTO_INSTALACION.map((r) => (
            <input
              key={r.key}
              required
              value={relev[r.key] ?? ""}
              onChange={(e) => setRelev({ ...relev, [r.key]: e.target.value })}
              placeholder={r.label}
              className={inputCls}
            />
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={btn}>
          {pending ? "Guardando…" : "Pasar a administración"}
        </button>
        <button type="button" onClick={() => setAbierto(null)} className={btnSec}>
          Cancelar
        </button>
      </div>
    </form>
  );

  const formFacturar = (
    <form
      className="mt-2 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        const m = monto.trim() ? Number(monto.replace(/\./g, "").replace(",", ".")) : null;
        if (estado === "facturado") {
          correr(
            () =>
              cargarFactura({
                clienteId: venta.cliente_id,
                oportunidadId: venta.id,
                tipo: "venta",
                numero,
                fecha,
                vencimiento: vence,
                monto: m,
                moneda,
                sucursalId: venta.sucursal_id ?? null,
              }),
            "Factura cargada en Cobranzas"
          );
          return;
        }
        correr(
          () => facturarVenta(venta.id, { numero, fecha, vencimiento: vence, monto: m, moneda, serie }),
          "Facturada. Falta el cobro para preparar."
        );
      }}
    >
      <input required autoFocus value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="N° de factura (ej: A 0001-00001234)" className={inputCls} />
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-piedra">
          Fecha
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} />
        </label>
        <label className="text-xs text-piedra">
          Vence
          <input type="date" value={vence} onChange={(e) => setVence(e.target.value)} className={inputCls} />
        </label>
      </div>
      <div className="flex gap-2">
        <input inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="Monto" className={inputCls} />
        <select value={moneda} onChange={(e) => setMoneda(e.target.value)} className={`${inputCls} w-24`}>
          <option value="ARS">$</option>
          <option value="USD">USD</option>
        </select>
      </div>
      {pedirSerie && estado === "comprometido" && (
        <input required value={serie} onChange={(e) => setSerie(e.target.value)} placeholder="N° de serie del equipo vendido" className={inputCls} />
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={btn}>
          {pending ? "Guardando…" : "Guardar factura"}
        </button>
        <button type="button" onClick={() => setAbierto(null)} className={btnSec}>
          Cancelar
        </button>
      </div>
    </form>
  );

  let cuerpo: React.ReactNode = null;

  if (estado === "comprometido") {
    cuerpo = !informada ? (
      <>
        <p className="text-[15px] font-bold text-ambar">Faltan los datos de la venta para facturar.</p>
        {abierto === "informar" ? (
          formInformar
        ) : (
          <button type="button" onClick={() => setAbierto("informar")} className={`${btn} mt-2`}>
            Completar datos de la venta <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </>
    ) : (
      <>
        <p className="text-[14px] text-tinta/80">
          Pago: {venta.forma_pago} · Entrega: {venta.direccion_entrega}
          {venta.lleva_instalacion ? " · con instalación" : ""}
        </p>
        {abierto === "informar" ? (
          formInformar
        ) : abierto === "facturar" ? (
          formFacturar
        ) : administra ? (
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => setAbierto("facturar")} className={btn}>
              Cargar factura <ArrowRight className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setAbierto("informar")} className={btnSec}>
              Datos
            </button>
          </div>
        ) : (
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="text-[14px] font-bold text-piedra">Esperando que administración facture.</p>
            <button type="button" onClick={() => setAbierto("informar")} className="text-[14px] font-bold text-marino underline">
              Corregir datos
            </button>
          </div>
        )}
      </>
    );
  } else if (estado === "facturado") {
    const cobrada = factura?.cobro_estado === "cobrado" || Boolean(factura?.condicion_aprobada_at);
    cuerpo = (
      <>
        <p className="text-[14px] text-tinta/80">
          Factura {factura?.numero ?? venta.nro_factura ?? "—"}
          {factura?.vencimiento ? ` · vence ${fechaCorta(factura.vencimiento)}` : ""}
          {factura?.monto != null ? ` · ${dinero(factura.monto, factura.moneda)}` : ""}
          {factura ? ` · ${COBRO_TEXTO[factura.cobro_estado] ?? factura.cobro_estado}` : ""}
          {factura?.promesa_fecha && factura.cobro_estado === "prometido" ? ` (${fechaCorta(factura.promesa_fecha)})` : ""}
        </p>
        {!factura && administra ? (
          abierto === "facturar" ? (
            formFacturar
          ) : (
            <button type="button" onClick={() => setAbierto("facturar")} className={`${btn} mt-2`}>
              Cargar la factura en Cobranzas
            </button>
          )
        ) : abierto === "condicion" ? (
          <form
            className="mt-2 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (factura) correr(() => aprobarCondicion(factura.id, motivo), "Condición aprobada: pasa a preparar");
            }}
          >
            <textarea
              required
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Condición aprobada (ej: paga con e-cheq a 30 días, cliente de años)"
              className={`${inputCls} min-h-20`}
            />
            <div className="flex gap-2">
              <button type="submit" disabled={pending} className={btn}>
                Aprobar y pasar a preparar
              </button>
              <button type="button" onClick={() => setAbierto(null)} className={btnSec}>
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {administra && factura && !cobrada && (
              <button
                type="button"
                disabled={pending}
                onClick={() => correr(() => registrarCobro(factura.id), "Cobro registrado: pasa a preparar")}
                className={`${btn} flex-1`}
              >
                <Check className="h-4 w-4" /> Cobro acreditado
              </button>
            )}
            {gestor && factura && !cobrada && (
              <button type="button" onClick={() => setAbierto("condicion")} className={btnSec}>
                Aprobar sin cobro
              </button>
            )}
            {!administra && !gestor && (
              <p className="text-[14px] font-bold text-piedra">Esperando el cobro. Nada se prepara sin cobro.</p>
            )}
          </div>
        )}
      </>
    );
  } else if (estado === "preparar_envio") {
    const prepara = administra || rol === "servicio";
    cuerpo = (
      <>
        <p className="text-[14px] text-tinta/80">
          {venta.remito_nro ? `Remito ${venta.remito_nro}` : "Sin remito todavía"}
          {venta.prioridad_despacho === 1 ? " · urgente" : ""}
          {venta.direccion_entrega ? ` · entrega: ${venta.direccion_entrega}` : ""}
        </p>
        {abierto === "remito" ? (
          <form
            className="mt-2 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              correr(() => prepararVenta(venta.id, { remito, prioridad: urgente ? 1 : null }), "Remito guardado");
            }}
          >
            <input required value={remito} onChange={(e) => setRemito(e.target.value)} placeholder="N° de remito" className={inputCls} />
            <label className="flex min-h-11 items-center gap-2 text-[15px] font-bold">
              <input type="checkbox" checked={urgente} onChange={(e) => setUrgente(e.target.checked)} className="h-5 w-5" />
              Urgente: sale hoy
            </label>
            <div className="flex gap-2">
              <button type="submit" disabled={pending} className={btn}>
                Guardar
              </button>
              <button type="button" onClick={() => setAbierto(null)} className={btnSec}>
                Cancelar
              </button>
            </div>
          </form>
        ) : abierto === "despachar" ? (
          <form
            className="mt-2 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              correr(
                () => despacharVenta(venta.id, { transporte, seguimiento, videosEnviados: videos, remito }),
                "Despachado. Se avisó al vendedor."
              );
            }}
          >
            {!venta.remito_nro && (
              <input required value={remito} onChange={(e) => setRemito(e.target.value)} placeholder="N° de remito" className={inputCls} />
            )}
            <select required value={transporte} onChange={(e) => setTransporte(e.target.value)} className={inputCls}>
              <option value="">¿Cómo sale?</option>
              {TRANSPORTES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input value={seguimiento} onChange={(e) => setSeguimiento(e.target.value)} placeholder="N° de guía o seguimiento (si tiene)" className={inputCls} />
            <label className="flex min-h-11 items-center gap-2 text-[15px] font-bold">
              <input type="checkbox" checked={videos} onChange={(e) => setVideos(e.target.checked)} className="h-5 w-5" />
              Le mandé los videos del modelo
            </label>
            {videoUrl ? (
              <a href={videoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[14px] font-bold text-marino underline">
                <PlayCircle className="h-4 w-4" /> Video instructivo del modelo
              </a>
            ) : (
              <p className="text-xs text-piedra">Este modelo todavía no tiene video cargado (lo carga marketing).</p>
            )}
            <div className="flex gap-2">
              <button type="submit" disabled={pending} className={btn}>
                Despachar
              </button>
              <button type="button" onClick={() => setAbierto(null)} className={btnSec}>
                Cancelar
              </button>
            </div>
          </form>
        ) : prepara ? (
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => setAbierto("despachar")} className={`${btn} flex-1`}>
              Despachar <ArrowRight className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setAbierto("remito")} className={btnSec}>
              Remito
            </button>
          </div>
        ) : (
          <p className="mt-1 text-[14px] font-bold text-piedra">
            {rol === "tecnico" ? "Prepararlo en el depósito; administración lo despacha." : "En preparación en el depósito."}
          </p>
        )}
      </>
    );
  } else if (estado === "despachado") {
    cuerpo = (
      <>
        <p className="text-[14px] text-tinta/80">
          Despachado{venta.transporte ? ` · ${venta.transporte}` : ""}
          {venta.nro_seguimiento ? ` · seguimiento ${venta.nro_seguimiento}` : ""}
        </p>
        {rol !== "tecnico" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => correr(() => entregarVenta(venta.id), "Entregado. Postventa agendada.")}
            className={`${btn} mt-2`}
          >
            {pending ? "Guardando…" : "Confirmar entrega"} <Check className="h-4 w-4" />
          </button>
        )}
      </>
    );
  } else {
    cuerpo = (
      <p className="text-[14px] font-bold text-verde">✓ Entregado{venta.entregado_at ? ` el ${fechaCorta(venta.entregado_at)}` : ""}</p>
    );
  }

  return (
    <div className={compacto ? "" : "rounded-2xl border border-borde bg-white p-3.5 shadow-sm"}>
      {!compacto && (
        <div className="mb-2 flex flex-wrap gap-1">
          {VENTA_PASOS.map((p, i) => (
            <span
              key={p.key}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                i < idx ? "bg-verde-soft text-verde" : i === idx ? "bg-marino text-white" : "border border-borde text-piedra"
              }`}
            >
              {i < idx && <Check className="h-3 w-3" />}
              {p.label}
            </span>
          ))}
        </div>
      )}
      {cuerpo}
      {aviso && (
        <p className={`mt-1.5 text-[14px] font-bold ${aviso.alerta ? "text-ambar" : "text-verde"}`}>
          {aviso.alerta ? "" : "✓ "}
          {aviso.texto}
        </p>
      )}
      {error && <p className="mt-1.5 text-[14px] font-bold text-red-600">{error}</p>}
    </div>
  );
}
