"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, RotateCcw, Send, Sparkles } from "lucide-react";
import { preguntarAsistente } from "@/lib/actions";
import TextoIA from "@/components/ia/TextoIA";
import AyudaLink from "@/components/guia/AyudaLink";

type Mensaje = { rol: "usuario" | "asistente"; texto: string; usadas?: string[]; error?: boolean };

/**
 * El asistente de GastroWare OS: preguntás con tus palabras y responde con
 * los datos que tu puesto puede ver, cómo se hace cada cosa y borradores de
 * mensajes. La conversación queda en este navegador.
 */
export default function Asistente({
  userId,
  puesto,
  sugerencias,
  preguntaInicial,
  activa,
}: {
  userId: string;
  puesto: string;
  sugerencias: string[];
  preguntaInicial?: string | null;
  activa: boolean;
}) {
  const router = useRouter();
  const clave = `asistente_${userId}`;
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [pending, startTransition] = useTransition();
  const [copiado, setCopiado] = useState<number | null>(null);
  const fin = useRef<HTMLDivElement>(null);
  const inicial = useRef(false);

  function guardar(lista: Mensaje[]) {
    try {
      window.localStorage.setItem(clave, JSON.stringify(lista.slice(-30)));
    } catch {
      // sin almacenamiento: la conversación dura mientras la pantalla esté abierta
    }
  }

  function enviar(pregunta: string, base: Mensaje[]) {
    const q = pregunta.trim();
    if (!q || pending) return;
    const conPregunta: Mensaje[] = [...base, { rol: "usuario", texto: q }];
    setMensajes(conPregunta);
    guardar(conPregunta);
    setTexto("");
    startTransition(async () => {
      const r = await preguntarAsistente(
        conPregunta.filter((m) => !m.error).map((m) => ({ rol: m.rol, texto: m.texto }))
      );
      const respuesta: Mensaje =
        r && "texto" in r && r.texto
          ? { rol: "asistente", texto: r.texto, usadas: r.usadas }
          : { rol: "asistente", texto: (r as { error?: string })?.error ?? "No se pudo responder", error: true };
      const lista = [...conPregunta, respuesta];
      setMensajes(lista);
      guardar(lista);
    });
  }

  useEffect(() => {
    let previos: Mensaje[] = [];
    try {
      previos = JSON.parse(window.localStorage.getItem(clave) ?? "[]") as Mensaje[];
    } catch {
      previos = [];
    }
    // La conversación guardada se carga en el navegador (no existe en el servidor)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMensajes(previos);
    if (preguntaInicial && !inicial.current) {
      inicial.current = true;
      enviar(preguntaInicial, previos);
      router.replace("/asistente", { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fin.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensajes, pending]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
            <Sparkles className="h-6 w-6 text-violeta" /> Asistente <AyudaLink tarea="asistente" />
          </h1>
          <p className="text-[15px] text-piedra">
            Preguntale con tus palabras: mira tus datos ({puesto}), te dice cómo se hace y te arma mensajes. No cambia nada solo.
          </p>
        </div>
        {mensajes.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setMensajes([]);
              guardar([]);
            }}
            className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-borde bg-white px-3 text-[14px] font-bold text-piedra"
          >
            <RotateCcw className="h-4 w-4" /> Nueva conversación
          </button>
        )}
      </div>

      {!activa && (
        <p className="rounded-2xl bg-ambar-soft px-4 py-3 text-[15px] font-bold text-ambar">
          La IA no está activa. Dirección la puede activar en Administración → IA.
        </p>
      )}

      {mensajes.length === 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-piedra">Para empezar</p>
          <div className="flex flex-wrap gap-2">
            {sugerencias.map((s) => (
              <button
                key={s}
                type="button"
                disabled={!activa || pending}
                onClick={() => enviar(s, [])}
                className="rounded-2xl border border-borde bg-white px-3.5 py-2 text-left text-[15px] font-semibold shadow-sm hover:border-violeta disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {mensajes.map((m, i) =>
          m.rol === "usuario" ? (
            <div key={i} className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-marino px-4 py-2.5 text-[15px] text-white">
              {m.texto}
            </div>
          ) : (
            <div
              key={i}
              className={`max-w-[92%] rounded-2xl rounded-bl-md px-4 py-3 shadow-sm ${m.error ? "bg-ambar-soft text-ambar" : "bg-white"}`}
            >
              {m.error ? <p className="text-[15px] font-bold">{m.texto}</p> : <TextoIA texto={m.texto} />}
              {!m.error && (
                <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-borde/60 pt-2">
                  {m.usadas && m.usadas.length > 0 && <span className="text-xs text-piedra">Revisó: {m.usadas.join(" · ")}</span>}
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(m.texto.replace(/\*\*/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"));
                      setCopiado(i);
                      setTimeout(() => setCopiado(null), 1500);
                    }}
                    className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-marino"
                  >
                    <Copy className="h-3.5 w-3.5" /> {copiado === i ? "Copiado" : "Copiar"}
                  </button>
                </div>
              )}
            </div>
          )
        )}
        {pending && (
          <div className="flex max-w-[92%] items-center gap-2 rounded-2xl rounded-bl-md bg-white px-4 py-3 text-[15px] text-piedra shadow-sm">
            <Sparkles className="h-4 w-4 animate-pulse text-violeta" /> Pensando y revisando tus datos…
          </div>
        )}
        <div ref={fin} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar(texto, mensajes);
        }}
        className="fijo-abajo sticky bottom-20 flex items-end gap-2 rounded-2xl border border-borde bg-white p-2 shadow-md lg:bottom-4"
      >
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              enviar(texto, mensajes);
            }
          }}
          rows={1}
          disabled={!activa}
          placeholder="Escribí tu pregunta (ej: ¿qué tengo pendiente con el Hotel X?)"
          className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-2 py-2.5 text-[16px] outline-none"
        />
        <button
          type="submit"
          disabled={!activa || pending || !texto.trim()}
          aria-label="Enviar"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violeta text-white disabled:opacity-40"
        >
          <Send className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
}
