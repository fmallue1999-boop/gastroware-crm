"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AtSign, ChevronDown, ChevronRight, MessagesSquare, Send } from "lucide-react";
import { borrarMensaje, enviarMensaje, leerConversacion, type DatosConversacion } from "@/lib/actions/conversaciones";
import { cuandoMensaje, cuantosMensajes, mencionEnCurso, partesMensaje, sugerirPersonas, type Persona } from "@/lib/conversaciones";

/** Lo que se muestra con la conversación cerrada (viene del servidor). */
export type ResumenCharla = {
  total: number;
  sinLeer: number;
  ultimo: { autor: string; texto: string; at: string; propio: boolean } | null;
};

/** Cada cuánto se buscan mensajes nuevos mientras está abierta. */
const CADA_MS = 12000;

/**
 * La conversación del equipo de un interés (v1.26; antes de la cotización):
 * un chat interno para anotar y conversar sobre el interés, de la consulta a
 * la postventa. Con @ se le avisa a alguien (campana y celular). No la ve el
 * cliente ni sale en el PDF. Cerrada muestra el último mensaje y cuántos son
 * nuevos; abierta, el chat.
 */
export default function ConversacionInteres({
  oportunidadId,
  resumen,
  pagina = false,
}: {
  oportunidadId: string;
  resumen?: ResumenCharla | null;
  /** En su propia página: siempre abierta y más alta. */
  pagina?: boolean;
}) {
  const total = resumen?.total ?? 0;
  const sinLeer = resumen?.sinLeer ?? 0;
  const [abierta, setAbierta] = useState(pagina);
  const [datos, setDatos] = useState<DatosConversacion | null>(null);
  // Hasta dónde había leído al abrir (para la raya de "nuevos"); no cambia al refrescar
  const [nuevosDesde, setNuevosDesde] = useState<string | null | undefined>(undefined);
  const [texto, setTexto] = useState("");
  const [busqueda, setBusqueda] = useState<string | null>(null);
  const [elegida, setElegida] = useState(0);
  const [borrando, setBorrando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const lista = useRef<HTMLDivElement>(null);
  const caja = useRef<HTMLTextAreaElement>(null);

  // Al abrir: carga y, mientras esté abierta y a la vista, busca mensajes nuevos
  useEffect(() => {
    if (!abierta) return;
    let vivo = true;
    async function cargar() {
      const r = await leerConversacion(oportunidadId);
      if (!vivo) return;
      if ("error" in r) {
        setError(r.error);
        return;
      }
      setDatos(r);
      setNuevosDesde((antes) => (antes === undefined ? r.leidoAntes : antes));
    }
    cargar();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") cargar();
    }, CADA_MS);
    const alVolver = () => {
      if (document.visibilityState === "visible") cargar();
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      vivo = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [abierta, oportunidadId]);

  // Lo último, a la vista (solo se mueve la lista, no la página)
  const cantidad = datos?.mensajes.length ?? 0;
  useEffect(() => {
    if (lista.current) lista.current.scrollTop = lista.current.scrollHeight;
  }, [cantidad]);

  const personas = datos?.personas ?? [];
  const sugeridas = busqueda === null ? [] : sugerirPersonas(busqueda, personas).slice(0, 6);
  // Para resaltar las menciones (también las que me hacen a mí)
  const todasLasPersonas: Persona[] = datos?.miNombre ? [...personas, { id: datos.miId, nombre: datos.miNombre }] : personas;

  function alEscribir(valor: string, cursor: number) {
    setTexto(valor);
    const b = mencionEnCurso(valor.slice(0, cursor));
    setBusqueda(b);
    setElegida(0);
  }

  function mencionar(p: Persona) {
    const el = caja.current;
    const cursor = el?.selectionStart ?? texto.length;
    const antes = texto.slice(0, cursor);
    const b = mencionEnCurso(antes) ?? "";
    const inicio = cursor - b.length - 1;
    const nuevo = `${texto.slice(0, inicio)}@${p.nombre} ${texto.slice(cursor)}`;
    const pos = inicio + p.nombre.length + 2;
    setTexto(nuevo);
    setBusqueda(null);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(pos, pos);
    });
  }

  function arroba() {
    const el = caja.current;
    const cursor = el?.selectionStart ?? texto.length;
    const separador = cursor > 0 && !/\s/.test(texto[cursor - 1]) ? " " : "";
    const nuevo = `${texto.slice(0, cursor)}${separador}@${texto.slice(cursor)}`;
    const pos = cursor + separador.length + 1;
    setTexto(nuevo);
    setBusqueda("");
    setElegida(0);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(pos, pos);
    });
  }

  function enviar() {
    const t = texto.trim();
    if (!t || pending) return;
    setError(null);
    startTransition(async () => {
      const r = await enviarMensaje(oportunidadId, t);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      setTexto("");
      setBusqueda(null);
      setDatos((d) => (d ? { ...d, mensajes: r.mensajes } : d));
      setNuevosDesde(new Date().toISOString());
    });
  }

  function borrar(id: string) {
    setError(null);
    startTransition(async () => {
      const r = await borrarMensaje(id);
      if ("error" in r) setError(r.error);
      else setDatos((d) => (d ? { ...d, mensajes: d.mensajes.filter((m) => m.id !== id) } : d));
      setBorrando(null);
    });
  }

  if (!abierta) {
    const ultimo = resumen?.ultimo;
    return (
      <button
        type="button"
        onClick={() => setAbierta(true)}
        className={`flex min-h-12 w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left ${sinLeer > 0 ? "border-naranja/50 bg-naranja-soft" : "border-borde bg-white"}`}
      >
        <MessagesSquare className={`h-5 w-5 shrink-0 ${sinLeer > 0 ? "text-naranja" : "text-piedra"}`} />
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-extrabold">
            Conversación del equipo{total > 0 && <span className="font-normal text-piedra"> · {cuantosMensajes(total)}</span>}
          </span>
          <span className="block truncate text-[13px] text-piedra">
            {ultimo ? `${ultimo.propio ? "Vos" : ultimo.autor.split(" ")[0]}: ${ultimo.texto}` : "Interna: anotá algo o preguntale a alguien con @"}
          </span>
        </span>
        {sinLeer > 0 && (
          <span className="shrink-0 rounded-full bg-naranja px-2 py-0.5 text-xs font-extrabold text-white">
            {sinLeer} {sinLeer === 1 ? "nuevo" : "nuevos"}
          </span>
        )}
        <ChevronRight className="h-4 w-4 shrink-0 text-piedra/60" />
      </button>
    );
  }

  const mensajes = datos?.mensajes ?? [];
  const desde = nuevosDesde ? Date.parse(nuevosDesde) : null;
  const primeroNuevo = mensajes.findIndex((m) => m.autorId !== datos?.miId && (desde === null ? nuevosDesde === null : Date.parse(m.created_at) > desde));

  return (
    <div className="space-y-2 rounded-2xl border border-borde bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-[15px] font-extrabold">
          <MessagesSquare className="h-4 w-4" /> Conversación del equipo
          <span className="text-xs font-normal text-piedra">· interna: no la ve el cliente</span>
        </p>
        {!pagina && (
          <button type="button" onClick={() => setAbierta(false)} className="inline-flex min-h-9 items-center gap-1 px-1 text-sm text-piedra" aria-label="Cerrar la conversación">
            <ChevronDown className="h-4 w-4" /> Cerrar
          </button>
        )}
      </div>

      <div ref={lista} className={`space-y-2 overflow-y-auto overscroll-contain ${pagina ? "max-h-[60vh]" : "max-h-80"}`}>
        {!datos && !error && <p className="py-3 text-center text-sm text-piedra">Cargando…</p>}
        {datos && mensajes.length === 0 && (
          <p className="py-3 text-center text-sm text-piedra">Todavía no hay mensajes. Anotá algo o escribí @ para avisarle a alguien.</p>
        )}
        {mensajes.map((m, i) => {
          const propio = m.autorId === datos?.miId;
          return (
            <div key={m.id}>
              {i === primeroNuevo && i > 0 && (
                <p className="my-1 flex items-center gap-2 text-xs font-bold text-naranja">
                  <span className="h-px flex-1 bg-naranja/40" /> Nuevos <span className="h-px flex-1 bg-naranja/40" />
                </p>
              )}
              <div className={`flex ${propio ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${propio ? "rounded-br-md bg-celeste-soft" : "rounded-bl-md border border-borde bg-crema"}`}>
                  {!propio && <p className="text-xs font-extrabold text-tinta/80">{m.autor}</p>}
                  <p className="whitespace-pre-wrap break-words text-[15px] leading-snug">
                    {partesMensaje(m.texto, todasLasPersonas).map((p, k) =>
                      p.mencion ? (
                        <span key={k} className="font-bold text-celeste-deep">
                          {p.texto}
                        </span>
                      ) : (
                        <span key={k}>{p.texto}</span>
                      )
                    )}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center justify-end gap-x-2 text-[11px] text-piedra">
                    {(datos?.versiones ?? 0) > 1 && m.version ? <span>sobre v{m.version}</span> : null}
                    <span>{cuandoMensaje(m.created_at)}</span>
                    {propio &&
                      (borrando === m.id ? (
                        <span className="flex items-center gap-2">
                          ¿Borrar?
                          <button type="button" disabled={pending} onClick={() => borrar(m.id)} className="font-bold text-red-600 underline">
                            Sí
                          </button>
                          <button type="button" onClick={() => setBorrando(null)} className="underline">
                            No
                          </button>
                        </span>
                      ) : (
                        <button type="button" onClick={() => setBorrando(m.id)} className="underline">
                          Borrar
                        </button>
                      ))}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="relative">
        {sugeridas.length > 0 && (
          <ul className="absolute bottom-full left-0 z-20 mb-1 w-full max-w-xs overflow-hidden rounded-xl border border-borde bg-white shadow-lg">
            {sugeridas.map((p, i) => (
              <li key={p.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => mencionar(p)}
                  className={`flex min-h-11 w-full items-center gap-2 px-3 text-left text-[15px] ${i === elegida ? "bg-celeste-soft" : ""}`}
                >
                  <AtSign className="h-4 w-4 text-piedra" /> {p.nombre}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={arroba}
            disabled={!datos}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-borde bg-white text-tinta disabled:opacity-50"
            aria-label="Mencionar a alguien"
            title="Mencionar a alguien"
          >
            <AtSign className="h-5 w-5" />
          </button>
          <textarea
            ref={caja}
            value={texto}
            rows={1}
            maxLength={4000}
            enterKeyHint="send"
            disabled={!datos}
            onChange={(e) => alEscribir(e.target.value, e.target.selectionStart)}
            onKeyDown={(e) => {
              if (sugeridas.length > 0) {
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  e.preventDefault();
                  setElegida((x) => (x + (e.key === "ArrowDown" ? 1 : sugeridas.length - 1)) % sugeridas.length);
                  return;
                }
                if (e.key === "Enter" || e.key === "Tab") {
                  e.preventDefault();
                  mencionar(sugeridas[Math.min(elegida, sugeridas.length - 1)]);
                  return;
                }
                if (e.key === "Escape") {
                  setBusqueda(null);
                  return;
                }
              }
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                enviar();
              }
            }}
            placeholder="Escribí… con @ le avisás a alguien"
            className="field-sizing-content max-h-36 min-h-11 min-w-0 flex-1 resize-none rounded-xl border border-borde bg-white px-3 py-2.5 text-[15px] outline-none focus:border-marino disabled:opacity-50"
          />
          <button
            type="button"
            onClick={enviar}
            disabled={pending || !texto.trim()}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-marino text-white disabled:opacity-40"
            aria-label="Enviar"
            title="Enviar"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
      {error && <p className="text-sm font-bold text-red-600">{error}</p>}
    </div>
  );
}
