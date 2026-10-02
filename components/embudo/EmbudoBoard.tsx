"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, FileText, MessageCircle } from "lucide-react";
import { cambiarEtapa, ultimosMovimientos } from "@/lib/actions";
import { COLUMNAS_EMBUDO, type ColumnaEmbudo, type TarjetaEmbudo } from "@/lib/embudo";
import { ETAPAS, MOTIVOS_PERDIDA, PEDIDO_ESTADOS } from "@/lib/constants";
import { textoMontos } from "@/lib/dinero";
import { dinero, fechaCorta, haceCuanto, linkWhatsApp } from "@/lib/format";
import { PuntoNivel, textoProximo } from "@/components/PuntoNivel";
import LinkContacto from "@/components/LinkContacto";
import ReprogramarInteres from "@/components/ReprogramarInteres";
import type { Etapa } from "@/lib/types";

type Mov = { id: string; contenido: string; created_at: string; quien: string | null };

const COLOR_CAB: Record<ColumnaEmbudo, string> = {
  hoy: "bg-marino",
  nueva: "bg-azul",
  cotizada: "bg-violeta",
  seguimiento: "bg-ambar",
  espera: "bg-naranja",
  ganada: "bg-verde",
};
const COLOR_ARO: Record<ColumnaEmbudo, string> = {
  hoy: "ring-marino",
  nueva: "ring-azul",
  cotizada: "ring-violeta",
  seguimiento: "ring-ambar",
  espera: "ring-naranja",
  ganada: "ring-verde",
};
const TOPE = 25;

/**
 * El embudo (pantalla principal, rediseño aprobado por dirección). v1.21:
 * primero "Para hoy" (lo que toca contactar hoy y lo atrasado, con su etapa;
 * vuelve a su columna cuando se reprograma). En PC, columnas con color: cada tarjeta se despliega ahí mismo para ver lo último
 * que pasó y actuar, y se puede arrastrar de una columna a otra. En celular,
 * las etapas apiladas: una se abre a la vez.
 */
export default function EmbudoBoard({
  columnas,
  totales,
  hoy,
}: {
  columnas: Record<ColumnaEmbudo, TarjetaEmbudo[]>;
  totales: Record<ColumnaEmbudo, Record<string, number>>;
  hoy: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [abierta, setAbierta] = useState<string | null>(null);
  const [movs, setMovs] = useState<Record<string, Mov[]>>({});
  const [perdiendo, setPerdiendo] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [verTodo, setVerTodo] = useState<Record<string, boolean>>({});
  const primeraConAlgo = COLUMNAS_EMBUDO.find((c) => columnas[c.key].length > 0)?.key ?? null;
  const [columnaMovil, setColumnaMovil] = useState<ColumnaEmbudo | null>(primeraConAlgo);
  const [sobre, setSobre] = useState<ColumnaEmbudo | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function avisar(texto: string) {
    setAviso(texto);
    setTimeout(() => setAviso(null), 2000);
  }

  function correr(fn: () => Promise<unknown>, textoOk: string) {
    setError(null);
    startTransition(async () => {
      const res = (await fn()) as { error?: string } | null | undefined;
      if (res && typeof res === "object" && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      avisar(textoOk);
      setPerdiendo(null);
      setMotivo("");
      router.refresh();
    });
  }

  function desplegar(t: TarjetaEmbudo) {
    if (abierta === t.id) {
      setAbierta(null);
      return;
    }
    setAbierta(t.id);
    if (!movs[t.id]) {
      ultimosMovimientos(t.id, 3).then((lista) => setMovs((m) => ({ ...m, [t.id]: lista })));
    }
  }

  function mover(id: string, destino: ColumnaEmbudo) {
    const t = Object.values(columnas)
      .flat()
      .find((x) => x.id === id);
    if (!t || destino === "hoy" || t.etapa === destino) return;
    const label = COLUMNAS_EMBUDO.find((c) => c.key === destino)?.label ?? destino;
    correr(() => cambiarEtapa(id, destino as Etapa), destino === "ganada" ? "Venta registrada" : `Pasó a ${label}`);
  }

  const chip = "inline-flex min-h-10 items-center justify-center rounded-xl px-3 text-[14px] font-bold disabled:opacity-50";

  const Tarjeta = ({ t, enHoy = false }: { t: TarjetaEmbudo; enHoy?: boolean }) => {
    const vendida = t.etapa === "ganada";
    const etapaTexto = ETAPAS.find((e) => e.value === t.etapa)?.label ?? t.etapa;
    const expandida = abierta === t.id;
    const prox = textoProximo(t.proximo_contacto, t.proximo_nota, hoy, t.proxima_accion, t.proximo_hora);
    const llegoStock = t.etapa === "espera" && t.proximo_nota === "Llegó stock";
    const paso = PEDIDO_ESTADOS.find((p) => p.value === (t.pedido_estado ?? "comprometido"))?.label ?? "Vendido";
    return (
      <div
        draggable={!vendida}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", t.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        className={`rounded-2xl border bg-white p-3 shadow-sm ${expandida ? "border-marino" : "border-borde"} ${vendida ? "" : "lg:cursor-grab"}`}
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <LinkContacto id={t.cliente_id} interes={t.id} className="flex items-center gap-1.5 text-[15px] font-extrabold hover:underline">
              <PuntoNivel nivel={t.nivel} />
              <span className="truncate">{t.nombre}</span>
            </LinkContacto>
            <p className="truncate text-[14px] text-tinta/80">
              {t.interes}
              {t.monto ? ` · ${dinero(t.monto, t.moneda)}` : ""}
            </p>
            {vendida ? (
              <p className="mt-1">
                <span className="rounded-full bg-verde-soft px-2 py-0.5 text-xs font-bold text-verde">{paso}</span>
                {t.closed_at ? <span className="ml-1.5 text-xs text-piedra">{fechaCorta(t.closed_at)}</span> : null}
              </p>
            ) : llegoStock ? (
              <p className="mt-0.5 text-[13px] font-bold text-verde">Llegó stock · contactar hoy</p>
            ) : t.contactado_hoy ? (
              <p className="mt-0.5 text-[13px] font-bold text-verde">✓ Contactado hoy · falta el próximo paso</p>
            ) : (
              <p className={`mt-0.5 text-[13px] ${prox.clase}`}>{prox.texto}</p>
            )}
            {enHoy && <span className="mt-1 inline-block rounded-full bg-crema px-2 py-0.5 text-[11px] font-bold text-piedra">{etapaTexto}</span>}
          </div>
          <button
            type="button"
            onClick={() => desplegar(t)}
            aria-expanded={expandida}
            aria-label="Ver más"
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${expandida ? "bg-marino text-white" : "bg-crema text-piedra"}`}
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${expandida ? "rotate-180" : ""}`} />
          </button>
        </div>

        {expandida && (
          <div className="mt-2.5 space-y-2 border-t border-borde/70 pt-2.5">
            {(movs[t.id] ?? null) === null ? (
              <p className="text-xs text-piedra">Cargando lo último…</p>
            ) : movs[t.id].length === 0 ? (
              <p className="text-xs text-piedra">Todavía no hay movimientos sobre este interés.</p>
            ) : (
              movs[t.id].map((m) => (
                <div key={m.id} className="rounded-xl bg-crema px-2.5 py-1.5 text-[13px]">
                  <p>{m.contenido}</p>
                  <p className="text-xs text-piedra">
                    {m.quien ? `${m.quien} · ` : ""}
                    {haceCuanto(m.created_at)}
                  </p>
                </div>
              ))
            )}

            {perdiendo === t.id ? (
              <div className="flex flex-wrap gap-1.5">
                <select
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  className="min-h-10 min-w-0 flex-1 rounded-xl border border-borde bg-white px-2 text-[14px] outline-none focus:border-marino"
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
                  onClick={() => correr(() => cambiarEtapa(t.id, "perdida", motivo), "Marcado como no se dio")}
                  className={`${chip} bg-marino text-white`}
                >
                  Confirmar
                </button>
                <button type="button" onClick={() => setPerdiendo(null)} className="px-2 text-xs text-piedra underline">
                  Cancelar
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                {/* Contactar y abrir: lo de todos los días */}
                <div className="grid grid-cols-2 gap-1.5">
                  {t.telefono ? (
                    <a href={linkWhatsApp(t.telefono)} target="_blank" rel="noopener noreferrer" className={`${chip} gap-1 bg-verde text-white`}>
                      <MessageCircle className="h-4 w-4" /> WhatsApp
                    </a>
                  ) : (
                    <span className={`${chip} border border-dashed border-borde text-piedra`}>Sin teléfono</span>
                  )}
                  <LinkContacto id={t.cliente_id} interes={t.id} className={`${chip} bg-marino text-white`}>
                    Abrir ficha
                  </LinkContacto>
                </div>
                {vendida ? (
                  <Link href="/pedidos" className={`${chip} w-full border border-borde bg-white`}>
                    Ver la venta
                  </Link>
                ) : (
                  <>
                    <ReprogramarInteres oportunidadId={t.id} accion={t.proxima_accion} className="min-h-10 text-[14px]" />
                    {t.etapa === "nueva" && (
                      <Link href={`/cotizar/${t.id}`} className={`${chip} w-full gap-1 border border-marino bg-white text-marino`}>
                        <FileText className="h-4 w-4" /> Cotizar
                      </Link>
                    )}
                    {/* Cerrar: compró o no se dio */}
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => correr(() => cambiarEtapa(t.id, "ganada"), "Venta registrada: está en Vendidos")}
                        className={`${chip} bg-verde-soft text-verde`}
                      >
                        Me compró
                      </button>
                      <button type="button" disabled={pending} onClick={() => setPerdiendo(t.id)} className={`${chip} border border-borde bg-white text-piedra`}>
                        No se dio
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const listaColumna = (col: ColumnaEmbudo) => {
    const lista = columnas[col];
    const visible = verTodo[col] ? lista : lista.slice(0, TOPE);
    return (
      <>
        {visible.map((t) => (
          <Tarjeta key={t.id} t={t} enHoy={col === "hoy"} />
        ))}
        {lista.length === 0 && (
          <p className="rounded-2xl border border-dashed border-borde p-3 text-center text-xs text-piedra">{col === "hoy" ? "Nada para hoy" : "Nada acá"}</p>
        )}
        {lista.length > TOPE && !verTodo[col] && (
          <button
            type="button"
            onClick={() => setVerTodo((v) => ({ ...v, [col]: true }))}
            className="min-h-10 w-full rounded-2xl border border-borde bg-white text-[14px] font-bold text-tinta"
          >
            Ver los {lista.length}
          </button>
        )}
      </>
    );
  };

  return (
    <div className="space-y-3">
      {(aviso || error) && (
        <p className={`rounded-xl px-3 py-2 text-[15px] font-semibold ${error ? "bg-red-50 text-red-700" : "bg-verde-soft text-verde"}`}>
          {error ?? `✓ ${aviso}`}
        </p>
      )}

      {/* Computadora: las columnas una al lado de la otra, se puede arrastrar entre etapas */}
      <div className="hidden lg:grid lg:auto-cols-[minmax(200px,1fr)] lg:grid-flow-col lg:items-start lg:gap-3 lg:overflow-x-auto lg:pb-2">
        {COLUMNAS_EMBUDO.map((c) => (
          <div
            key={c.key}
            onDragOver={(e) => {
              if (c.key === "hoy") return;
              e.preventDefault();
              if (sobre !== c.key) setSobre(c.key);
            }}
            onDragLeave={() => setSobre(null)}
            onDrop={(e) => {
              e.preventDefault();
              setSobre(null);
              mover(e.dataTransfer.getData("text/plain"), c.key);
            }}
            className={`min-h-40 space-y-2 rounded-2xl p-1 ${sobre === c.key ? `ring-2 ${COLOR_ARO[c.key]} bg-white/60` : ""}`}
          >
            <div className={`flex items-baseline justify-between rounded-xl px-3 py-2 text-white ${COLOR_CAB[c.key]}`}>
              <span className="text-[15px] font-extrabold">{c.label}</span>
              <span className="text-xs font-semibold opacity-90">
                {columnas[c.key].length}
                {Object.keys(totales[c.key]).length ? ` · ${textoMontos(totales[c.key])}` : ""}
              </span>
            </div>
            {listaColumna(c.key)}
          </div>
        ))}
      </div>

      {/* Celular: las etapas apiladas, una abierta a la vez */}
      <div className="space-y-2 lg:hidden">
        {COLUMNAS_EMBUDO.map((c) => {
          const abiertaCol = columnaMovil === c.key;
          return (
            <div key={c.key}>
              <button
                type="button"
                onClick={() => setColumnaMovil(abiertaCol ? null : c.key)}
                aria-expanded={abiertaCol}
                className={`flex min-h-13 w-full items-center justify-between rounded-2xl px-4 text-white ${COLOR_CAB[c.key]}`}
              >
                <span className="text-[16px] font-extrabold">{c.label}</span>
                <span className="flex items-center gap-2 text-[13px] font-semibold opacity-95">
                  {columnas[c.key].length}
                  {Object.keys(totales[c.key]).length ? ` · ${textoMontos(totales[c.key])}` : ""}
                  <ChevronDown className={`h-4 w-4 transition-transform ${abiertaCol ? "rotate-180" : ""}`} />
                </span>
              </button>
              {abiertaCol && <div className="mt-2 space-y-2 px-0.5">{listaColumna(c.key)}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
