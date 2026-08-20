"use client";

import { useState, useTransition } from "react";
import { Users } from "lucide-react";
import {
  previewSegmento,
  crearCampania,
  type FiltrosSegmento,
} from "@/lib/actions";
import { RUBROS, ESTADOS_CLIENTE } from "@/lib/constants";

const inputCls =
  "w-full rounded-2xl border border-borde bg-white shadow-sm px-3 py-2.5 text-sm outline-none focus:border-tinta";

const MARCAS = ["Zumex", "GastroWare", "Rational", "Jetinno"];

export default function CampaniaForm({
  mesesDormidoDefault,
}: {
  mesesDormidoDefault: number;
}) {
  const [pending, startTransition] = useTransition();
  const [nombre, setNombre] = useState("");
  const [canal, setCanal] = useState<"whatsapp" | "email">("whatsapp");
  const [asunto, setAsunto] = useState("");
  const [estados, setEstados] = useState<string[]>([]);
  const [rubros, setRubros] = useState<string[]>([]);
  const [marca, setMarca] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [dormido, setDormido] = useState(false);
  const [garantia, setGarantia] = useState(false);
  const [conRecurrencia, setConRecurrencia] = useState(false);
  const [plantilla, setPlantilla] = useState(
    "Hola {nombre}, ¿cómo va todo? "
  );
  const [preview, setPreview] = useState<{
    total: number;
    conTelefono: number;
    conEmail: number;
    muestra: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtros: FiltrosSegmento = {
    estados: estados.length ? estados : undefined,
    rubros: rubros.length ? rubros : undefined,
    marca: marca || undefined,
    ciudad: ciudad || undefined,
    dormidoMeses: dormido ? mesesDormidoDefault : undefined,
    garantiaDias: garantia ? 60 : undefined,
    conRecurrencia: conRecurrencia || undefined,
  };

  function alternar(lista: string[], setLista: (v: string[]) => void, valor: string) {
    setLista(
      lista.includes(valor) ? lista.filter((x) => x !== valor) : [...lista, valor]
    );
    setPreview(null);
  }

  function verAlcance() {
    setError(null);
    startTransition(async () => {
      setPreview(await previewSegmento(filtros));
    });
  }

  function crear() {
    setError(null);
    startTransition(async () => {
      const res = await crearCampania({ nombre, filtros, plantilla, canal, asunto });
      if (res && "error" in res && res.error) setError(res.error);
    });
  }

  const chip = (activo: boolean) =>
    `rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
      activo ? "bg-tinta text-white" : "border border-borde bg-white text-piedra"
    }`;

  return (
    <div className="space-y-4">
      <input
        type="text"
        required
        placeholder="Nombre de la campaña (ej: Recompra pastillas agosto)"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        className={inputCls}
      />

      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-piedra">
          ¿Por dónde sale?
        </p>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setCanal("whatsapp")}
            className={`flex-1 rounded-2xl px-3 py-2.5 text-sm font-medium ${
              canal === "whatsapp"
                ? "bg-tinta text-white"
                : "border border-borde bg-white text-piedra"
            }`}
          >
            WhatsApp (uno por uno, con tu OK)
          </button>
          <button
            type="button"
            onClick={() => setCanal("email")}
            className={`flex-1 rounded-2xl px-3 py-2.5 text-sm font-medium ${
              canal === "email"
                ? "bg-tinta text-white"
                : "border border-borde bg-white text-piedra"
            }`}
          >
            Email (automático, por tandas)
          </button>
        </div>
      </div>

      <section className="rounded-2xl border border-borde bg-white p-4 shadow-sm space-y-3">
        <p className="text-sm font-semibold">¿A quiénes?</p>

        <div>
          <p className="mb-1.5 text-xs text-piedra">Estado</p>
          <div className="flex flex-wrap gap-1.5">
            {ESTADOS_CLIENTE.map((e) => (
              <button
                key={e.value}
                type="button"
                onClick={() => alternar(estados, setEstados, e.value)}
                className={chip(estados.includes(e.value))}
              >
                {e.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs text-piedra">Rubro</p>
          <div className="flex flex-wrap gap-1.5">
            {RUBROS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => alternar(rubros, setRubros, r)}
                className={chip(rubros.includes(r))}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs text-piedra">Tienen equipo de la marca</p>
          <div className="flex flex-wrap gap-1.5">
            {MARCAS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMarca(marca === m ? "" : m);
                  setPreview(null);
                }}
                className={chip(marca === m)}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => {
              setDormido(!dormido);
              setPreview(null);
            }}
            className={chip(dormido)}
          >
            Dormidos ({mesesDormidoDefault}+ meses sin actividad)
          </button>
          <button
            type="button"
            onClick={() => {
              setGarantia(!garantia);
              setPreview(null);
            }}
            className={chip(garantia)}
          >
            Garantía vence en 60 días
          </button>
          <button
            type="button"
            onClick={() => {
              setConRecurrencia(!conRecurrencia);
              setPreview(null);
            }}
            className={chip(conRecurrencia)}
          >
            Compran consumibles
          </button>
        </div>

        <input
          type="text"
          placeholder="Ciudad (opcional)"
          value={ciudad}
          onChange={(e) => {
            setCiudad(e.target.value);
            setPreview(null);
          }}
          className={inputCls}
        />

        <button
          type="button"
          onClick={verAlcance}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-2xl border border-borde bg-white px-4 py-2.5 text-sm font-medium shadow-sm disabled:opacity-60"
        >
          <Users className="h-4 w-4" /> Ver a cuántos les llega
        </button>

        {preview && (
          <div className="rounded-xl bg-celeste-soft/50 border border-celeste px-3 py-2 text-sm">
            <p className="font-medium">
              {canal === "email"
                ? `${preview.conEmail} clientes con email`
                : `${preview.conTelefono} clientes con WhatsApp`}
              {canal === "email" && preview.total !== preview.conEmail
                ? ` (${preview.total - preview.conEmail} más sin email, quedan afuera)`
                : canal === "whatsapp" && preview.total !== preview.conTelefono
                  ? ` (${preview.total - preview.conTelefono} más sin teléfono, quedan afuera)`
                  : ""}
            </p>
            {preview.muestra.length > 0 && (
              <p className="mt-0.5 text-xs text-piedra">
                Ej: {preview.muestra.join(", ")}
                {preview.total > preview.muestra.length ? "…" : ""}
              </p>
            )}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-borde bg-white p-4 shadow-sm">
        <p className="mb-1 text-sm font-semibold">El mensaje</p>
        <p className="mb-2 text-xs text-piedra">
          {"{nombre}"} se reemplaza por el nombre de cada cliente.
        </p>
        {canal === "email" && (
          <input
            type="text"
            required
            placeholder="Asunto del email (ej: Novedades para tu cocina, {nombre})"
            value={asunto}
            onChange={(e) => setAsunto(e.target.value)}
            className={`${inputCls} mb-2`}
          />
        )}
        <textarea
          value={plantilla}
          onChange={(e) => setPlantilla(e.target.value)}
          rows={canal === "email" ? 7 : 4}
          className={inputCls}
        />
        {canal === "email" && (
          <p className="mt-1.5 text-xs text-piedra">
            Sale como <b>comunicacion@gastroware.com.ar</b>, las respuestas
            llegan a <b>info@</b>. El email lleva tu logo, la firma y el link
            de baja automáticamente.
          </p>
        )}
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={crear}
        disabled={
          pending ||
          !nombre.trim() ||
          !plantilla.trim() ||
          (canal === "email" && !asunto.trim())
        }
        className="w-full rounded-2xl bg-tinta py-3 font-medium text-white disabled:opacity-60"
      >
        {pending ? "Creando…" : "Crear campaña y empezar a mandar"}
      </button>
      <p className="text-xs text-piedra">
        Los clientes marcados como &quot;no contactar&quot; quedan afuera
        siempre.{" "}
        {canal === "whatsapp"
          ? "Los mensajes salen por tu WhatsApp, uno por uno, con tu aprobación en cada envío."
          : "Los emails salen por tandas que disparás vos desde la campaña (así cuidamos el límite diario y la reputación del dominio)."}
      </p>
    </div>
  );
}
