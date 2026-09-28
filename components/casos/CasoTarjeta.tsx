"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageCircle, Wrench } from "lucide-react";
import { cerrarCaso, derivarCaso, responderCaso } from "@/lib/actions";
import { PRIORIDADES_CASO, ESTADOS_OT } from "@/lib/constants";
import { fechaCorta, linkWhatsApp } from "@/lib/format";
import LinkContacto from "@/components/LinkContacto";
import AyudaCasoIA from "@/components/casos/AyudaCasoIA";

export type CasoVista = {
  id: string;
  numero: number;
  cliente_id: string;
  prioridad: string;
  descripcion: string;
  estado: string;
  created_at: string;
  primera_respuesta_at: string | null;
  cerrado_at: string | null;
  causa: string | null;
  solucion: string | null;
  ot_id: string | null;
  cliente: { nombre_comercial: string; telefono: string | null } | null;
  equipo: string | null;
  responsable: string | null;
  ot: { numero: number; estado: string } | null;
  plazo: { respuestaVencida: boolean; venceTexto: string; diasAbierto: number; cierreVencido: boolean; paradoSinTecnico: boolean };
};

const COLOR_PRIORIDAD: Record<string, string> = {
  parado: "bg-red-100 text-red-700",
  anda_mal: "bg-ambar-soft text-ambar",
  consulta: "bg-azul-soft text-azul",
};

/** Un caso: responder, derivar a servicio técnico o cerrar con causa y solución. */
export default function CasoTarjeta({ caso, iaOn = false }: { caso: CasoVista; iaOn?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [modo, setModo] = useState<null | "responder" | "derivar" | "cerrar">(null);
  const [texto, setTexto] = useState("");
  const [causa, setCausa] = useState("");
  const [solucion, setSolucion] = useState("");
  const [msg, setMsg] = useState<{ texto: string; error?: boolean } | null>(null);
  const cerrado = caso.estado === "cerrado";
  const p = caso.plazo;

  function correr(fn: () => Promise<{ error?: string } | { ok: true }>, ok: string) {
    setMsg(null);
    startTransition(async () => {
      const r = (await fn()) as { error?: string };
      if (r?.error) setMsg({ texto: r.error, error: true });
      else {
        setModo(null);
        setTexto("");
        setMsg({ texto: ok });
        router.refresh();
      }
    });
  }

  const cls = "min-h-11 w-full rounded-xl border border-borde bg-white px-3 py-2 text-[15px] outline-none focus:border-marino";
  return (
    <div className={`rounded-2xl bg-white p-3.5 shadow-sm ${cerrado ? "opacity-75" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${COLOR_PRIORIDAD[caso.prioridad] ?? ""}`}>
          {PRIORIDADES_CASO.find((x) => x.value === caso.prioridad)?.label ?? caso.prioridad}
        </span>
        <LinkContacto id={caso.cliente_id} className="min-w-0 truncate text-[16px] font-extrabold hover:underline">
          {caso.cliente?.nombre_comercial ?? "Cliente"}
        </LinkContacto>
        <span className="text-xs text-piedra">
          Caso {caso.numero} · {fechaCorta(caso.created_at)}
          {caso.responsable ? ` · ${caso.responsable}` : ""}
        </span>
      </div>
      {caso.equipo && <p className="mt-0.5 text-[14px] text-tinta/80">Equipo: {caso.equipo}</p>}
      <p className="mt-1 text-[15px]">{caso.descripcion}</p>

      {!cerrado && (
        <div className="mt-1 space-y-0.5 text-[14px] font-bold">
          {!caso.primera_respuesta_at && (
            <p className={p.respuestaVencida ? "text-red-600" : "text-ambar"}>
              {p.respuestaVencida ? "Primera respuesta vencida" : `Responder antes de ${p.venceTexto}`}
            </p>
          )}
          {p.cierreVencido && <p className="text-red-600">Lleva {p.diasAbierto} días hábiles abierto (cierre en 5)</p>}
          {p.paradoSinTecnico && <p className="text-red-600">Equipo parado sin técnico hace más de 24 h</p>}
        </div>
      )}
      {caso.ot_id && caso.ot && (
        <Link href={`/servicio/${caso.ot_id}`} className="mt-1 inline-flex items-center gap-1 text-[14px] font-bold text-marino underline">
          <Wrench className="h-4 w-4" /> Service {caso.ot.numero} · {ESTADOS_OT.find((e) => e.value === caso.ot!.estado)?.label ?? caso.ot.estado}
        </Link>
      )}
      {cerrado && (
        <p className="mt-1 text-[14px] text-tinta/80">
          Cerrado {fechaCorta(caso.cerrado_at)} · causa: {caso.causa} · solución: {caso.solucion}
        </p>
      )}

      {!cerrado &&
        (modo === "responder" || modo === "derivar" ? (
          <div className="mt-2 space-y-2">
            <textarea
              autoFocus
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={modo === "responder" ? "Qué le respondiste o qué probaron a distancia" : "Qué hay que revisar (opcional)"}
              className={`${cls} min-h-20`}
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pending || (modo === "responder" && !texto.trim())}
                onClick={() =>
                  modo === "responder"
                    ? correr(() => responderCaso(caso.id, texto), "Anotado")
                    : correr(() => derivarCaso(caso.id, texto), "Derivado: servicio técnico asigna técnico o aliado")
                }
                className="min-h-11 flex-1 rounded-xl bg-marino px-4 text-[15px] font-extrabold text-white disabled:opacity-50"
              >
                {modo === "responder" ? "Guardar" : "Derivar a servicio técnico"}
              </button>
              <button type="button" onClick={() => setModo(null)} className="min-h-11 rounded-xl border border-borde px-3 text-[15px] text-piedra">
                Cancelar
              </button>
            </div>
          </div>
        ) : modo === "cerrar" ? (
          <div className="mt-2 space-y-2">
            <input autoFocus value={causa} onChange={(e) => setCausa(e.target.value)} placeholder="Causa (qué lo provocó)" className={cls} />
            <input value={solucion} onChange={(e) => setSolucion(e.target.value)} placeholder="Solución (qué se hizo)" className={cls} />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pending || !causa.trim() || !solucion.trim()}
                onClick={() => correr(() => cerrarCaso(caso.id, { causa, solucion }), "Caso cerrado")}
                className="min-h-11 flex-1 rounded-xl bg-verde px-4 text-[15px] font-extrabold text-white disabled:opacity-50"
              >
                Cerrar caso
              </button>
              <button type="button" onClick={() => setModo(null)} className="min-h-11 rounded-xl border border-borde px-3 text-[15px] text-piedra">
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => setModo("responder")} className="min-h-11 rounded-xl bg-marino px-4 text-[15px] font-extrabold text-white">
              {caso.primera_respuesta_at ? "Anotar avance" : "Responder"}
            </button>
            {caso.estado === "abierto" && (
              <button type="button" onClick={() => setModo("derivar")} className="min-h-11 rounded-xl border border-borde bg-white px-3 text-[15px] font-bold">
                Derivar a servicio
              </button>
            )}
            <button type="button" onClick={() => setModo("cerrar")} className="min-h-11 rounded-xl border border-borde bg-white px-3 text-[15px] font-bold">
              Cerrar
            </button>
            {caso.cliente?.telefono && (
              <a
                href={linkWhatsApp(caso.cliente.telefono)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-borde bg-white px-3 text-[15px] font-bold text-verde"
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
            )}
            {iaOn && <AyudaCasoIA casoId={caso.id} telefono={caso.cliente?.telefono ?? null} />}
          </div>
        ))}
      {msg && <p className={`mt-1.5 text-[14px] font-bold ${msg.error ? "text-red-600" : "text-verde"}`}>{msg.texto}</p>}
    </div>
  );
}
