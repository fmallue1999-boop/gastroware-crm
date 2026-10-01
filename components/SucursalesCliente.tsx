"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Pencil, Plus, Star } from "lucide-react";
import { actualizarSucursal, crearSucursal, darDeBajaSucursal, hacerPrincipalSucursal } from "@/lib/actions";
import { PROVINCIAS_AR } from "@/lib/constants";
import type { Sucursal } from "@/lib/types";

const campo = "min-h-11 w-full rounded-xl border border-borde bg-white px-3 text-base outline-none focus:border-marino";

type Datos = { nombre: string; direccion: string; ciudad: string; provincia: string; telefono: string; recibe: string; indicaciones: string };
const vacio: Datos = { nombre: "", direccion: "", ciudad: "", provincia: "", telefono: "", recibe: "", indicaciones: "" };
const desde = (s: Sucursal): Datos => ({
  nombre: s.nombre ?? "",
  direccion: s.direccion ?? "",
  ciudad: s.ciudad ?? "",
  provincia: s.provincia ?? "",
  telefono: s.telefono ?? "",
  recibe: s.recibe ?? "",
  indicaciones: s.indicaciones ?? "",
});

function FormSucursal({
  inicial,
  pending,
  onGuardar,
  onCancelar,
  textoBoton,
}: {
  inicial: Datos;
  pending: boolean;
  onGuardar: (d: Datos) => void;
  onCancelar: () => void;
  textoBoton: string;
}) {
  const [d, setD] = useState(inicial);
  const set = (k: keyof Datos) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setD({ ...d, [k]: e.target.value });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onGuardar(d);
      }}
      className="space-y-2 rounded-xl bg-crema/60 p-3"
    >
      <input required value={d.nombre} onChange={set("nombre")} placeholder="Nombre (ej: Local Palermo, Depósito, Casa central)" className={campo} />
      <input value={d.direccion} onChange={set("direccion")} placeholder="Dirección" className={campo} />
      <div className="grid grid-cols-2 gap-2">
        <input value={d.ciudad} onChange={set("ciudad")} placeholder="Localidad" className={campo} />
        <select value={d.provincia} onChange={set("provincia")} className={campo} aria-label="Provincia">
          <option value="">Provincia…</option>
          {PROVINCIAS_AR.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
          {d.provincia && !(PROVINCIAS_AR as readonly string[]).includes(d.provincia) && <option value={d.provincia}>{d.provincia}</option>}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input value={d.recibe} onChange={set("recibe")} placeholder="Quién recibe" className={campo} />
        <input type="tel" value={d.telefono} onChange={set("telefono")} placeholder="Teléfono del lugar" className={campo} />
      </div>
      <textarea
        value={d.indicaciones}
        onChange={set("indicaciones")}
        rows={2}
        placeholder="Horario e indicaciones para entregar (ej: de 9 a 13 h, entrar por la calle de atrás)"
        className={`${campo} py-2`}
      />
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="min-h-11 flex-1 rounded-xl bg-marino px-4 text-[15px] font-bold text-white disabled:opacity-50">
          {pending ? "Guardando…" : textoBoton}
        </button>
        <button type="button" disabled={pending} onClick={onCancelar} className="min-h-11 rounded-xl border border-borde bg-white px-4 text-[15px]">
          Cancelar
        </button>
      </div>
    </form>
  );
}

/**
 * Sucursales y puntos de entrega de una razón social (v1.14): la principal es
 * la dirección del cliente; las demás son lugares donde entregar. Cada una con
 * quién recibe y horario / indicaciones. Se editan, se cambia la principal y se
 * dan de baja (no se borran).
 */
export default function SucursalesCliente({ clienteId, sucursales }: { clienteId: string; sucursales: Sucursal[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editando, setEditando] = useState<string | null>(null);
  const [agregando, setAgregando] = useState(false);
  const [confirmarBaja, setConfirmarBaja] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const correr = (fn: () => Promise<{ error?: string } | { ok: true }>, despues?: () => void) => {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if ("error" in r && r.error) return setError(r.error);
      despues?.();
      router.refresh();
    });
  };
  const ordenadas = [...sucursales].sort((a, b) => Number(b.es_principal) - Number(a.es_principal));

  return (
    <section className="rounded-2xl border border-borde bg-white p-4 shadow-sm">
      <h2 className="text-sm font-bold">Sucursales y puntos de entrega</h2>
      <p className="mb-2 text-xs text-piedra">La principal es la dirección del cliente. Las demás se pueden elegir como lugar de entrega al cotizar o vender.</p>
      <div className="space-y-2">
        {ordenadas.map((s) =>
          editando === s.id ? (
            <FormSucursal
              key={s.id}
              inicial={desde(s)}
              pending={pending}
              textoBoton="Guardar cambios"
              onCancelar={() => setEditando(null)}
              onGuardar={(d) => correr(() => actualizarSucursal(s.id, d), () => setEditando(null))}
            />
          ) : (
            <div key={s.id} className="rounded-xl border border-borde p-3">
              <p className="flex flex-wrap items-center gap-1.5 text-[15px]">
                <MapPin className="h-4 w-4 text-piedra" />
                <span className="font-bold">{s.nombre}</span>
                {s.es_principal && <span className="rounded-full bg-celeste-soft px-2 py-0.5 text-xs font-bold text-azul">principal</span>}
              </p>
              <p className="text-[15px] text-tinta/80">
                {[s.direccion, [s.ciudad, s.provincia].filter(Boolean).join(", ")].filter(Boolean).join(" · ") || "Sin dirección"}
              </p>
              {(s.recibe || s.telefono) && (
                <p className="text-sm text-piedra">{[s.recibe ? `Recibe: ${s.recibe}` : null, s.telefono].filter(Boolean).join(" · ")}</p>
              )}
              {s.indicaciones && <p className="text-sm text-piedra">{s.indicaciones}</p>}
              {confirmarBaja === s.id ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">¿Dar de baja esta sucursal?</span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => correr(() => darDeBajaSucursal(s.id), () => setConfirmarBaja(null))}
                    className="min-h-10 rounded-xl bg-marino px-3 text-sm font-bold text-white disabled:opacity-50"
                  >
                    Sí, dar de baja
                  </button>
                  <button type="button" onClick={() => setConfirmarBaja(null)} className="min-h-10 px-2 text-sm text-piedra underline">
                    No
                  </button>
                </div>
              ) : (
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-bold text-marino">
                  <button type="button" onClick={() => setEditando(s.id)} className="inline-flex min-h-9 items-center gap-1 underline">
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </button>
                  {!s.es_principal && (
                    <button type="button" disabled={pending} onClick={() => correr(() => hacerPrincipalSucursal(s.id))} className="inline-flex min-h-9 items-center gap-1 underline disabled:opacity-50">
                      <Star className="h-3.5 w-3.5" /> Hacer principal
                    </button>
                  )}
                  <button type="button" onClick={() => setConfirmarBaja(s.id)} className="inline-flex min-h-9 items-center text-piedra underline">
                    Dar de baja
                  </button>
                </div>
              )}
            </div>
          )
        )}
        {sucursales.length === 0 && !agregando && <p className="text-sm text-piedra">Sin sucursales cargadas.</p>}
      </div>

      {error && <p className="mt-2 text-sm font-semibold text-red-700">{error}</p>}
      <div className="mt-2">
        {agregando ? (
          <FormSucursal
            inicial={vacio}
            pending={pending}
            textoBoton="Agregar"
            onCancelar={() => setAgregando(false)}
            onGuardar={(d) => correr(() => crearSucursal({ clienteId, ...d }), () => setAgregando(false))}
          />
        ) : (
          <button type="button" onClick={() => setAgregando(true)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-borde bg-white px-4 text-[15px] font-bold">
            <Plus className="h-4 w-4" /> Agregar sucursal o punto de entrega
          </button>
        )}
      </div>
    </section>
  );
}
