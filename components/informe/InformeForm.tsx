"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { enviarInforme, iaBorradorInforme, responderInforme } from "@/lib/actions";

const cls = "w-full rounded-xl border border-borde bg-white px-3 py-2 text-[15px] outline-none focus:border-marino";

/** El vendedor agrega lo que el CRM no sabe: bloqueos, decisiones que necesita y la agenda. */
export function InformeForm({
  inicial,
  enviado,
  iaOn = false,
}: {
  inicial: { bloqueos: string; decisiones: string; agenda: string };
  enviado: boolean;
  iaOn?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pensando, startIA] = useTransition();
  const [f, setF] = useState(inicial);
  const [msg, setMsg] = useState<{ texto: string; error?: boolean } | null>(null);

  function guardar(enviar: boolean) {
    setMsg(null);
    startTransition(async () => {
      const r = await enviarInforme({ ...f, enviar });
      if (r && "error" in r && r.error) setMsg({ texto: r.error, error: true });
      else {
        setMsg({ texto: enviar ? "Enviado a dirección" : "Borrador guardado" });
        router.refresh();
      }
    });
  }

  function borradorIA() {
    const lleno = f.bloqueos.trim() || f.decisiones.trim() || f.agenda.trim();
    if (lleno && !window.confirm("La IA va a reemplazar lo que escribiste. ¿Seguimos?")) return;
    setMsg(null);
    startIA(async () => {
      const r = await iaBorradorInforme();
      if (r && "datos" in r && r.datos) {
        setF(r.datos);
        setMsg({ texto: "Borrador listo: revisalo, corregí lo que haga falta y envialo." });
      } else setMsg({ texto: (r as { error?: string })?.error ?? "No se pudo armar", error: true });
    });
  }

  return (
    <div className="space-y-2">
      {iaOn && (
        <button
          type="button"
          disabled={pensando || pending}
          onClick={borradorIA}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-violeta/30 bg-violeta-soft px-3 text-[15px] font-bold text-violeta disabled:opacity-60"
        >
          <Sparkles className={`h-4 w-4 ${pensando ? "animate-pulse" : ""}`} />
          {pensando ? "Armando el borrador…" : "Armar borrador con IA"}
        </button>
      )}
      <label className="block">
        <span className="text-[15px] font-bold">¿Qué te está frenando?</span>
        <textarea rows={2} value={f.bloqueos} onChange={(e) => setF({ ...f, bloqueos: e.target.value })} placeholder="Stock, precios, un cliente que no responde…" className={cls} />
      </label>
      <label className="block">
        <span className="text-[15px] font-bold">Decisiones que necesitás de dirección</span>
        <textarea rows={2} value={f.decisiones} onChange={(e) => setF({ ...f, decisiones: e.target.value })} placeholder="¿Puedo dar 8% a tal cliente? ¿Vamos a la feria?" className={cls} />
      </label>
      <label className="block">
        <span className="text-[15px] font-bold">Agenda de esta semana</span>
        <textarea rows={3} value={f.agenda} onChange={(e) => setF({ ...f, agenda: e.target.value })} placeholder="Visitas, demos, cierres esperados" className={cls} />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={() => guardar(true)} className="min-h-11 flex-1 rounded-xl bg-verde px-4 text-[15px] font-extrabold text-white disabled:opacity-50">
          {enviado ? "Reenviar a dirección" : "Enviar a dirección"}
        </button>
        <button type="button" disabled={pending} onClick={() => guardar(false)} className="min-h-11 rounded-xl border border-borde bg-white px-4 text-[15px] font-bold">
          Guardar borrador
        </button>
      </div>
      {msg && <p className={`text-[14px] font-bold ${msg.error ? "text-red-600" : "text-verde"}`}>{msg.texto}</p>}
    </div>
  );
}

/** Dirección responde las decisiones del informe. */
export function ResponderInforme({ informeId, respuesta }: { informeId: string; respuesta: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [texto, setTexto] = useState(respuesta ?? "");
  const [msg, setMsg] = useState<{ texto: string; error?: boolean } | null>(null);
  return (
    <div className="space-y-2">
      <textarea rows={2} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Respuesta de dirección (decisiones, pedidos)" className={cls} />
      <button
        type="button"
        disabled={pending || !texto.trim()}
        onClick={() =>
          startTransition(async () => {
            const r = await responderInforme(informeId, texto);
            setMsg(r && "error" in r && r.error ? { texto: r.error, error: true } : { texto: "Respuesta enviada" });
            router.refresh();
          })
        }
        className="min-h-11 rounded-xl bg-marino px-4 text-[15px] font-extrabold text-white disabled:opacity-50"
      >
        {respuesta ? "Actualizar respuesta" : "Responder"}
      </button>
      {msg && <p className={`text-[14px] font-bold ${msg.error ? "text-red-600" : "text-verde"}`}>{msg.texto}</p>}
    </div>
  );
}
