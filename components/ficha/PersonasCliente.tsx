"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, MessageCircle, Pencil, Phone, Plus, Star, Trash2 } from "lucide-react";
import { crearPersona, editarPersona, quitarPersona } from "@/lib/actions";
import { linkWhatsApp, telefonoProlijo } from "@/lib/format";

export type Persona = { id: string; nombre: string; cargo: string | null; telefono: string | null; email: string | null; es_decisor: boolean };

const cls = "min-h-11 w-full rounded-xl border border-borde bg-white px-3 text-[15px] outline-none focus:border-marino";

function FormPersona({
  inicial,
  onGuardar,
  onCancelar,
  pending,
}: {
  inicial?: Persona;
  onGuardar: (p: { nombre: string; cargo: string; telefono: string; email: string; esDecisor: boolean }) => void;
  onCancelar: () => void;
  pending: boolean;
}) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [cargo, setCargo] = useState(inicial?.cargo ?? "");
  const [telefono, setTelefono] = useState(inicial?.telefono ? telefonoProlijo(inicial.telefono) : "");
  const [email, setEmail] = useState(inicial?.email ?? "");
  const [esDecisor, setEsDecisor] = useState(inicial?.es_decisor ?? false);
  return (
    <div className="space-y-2 rounded-xl bg-crema p-3">
      <input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre y apellido" className={cls} />
      <input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Cargo (dueño, encargado, compras…)" className={cls} />
      <input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Teléfono / WhatsApp" className={cls} />
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className={cls} />
      <label className="flex items-center gap-2 text-[15px]">
        <input type="checkbox" checked={esDecisor} onChange={(e) => setEsDecisor(e.target.checked)} /> Decide la compra
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending || !nombre.trim()}
          onClick={() => onGuardar({ nombre, cargo, telefono, email, esDecisor })}
          className="min-h-11 flex-1 rounded-xl bg-marino px-4 text-[15px] font-bold text-white disabled:opacity-50"
        >
          Guardar
        </button>
        <button type="button" onClick={onCancelar} className="min-h-11 rounded-xl border border-borde bg-white px-4 text-[15px]">
          Cancelar
        </button>
      </div>
    </div>
  );
}

/** Las personas de la empresa: con quién hablamos, cada una con su teléfono y email. */
export default function PersonasCliente({ clienteId, personas }: { clienteId: string; personas: Persona[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editando, setEditando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function correr(fn: () => Promise<{ error?: string } | { ok: true }>) {
    setError(null);
    startTransition(async () => {
      const r = (await fn()) as { error?: string };
      if (r?.error) setError(r.error);
      else {
        setEditando(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-2">
      {personas.length === 0 && <p className="text-[15px] text-piedra">Todavía no hay personas cargadas. Sumá con quién hablan.</p>}
      {personas.map((p) =>
        editando === p.id ? (
          <FormPersona
            key={p.id}
            inicial={p}
            pending={pending}
            onCancelar={() => setEditando(null)}
            onGuardar={(d) => correr(() => editarPersona(p.id, d))}
          />
        ) : (
          <div key={p.id} className="flex items-center gap-2 rounded-xl bg-crema px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-[15px] font-bold">
                {p.nombre}
                {p.es_decisor && <Star className="h-3.5 w-3.5 shrink-0 fill-ambar text-ambar" aria-label="Decide la compra" />}
              </p>
              <p className="truncate text-xs text-piedra">
                {[p.cargo, p.telefono ? telefonoProlijo(p.telefono) : null, p.email].filter(Boolean).join(" · ") || "Sin datos de contacto"}
              </p>
            </div>
            {p.telefono && (
              <>
                <a href={linkWhatsApp(p.telefono)} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="flex h-10 w-10 items-center justify-center rounded-full bg-verde text-white">
                  <MessageCircle className="h-4 w-4" />
                </a>
                <a href={`tel:${p.telefono}`} aria-label="Llamar" className="flex h-10 w-10 items-center justify-center rounded-full border border-borde bg-white">
                  <Phone className="h-4 w-4" />
                </a>
              </>
            )}
            {p.email && (
              <a href={`mailto:${p.email}`} aria-label="Email" className="flex h-10 w-10 items-center justify-center rounded-full border border-borde bg-white">
                <Mail className="h-4 w-4" />
              </a>
            )}
            <button type="button" onClick={() => setEditando(p.id)} aria-label="Cambiar" className="flex h-10 w-10 items-center justify-center rounded-full text-piedra hover:bg-white">
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`¿Quitar a ${p.nombre}? Lo que se habló con esa persona queda en el historial.`)) correr(() => quitarPersona(p.id));
              }}
              aria-label="Quitar"
              className="flex h-10 w-10 items-center justify-center rounded-full text-piedra hover:bg-white"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )
      )}
      {editando === "nueva" ? (
        <FormPersona pending={pending} onCancelar={() => setEditando(null)} onGuardar={(d) => correr(() => crearPersona(clienteId, d))} />
      ) : (
        <button
          type="button"
          onClick={() => setEditando("nueva")}
          className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-dashed border-borde bg-white px-3 text-[14px] font-bold text-marino"
        >
          <Plus className="h-4 w-4" /> Agregar persona
        </button>
      )}
      {error && <p className="text-sm font-bold text-red-600">{error}</p>}
    </div>
  );
}
