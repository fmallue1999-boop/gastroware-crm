"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";
import { anotarContacto, asignarConsulta, noEsDeMiTerritorio } from "@/lib/actions";
import { hoyISO } from "@/lib/format";
import { ZONAS_ENTREGA } from "@/lib/territorios";
import { transcurrido } from "@/lib/habiles";
import { veTodo } from "@/lib/puestos";

/**
 * Dónde se entrega y quién atiende la consulta (manual 1.1 paso 2). Sin
 * lugar de entrega queda "sin asignar"; el vendedor que recibe una de otro
 * territorio la pasa con "No es de mi territorio". El aviso de primer
 * contacto pendiente es PrimerContacto (v1.21: va en el recuadro del próximo paso).
 */
export default function AsignacionInteres({
  interes,
  rol,
  miId,
  responsableNombre,
}: {
  interes: {
    id: string;
    cliente_id?: string;
    zona_entrega?: string | null;
    comercial_id: string | null;
  };
  rol: string;
  miId: string;
  responsableNombre: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [cambiando, setCambiando] = useState(false);
  const [zona, setZona] = useState(interes.zona_entrega ?? "");
  const [msg, setMsg] = useState<{ texto: string; error?: boolean } | null>(null);
  const esMia = interes.comercial_id === miId;
  const puedeAsignar = veTodo(rol) || !interes.comercial_id;

  function enviar(accion: "asignar" | "no_es_mio") {
    if (!zona) return;
    setMsg(null);
    startTransition(async () => {
      const r = accion === "asignar" ? await asignarConsulta(interes.id, zona) : await noEsDeMiTerritorio(interes.id, zona);
      if (r && "error" in r && r.error) setMsg({ texto: r.error, error: true });
      else {
        setMsg({ texto: `Asignada a ${(r as { responsable?: string | null }).responsable ?? "dirección"}` });
        setCambiando(false);
        router.refresh();
      }
    });
  }

  const selector = (accion: "asignar" | "no_es_mio", boton: string) => (
    <div className="mt-1.5 flex flex-wrap gap-2">
      <select
        value={zona}
        onChange={(e) => setZona(e.target.value)}
        aria-label="Dónde se entrega"
        className="min-h-11 min-w-0 flex-1 rounded-xl border border-borde bg-white px-3 text-[15px] outline-none focus:border-marino"
      >
        <option value="">¿Dónde se entrega?…</option>
        {ZONAS_ENTREGA.map((z) => (
          <option key={z} value={z}>
            {z}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={pending || !zona}
        onClick={() => enviar(accion)}
        className="min-h-11 rounded-xl bg-marino px-4 text-[15px] font-bold text-white disabled:opacity-50"
      >
        {pending ? "…" : boton}
      </button>
    </div>
  );

  if (!interes.comercial_id)
    return (
      <div className="mt-2 rounded-xl bg-ambar-soft px-3 py-2">
        <p className="text-[14px] font-bold text-ambar">Sin asignar: falta dónde se entrega.</p>
        {selector("asignar", "Asignar")}
        {msg && <p className={`mt-1 text-[14px] font-bold ${msg.error ? "text-red-600" : "text-verde"}`}>{msg.texto}</p>}
      </div>
    );

  return (
    <div className="mt-1">
      <p className="flex flex-wrap items-center gap-x-1.5 text-[14px] text-tinta/80">
        <MapPin className="h-3.5 w-3.5 shrink-0 text-piedra" />
        {interes.zona_entrega ? `Se entrega en ${interes.zona_entrega}` : "Lugar de entrega sin cargar"} · atiende{" "}
        {esMia ? "vos" : responsableNombre ?? "—"}
        {(puedeAsignar || esMia) && !cambiando && (
          <button type="button" onClick={() => setCambiando(true)} className="font-bold text-marino underline">
            {esMia && !veTodo(rol) ? "No es de mi territorio" : "Cambiar"}
          </button>
        )}
      </p>
      {cambiando && selector(esMia && !veTodo(rol) ? "no_es_mio" : "asignar", esMia && !veTodo(rol) ? "Pasarla" : "Reasignar")}
      {msg && <p className={`mt-1 text-[14px] font-bold ${msg.error ? "text-red-600" : "text-verde"}`}>{msg.texto}</p>}
    </div>
  );
}

/**
 * Falta el primer contacto (manual 1.1: dentro de la hora). "Ya lo contacté
 * por…" lo anota y deja el próximo paso en cotizar hoy.
 */
export function PrimerContacto({
  interes,
  ahoraMs,
}: {
  interes: { id: string; cliente_id?: string; asignado_at?: string | null };
  ahoraMs: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ texto: string; error?: boolean } | null>(null);
  if (!interes.asignado_at) return null;
  const demora = ahoraMs - Date.parse(interes.asignado_at);

  function contactado(medio: string) {
    if (!interes.cliente_id) return;
    setMsg(null);
    startTransition(async () => {
      const r = await anotarContacto(interes.cliente_id!, "", hoyISO(), { oportunidadId: interes.id, medio, resultado: "conversamos", accion: "cotizar" });
      if (r && "error" in r && r.error) setMsg({ texto: r.error, error: true });
      else {
        setMsg({ texto: "Primer contacto anotado ✓" });
        router.refresh();
      }
    });
  }

  return (
    <div className="mt-1 space-y-1.5">
      <p className={`text-[13px] font-bold ${demora > 3600000 ? "text-red-600" : "text-ambar"}`}>
        Sin primer contacto · asignada {transcurrido(interes.asignado_at, ahoraMs)}
      </p>
      {interes.cliente_id && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[13px] font-semibold">Ya lo contacté por:</span>
          {[
            { medio: "whatsapp", texto: "WhatsApp" },
            { medio: "llamada", texto: "Llamada" },
            { medio: "email", texto: "Email" },
          ].map((m) => (
            <button
              key={m.medio}
              type="button"
              disabled={pending}
              onClick={() => contactado(m.medio)}
              className="min-h-9 rounded-full border border-borde bg-white px-3 text-[13px] font-bold text-tinta disabled:opacity-50"
            >
              {m.texto}
            </button>
          ))}
        </div>
      )}
      {msg && <p className={`text-[13px] font-bold ${msg.error ? "text-red-600" : "text-verde"}`}>{msg.texto}</p>}
    </div>
  );
}
