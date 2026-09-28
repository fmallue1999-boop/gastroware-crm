"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ImageUp, RotateCcw } from "lucide-react";
import { crearSubidaBiblioteca, guardarMarca } from "@/lib/actions";
import { createClient } from "@/lib/supabase/client";
import {
  LOGO_CLARO_OFICIAL,
  LOGO_OSCURO_OFICIAL,
  TEMAS,
  coloresDe,
  contraste,
  type Marca,
  type TemaId,
} from "@/lib/marca";

const cls = "min-h-11 w-full rounded-xl border border-borde bg-white px-3 text-[15px] outline-none focus:border-marino";

function SubidaLogo({
  titulo,
  ayuda,
  valor,
  oficial,
  fondo,
  onChange,
}: {
  titulo: string;
  ayuda: string;
  valor: string;
  oficial: string;
  fondo: string;
  onChange: (url: string) => void;
}) {
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function subir(file: File | null) {
    if (!file) return;
    setError(null);
    if (file.size > 2 * 1024 * 1024) {
      setError("El logo no puede pesar más de 2 MB");
      return;
    }
    setSubiendo(true);
    const firma = await crearSubidaBiblioteca(file.name, "marca");
    if ("error" in firma) {
      setError(firma.error ?? "No se pudo preparar la subida");
      setSubiendo(false);
      return;
    }
    const supabase = createClient();
    const { error: errUp } = await supabase.storage.from("biblioteca").uploadToSignedUrl(firma.path, firma.token, file);
    if (errUp) setError(errUp.message);
    else onChange(supabase.storage.from("biblioteca").getPublicUrl(firma.path).data.publicUrl);
    setSubiendo(false);
  }

  return (
    <div className="space-y-2">
      <p className="text-[15px] font-bold">{titulo}</p>
      <p className="text-xs text-piedra">{ayuda}</p>
      <div className="flex h-20 items-center justify-center rounded-xl p-3" style={{ background: fondo }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={valor || oficial} alt={titulo} className="max-h-full w-auto object-contain" />
      </div>
      <div className="flex flex-wrap gap-2">
        <label className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-borde bg-white px-3 text-[14px] font-bold">
          <ImageUp className="h-4 w-4" /> {subiendo ? "Subiendo…" : "Subir otro logo"}
          <input
            type="file"
            accept="image/png,image/webp,image/svg+xml"
            className="hidden"
            disabled={subiendo}
            onChange={(e) => subir(e.target.files?.[0] ?? null)}
          />
        </label>
        {valor && valor !== oficial && (
          <button type="button" onClick={() => onChange(oficial)} className="inline-flex min-h-10 items-center gap-1 rounded-xl px-2 text-[14px] text-piedra underline">
            <RotateCcw className="h-4 w-4" /> Volver al oficial
          </button>
        )}
      </div>
      {error && <p className="text-[14px] font-bold text-red-600">{error}</p>}
    </div>
  );
}

/**
 * Administración → Marca: el "skin" del sistema. Nombre, etiqueta junto al
 * logo, tema de color (o un color propio) y los logos. Vista previa en vivo;
 * al guardar cambia para todos.
 */
export default function MarcaAdmin({ inicial, puedeEditar }: { inicial: Marca; puedeEditar: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [m, setM] = useState<Marca>(inicial);
  const [msg, setMsg] = useState<{ texto: string; error?: boolean } | null>(null);
  const c = coloresDe(m);
  const legible = contraste(c.principal, "#ffffff") >= 4.5;
  const set = (patch: Partial<Marca>) => {
    setMsg(null);
    setM({ ...m, ...patch });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <div className="space-y-6">
        <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-lg font-extrabold">Nombre</h2>
          <label className="block">
            <span className="text-[14px] font-bold">Nombre del sistema</span>
            <input value={m.nombre} maxLength={40} onChange={(e) => set({ nombre: e.target.value })} className={cls} />
            <span className="text-xs text-piedra">Aparece en la pestaña del navegador y en el ícono del celular.</span>
          </label>
          <label className="block">
            <span className="text-[14px] font-bold">Etiqueta junto al logo</span>
            <input value={m.etiqueta} maxLength={8} onChange={(e) => set({ etiqueta: e.target.value })} className={`${cls} w-32`} />
            <span className="block text-xs text-piedra">Por ejemplo “OS”. Dejala vacía para mostrar solo el logo.</span>
          </label>
        </section>

        <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-lg font-extrabold">Colores</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {TEMAS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => set({ tema: t.id as TemaId })}
                className={`flex items-center gap-3 rounded-xl border-2 p-3 text-left ${m.tema === t.id ? "border-marino" : "border-borde"}`}
              >
                <span className="flex shrink-0 overflow-hidden rounded-lg">
                  <span className="h-10 w-5" style={{ background: t.colores.principal }} />
                  <span className="h-10 w-5" style={{ background: t.colores.fondo }} />
                  <span className="h-10 w-5" style={{ background: t.colores.acento }} />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1 text-[15px] font-extrabold">
                    {t.nombre} {m.tema === t.id && <Check className="h-4 w-4" />}
                  </span>
                  <span className="block text-xs text-piedra">{t.detalle}</span>
                </span>
              </button>
            ))}
            <label
              className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 ${m.tema === "personalizado" ? "border-marino" : "border-borde"}`}
            >
              <input
                type="color"
                value={m.color ?? "#8a1c1c"}
                onChange={(e) => set({ tema: "personalizado", color: e.target.value })}
                className="h-10 w-14 cursor-pointer rounded-lg border border-borde bg-white"
                aria-label="Color principal"
              />
              <span>
                <span className="block text-[15px] font-extrabold">Color propio</span>
                <span className="block text-xs text-piedra">Elegí el color de la barra y los botones.</span>
              </span>
            </label>
          </div>
          {!legible && (
            <p className="rounded-xl bg-ambar-soft px-3 py-2 text-[14px] font-bold text-ambar">
              Ese color es muy claro: el texto blanco de la barra y los botones se va a leer mal. Probá uno más oscuro.
            </p>
          )}
        </section>

        <section className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-lg font-extrabold">Logos</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <SubidaLogo
              titulo="Para fondo oscuro"
              ayuda="Barra lateral de la computadora. Ideal: SVG o PNG claro con fondo transparente."
              valor={m.logoOscuro}
              oficial={LOGO_OSCURO_OFICIAL}
              fondo={c.principal}
              onChange={(url) => set({ logoOscuro: url })}
            />
            <SubidaLogo
              titulo="Para fondo claro"
              ayuda="Ingreso y barra del celular. Ideal: SVG o PNG oscuro con fondo transparente."
              valor={m.logoClaro}
              oficial={LOGO_CLARO_OFICIAL}
              fondo={c.fondo}
              onChange={(url) => set({ logoClaro: url })}
            />
          </div>
        </section>
      </div>

      <div className="space-y-3 lg:sticky lg:top-6 lg:self-start">
        <h2 className="text-xs font-bold uppercase tracking-wide text-piedra">Vista previa</h2>
        <div className="overflow-hidden rounded-2xl border border-borde shadow-sm">
          <div className="flex min-h-72">
            <div className="w-40 shrink-0 space-y-1.5 p-3" style={{ background: c.principal }}>
              <div className="mb-3 flex items-center gap-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.logoOscuro || LOGO_OSCURO_OFICIAL} alt="" className="h-6 w-auto" />
                {m.etiqueta && (
                  <span className="rounded px-1 text-[9px] font-extrabold" style={{ background: c.acento, color: c.principal }}>
                    {m.etiqueta}
                  </span>
                )}
              </div>
              {["Embudo", "Mi día", "Contactos", "Ventas"].map((x, i) => (
                <div
                  key={x}
                  className="rounded-md px-2 py-1.5 text-[11px] font-semibold text-white"
                  style={{ background: i === 1 ? c.principal2 : "transparent", opacity: i === 1 ? 1 : 0.8 }}
                >
                  {x}
                </div>
              ))}
              <div className="mt-4 rounded-md bg-verde px-2 py-1.5 text-center text-[11px] font-extrabold text-white">+ Nueva consulta</div>
            </div>
            <div className="min-w-0 flex-1 space-y-2 p-3" style={{ background: c.fondo }}>
              <p className="text-[15px] font-extrabold text-tinta">Mi día</p>
              <div className="rounded-lg bg-white p-2 shadow-sm">
                <p className="text-[11px] font-bold">Consultas por asignar</p>
                <p className="text-[10px] text-piedra">Cargá dónde se entrega</p>
              </div>
              <div className="rounded-lg bg-white p-2 shadow-sm">
                <p className="text-[11px] font-bold">Ventas para facturar</p>
                <span
                  className="mt-1 inline-block rounded-md px-2 py-1 text-[10px] font-extrabold text-white"
                  style={{ background: c.principal }}
                >
                  Cargar factura
                </span>
              </div>
              <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: c.acentoSuave, color: c.principal }}>
                Botón elegido
              </span>
            </div>
          </div>
        </div>
        {puedeEditar ? (
          <button
            type="button"
            disabled={pending || !legible}
            onClick={() => {
              setMsg(null);
              startTransition(async () => {
                const r = await guardarMarca(m);
                if (r && "error" in r && r.error) setMsg({ texto: r.error, error: true });
                else {
                  setMsg({ texto: "Guardado: ya se ve así para todos" });
                  router.refresh();
                }
              });
            }}
            className="min-h-12 w-full rounded-2xl bg-verde text-base font-extrabold text-white disabled:opacity-50"
          >
            {pending ? "Guardando…" : "Guardar la marca"}
          </button>
        ) : (
          <p className="text-[14px] text-piedra">La marca la cambia dirección.</p>
        )}
        {msg && <p className={`text-[14px] font-bold ${msg.error ? "text-red-600" : "text-verde"}`}>{msg.texto}</p>}
      </div>
    </div>
  );
}
