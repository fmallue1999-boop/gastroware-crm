"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, MessageCircle, Phone } from "lucide-react";
import {
  confirmarRepuesto,
  cotizarRepuesto,
  esperandoRepuesto,
  pedirValidacionRepuesto,
  perderRepuesto,
  saltearValidacionRepuesto,
  validarRepuesto,
} from "@/lib/actions";
import { MOTIVOS_PERDIDA } from "@/lib/constants";
import { dinero, fechaCorta, linkWhatsApp, sumarDias } from "@/lib/format";
import { nombreAccion } from "@/lib/actividad";
import { DISPONIBILIDADES, mensajeCotizacion, nombreEstadoRepuesto, textoDisponibilidad, totalRepuesto, VALIDACIONES, type Validacion } from "@/lib/repuestos";
import type { SolicitudVista } from "@/lib/servidor/repuestos";

const COLOR: Record<string, string> = {
  validacion: "bg-violeta-soft text-violeta",
  para_cotizar: "bg-ambar-soft text-ambar",
  cotizada: "bg-azul-soft text-azul",
  esperando: "bg-celeste-soft text-marino",
  ganada: "bg-verde-soft text-verde",
  perdida: "bg-crema-deep text-piedra",
};
const cls = "min-h-10 w-full rounded-xl border border-borde bg-white px-3 text-[15px] outline-none focus:border-marino";
const boton = "inline-flex min-h-10 items-center gap-1 rounded-xl border border-borde bg-white px-3 text-[14px] font-bold disabled:opacity-50";
const chip = (activo: boolean) => `min-h-9 rounded-full px-3 text-[14px] font-semibold ${activo ? "bg-marino text-white" : "border border-borde bg-white text-tinta/80"}`;

/**
 * Una solicitud de repuesto con lo que se hace en cada paso: validar (servicio
 * técnico), cotizar con el WhatsApp listo, esperar la confirmación, ganar
 * (pasa al circuito de la venta) o perder con el motivo.
 */
export default function TarjetaRepuesto({
  s,
  hoy,
  yo,
  puedeValidar,
  catalogo = [],
  validadores = [],
}: {
  s: SolicitudVista;
  hoy: string;
  yo: string;
  /** Técnico, servicio o dirección: puede validar aunque no esté asignado. */
  puedeValidar: boolean;
  catalogo?: { id: string; descripcion: string; codigo_interno: string | null; stock: number | null }[];
  validadores?: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [modo, setModo] = useState<null | "validar" | "cotizar" | "perder" | "asignar">(null);
  const [repuestoId, setRepuestoId] = useState(s.repuesto_id ?? "");
  const [codigo, setCodigo] = useState(s.codigo ?? "");
  const [nota, setNota] = useState("");
  const [precio, setPrecio] = useState(s.precio_unitario != null ? String(s.precio_unitario) : "");
  const [moneda, setMoneda] = useState<"ARS" | "USD">(s.moneda === "USD" ? "USD" : "ARS");
  const [disp, setDisp] = useState(s.disponibilidad ?? "");
  const [plazo, setPlazo] = useState(s.plazo_dias != null ? String(s.plazo_dias) : "");
  const [motivo, setMotivo] = useState<string>(MOTIVOS_PERDIDA[0]);
  const [validador, setValidador] = useState(s.validador_id ?? validadores[0]?.id ?? "");
  const [msg, setMsg] = useState<{ texto: string; error?: boolean } | null>(null);

  const total = totalRepuesto(s.precio_unitario, s.cantidad);
  const miValidacion = s.validacion === "pendiente" && (s.validador_id === yo || puedeValidar);
  const esComercial = s.comercial_id === yo || !puedeValidar || s.comercial_id == null;
  const abierta = !["ganada", "perdida"].includes(s.estado);

  function correr(fn: () => Promise<unknown>, ok: string) {
    setMsg(null);
    startTransition(async () => {
      const r = (await fn()) as { error?: string } | undefined;
      if (r?.error) setMsg({ texto: r.error, error: true });
      else {
        setModo(null);
        setMsg({ texto: ok });
        router.refresh();
      }
    });
  }

  const textoWhatsApp =
    total != null
      ? mensajeCotizacion({
          // Se saluda a la persona (su nombre de pila) y, si no hay, a la empresa
          contacto: s.contacto?.trim().split(/\s+/)[0] ?? s.cliente?.nombre_comercial ?? "",
          descripcion: s.descripcion,
          equipo: s.equipoTexto,
          cantidad: s.cantidad,
          total: dinero(total, s.moneda),
          disponibilidad: s.disponibilidad,
          plazo: s.plazo_dias,
        })
      : null;

  return (
    <div className="space-y-2 rounded-2xl bg-white p-3.5 shadow-sm">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <Link href={`/clientes/${s.cliente_id}`} className="text-[16px] font-extrabold hover:underline">
            {s.cliente?.nombre_comercial ?? "Cliente"}
          </Link>
          <p className="text-xs text-piedra">
            {fechaCorta(s.created_at)}
            {s.comercial ? ` · ${s.comercial}` : ""}
            {s.caso_id ? " · desde un caso" : s.ot_id ? " · desde un service" : ""}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${COLOR[s.estado]}`}>{nombreEstadoRepuesto(s.estado)}</span>
        {s.cliente?.telefono && (
          <div className="flex gap-1.5">
            <a href={linkWhatsApp(s.cliente.telefono)} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="flex h-10 w-10 items-center justify-center rounded-full bg-verde text-white">
              <MessageCircle className="h-4 w-4" />
            </a>
            <a href={`tel:${s.cliente.telefono}`} aria-label="Llamar" className="flex h-10 w-10 items-center justify-center rounded-full border border-borde bg-white">
              <Phone className="h-4 w-4" />
            </a>
          </div>
        )}
      </div>

      <div className="rounded-xl bg-crema px-3 py-2 text-[14px]">
        <p className="font-bold">
          {s.cantidad > 1 ? `${s.cantidad} × ` : ""}
          {s.repuesto?.descripcion ?? s.descripcion}
        </p>
        <p className="text-piedra">
          {[s.equipoTexto, s.numero_serie ? `serie ${s.numero_serie}` : null, s.codigo ? `código ${s.codigo}` : null].filter(Boolean).join(" · ") || "Sin equipo ni código"}
        </p>
        <p className="text-piedra">
          {VALIDACIONES[s.validacion as Validacion] ?? s.validacion}
          {s.validacion === "pendiente" && s.validador ? ` (le toca a ${s.validador})` : ""}
          {s.validado_por_nombre && s.validacion !== "pendiente" ? ` por ${s.validado_por_nombre}` : ""}
          {s.validacion_nota ? ` — ${s.validacion_nota}` : ""}
        </p>
        {(total != null || s.disponibilidad) && (
          <p className="font-semibold">
            {total != null ? dinero(total, s.moneda) : ""}
            {textoDisponibilidad(s.disponibilidad, s.plazo_dias) ? ` · ${textoDisponibilidad(s.disponibilidad, s.plazo_dias)}` : ""}
          </p>
        )}
        {s.fotoUrl && (
          <a href={s.fotoUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[14px] font-bold text-marino underline">
            <Camera className="h-4 w-4" /> Ver foto
          </a>
        )}
        {abierta && s.proximo_contacto && (
          <p className={s.proximo_contacto < hoy ? "font-bold text-ambar" : "text-azul"}>
            Próximo: {nombreAccion(s.proxima_accion) ?? "contactar"} {s.proximo_contacto === hoy ? "hoy" : fechaCorta(s.proximo_contacto)}
          </p>
        )}
        {s.estado === "perdida" && s.motivo_perdida && <p className="text-piedra">Motivo: {s.motivo_perdida}</p>}
        {s.estado === "ganada" && (
          <Link href="/pedidos" className="font-bold text-verde underline">
            En el circuito de la venta{s.pedido_estado ? ` (${s.pedido_estado.replace("_", " ")})` : ""}
          </Link>
        )}
      </div>

      {abierta && (
        <div className="flex flex-wrap gap-2">
          {miValidacion && (
            <button type="button" onClick={() => setModo(modo === "validar" ? null : "validar")} className="inline-flex min-h-10 items-center rounded-xl bg-violeta px-3 text-[14px] font-extrabold text-white">
              Validar
            </button>
          )}
          {s.estado === "validacion" && esComercial && (
            <>
              <button type="button" onClick={() => setModo(modo === "asignar" ? null : "asignar")} className={boton}>
                Quién valida
              </button>
              <button type="button" disabled={pending} onClick={() => correr(() => saltearValidacionRepuesto(s.oportunidad_id), "Listo para cotizar")} className={boton}>
                Ya está identificada
              </button>
            </>
          )}
          {s.estado !== "validacion" && (
            <button type="button" onClick={() => setModo(modo === "cotizar" ? null : "cotizar")} className="inline-flex min-h-10 items-center rounded-xl bg-marino px-3 text-[14px] font-extrabold text-white">
              {s.estado === "para_cotizar" ? "Cotizar" : "Cambiar cotización"}
            </button>
          )}
          {textoWhatsApp && s.cliente?.telefono && s.estado !== "para_cotizar" && (
            <a href={linkWhatsApp(s.cliente.telefono, textoWhatsApp)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-verde px-3 text-[14px] font-extrabold text-white">
              <MessageCircle className="h-4 w-4" /> Mandar cotización
            </a>
          )}
          {s.estado === "cotizada" && (
            <button type="button" disabled={pending} onClick={() => correr(() => esperandoRepuesto(s.oportunidad_id), "Esperando confirmación")} className={boton}>
              Ya se la pasé
            </button>
          )}
          {(s.estado === "cotizada" || s.estado === "esperando") && (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (window.confirm("¿Confirmó? Pasa al circuito de la venta (facturar, cobrar, preparar, entregar).")) correr(() => confirmarRepuesto(s.oportunidad_id), "Ganada: sigue en Ventas");
              }}
              className="inline-flex min-h-10 items-center rounded-xl bg-verde px-3 text-[14px] font-extrabold text-white"
            >
              Confirmó
            </button>
          )}
          <button type="button" onClick={() => setModo(modo === "perder" ? null : "perder")} className={boton}>
            No se dio
          </button>
        </div>
      )}

      {modo === "validar" && (
        <div className="space-y-2 rounded-xl border border-borde p-2.5">
          <p className="text-[15px] font-bold">¿Qué pieza es?</p>
          {catalogo.length > 0 && (
            <select value={repuestoId} onChange={(e) => setRepuestoId(e.target.value)} className={cls}>
              <option value="">No está en el catálogo</option>
              {catalogo.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.descripcion}
                  {r.codigo_interno ? ` (${r.codigo_interno})` : ""}
                  {r.stock != null ? ` · stock ${r.stock}` : ""}
                </option>
              ))}
            </select>
          )}
          <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Código de la pieza" className={cls} />
          <div className="flex flex-wrap gap-1.5">
            {DISPONIBILIDADES.map((d) => (
              <button key={d.value} type="button" onClick={() => setDisp(disp === d.value ? "" : d.value)} className={chip(disp === d.value)}>
                {d.label}
              </button>
            ))}
          </div>
          {disp && disp !== "en_stock" && <input type="number" min={0} value={plazo} onChange={(e) => setPlazo(e.target.value)} placeholder="Plazo en días" className={cls} />}
          <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota (qué verificaste)" className={cls} />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                correr(
                  () => validarRepuesto(s.oportunidad_id, { resultado: "validada", repuestoId: repuestoId || null, codigo, nota, disponibilidad: disp || null, plazoDias: plazo ? Number(plazo) : null }),
                  "Validado: le avisamos al vendedor"
                )
              }
              className="min-h-10 flex-1 rounded-xl bg-violeta text-[15px] font-bold text-white disabled:opacity-50"
            >
              Validar
            </button>
            <button
              type="button"
              disabled={pending || !nota.trim()}
              onClick={() => correr(() => validarRepuesto(s.oportunidad_id, { resultado: "no_se_pudo", nota }), "Anotado")}
              className="min-h-10 rounded-xl border border-borde px-3 text-[14px] font-bold disabled:opacity-50"
              title="Escribí en la nota por qué"
            >
              No se pudo identificar
            </button>
          </div>
        </div>
      )}

      {modo === "asignar" && (
        <div className="flex gap-2 rounded-xl border border-borde p-2.5">
          <select value={validador} onChange={(e) => setValidador(e.target.value)} className={cls}>
            {validadores.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nombre}
              </option>
            ))}
          </select>
          <button type="button" disabled={pending || !validador} onClick={() => correr(() => pedirValidacionRepuesto(s.oportunidad_id, validador), "Pedida")} className="min-h-10 rounded-xl bg-marino px-3 text-[14px] font-bold text-white">
            Pedir
          </button>
        </div>
      )}

      {modo === "cotizar" && (
        <div className="space-y-2 rounded-xl border border-borde p-2.5">
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="Precio por unidad" className={cls} />
            <select value={moneda} onChange={(e) => setMoneda(e.target.value as "ARS" | "USD")} className={cls}>
              <option value="ARS">Pesos</option>
              <option value="USD">Dólares</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DISPONIBILIDADES.map((d) => (
              <button key={d.value} type="button" onClick={() => setDisp(disp === d.value ? "" : d.value)} className={chip(disp === d.value)}>
                {d.label}
              </button>
            ))}
          </div>
          {disp && disp !== "en_stock" && <input type="number" min={0} value={plazo} onChange={(e) => setPlazo(e.target.value)} placeholder="Plazo en días" className={cls} />}
          {precio && (
            <p className="text-[14px] font-bold">
              Total: {dinero(totalRepuesto(Number(precio.replace(/\./g, "").replace(",", ".")), s.cantidad) ?? 0, moneda)} · se vuelve a contactar el {fechaCorta(sumarDias(3))}
            </p>
          )}
          <button
            type="button"
            disabled={pending || !precio.trim()}
            onClick={() =>
              correr(
                () =>
                  cotizarRepuesto(s.oportunidad_id, {
                    precioUnitario: Number(precio.replace(/\./g, "").replace(",", ".")),
                    moneda,
                    disponibilidad: disp || null,
                    plazoDias: plazo ? Number(plazo) : null,
                  }),
                "Cotizado: mandale el WhatsApp"
              )
            }
            className="min-h-10 w-full rounded-xl bg-marino text-[15px] font-bold text-white disabled:opacity-50"
          >
            Guardar cotización
          </button>
        </div>
      )}

      {modo === "perder" && (
        <div className="flex gap-2 rounded-xl border border-borde p-2.5">
          <select value={motivo} onChange={(e) => setMotivo(e.target.value)} className={cls}>
            {MOTIVOS_PERDIDA.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <button type="button" disabled={pending} onClick={() => correr(() => perderRepuesto(s.oportunidad_id, motivo), "Cerrada")} className="min-h-10 rounded-xl bg-ambar px-3 text-[14px] font-bold text-white">
            Cerrar
          </button>
        </div>
      )}

      {msg && <p className={`text-[14px] font-bold ${msg.error ? "text-red-600" : "text-verde"}`}>{msg.texto}</p>}
    </div>
  );
}
