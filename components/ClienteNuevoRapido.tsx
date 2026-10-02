"use client";

import { useState, useTransition } from "react";
import { crearClienteRapido, type PosibleDuplicado } from "@/lib/actions";
import { telefonoProlijo } from "@/lib/format";
import { cuitProlijo, cuitValido } from "@/lib/datos-cotizar";

const cls = "min-h-11 w-full rounded-xl border border-borde bg-white px-3 text-[15px] outline-none focus:border-marino";

/**
 * Cargar un cliente nuevo sin salir del formulario (v1.9): persona, negocio,
 * teléfono y localidad. Si el teléfono ya está cargado, pregunta si es ese.
 * Con pedirCuit (venta nueva, v1.19) pide razón social y CUIT; si el CUIT ya
 * está cargado, ofrece usar ese cliente.
 */
export default function ClienteNuevoRapido({
  onElegido,
  onCancelar,
  pedirCuit = false,
}: {
  onElegido: (c: { id: string; nombre: string; razon_social?: string | null; cuit?: string | null }) => void;
  onCancelar: () => void;
  pedirCuit?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [nombre, setNombre] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [telefono, setTelefono] = useState("");
  const [localidad, setLocalidad] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [cuit, setCuit] = useState("");
  const cuitMal = cuit.replace(/\D/g, "").length >= 11 && !cuitValido(cuit);
  const [duplicados, setDuplicados] = useState<PosibleDuplicado[]>([]);
  const [error, setError] = useState<string | null>(null);

  function crear(crearIgual = false) {
    setError(null);
    startTransition(async () => {
      const r = await crearClienteRapido({ nombre, empresa, telefono, localidad, crearIgual, pedirCuit, razonSocial, cuit });
      if ("error" in r) setError(r.error);
      else if ("duplicados" in r) setDuplicados(r.duplicados);
      else onElegido({ id: r.id, nombre: r.nombre, razon_social: r.razon_social, cuit: r.cuit });
    });
  }

  const porCuit = duplicados.some((d) => d.por === "CUIT");
  if (duplicados.length)
    return (
      <div className="space-y-2 rounded-2xl border-2 border-ambar bg-ambar-soft p-3.5">
        <p className="text-[15px] font-extrabold text-ambar">{porCuit ? "Ese CUIT ya está cargado: es este cliente" : "Ojo: ese teléfono ya está cargado"}</p>
        {duplicados.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => onElegido({ id: d.id, nombre: d.nombre, razon_social: d.razon_social, cuit: d.cuit })}
            className="flex w-full items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-left"
          >
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-bold">{d.nombre}</span>
              {(d.cuit || d.telefono) && (
                <span className="block text-xs text-piedra">{[d.cuit ? `CUIT ${cuitProlijo(d.cuit)}` : "", d.telefono ? telefonoProlijo(d.telefono) : ""].filter(Boolean).join(" · ")}</span>
              )}
            </span>
            <span className="shrink-0 text-[14px] font-bold text-marino">Es este: usar</span>
          </button>
        ))}
        {porCuit ? (
          <button type="button" onClick={() => setDuplicados([])} className="min-h-10 w-full rounded-xl border border-borde bg-white text-[14px] font-bold">
            Corregir el CUIT
          </button>
        ) : (
          <button type="button" disabled={pending} onClick={() => crear(true)} className="min-h-10 w-full rounded-xl border border-borde bg-white text-[14px] font-bold disabled:opacity-50">
            Es otro: cargarlo igual
          </button>
        )}
      </div>
    );

  return (
    <div className="space-y-2 rounded-2xl bg-white p-3.5 shadow-sm">
      <p className="text-[15px] font-extrabold">Cliente nuevo</p>
      {pedirCuit && (
        <>
          <input autoFocus value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} placeholder="Razón social (como va en la factura)" className={cls} />
          <input
            inputMode="numeric"
            value={cuit}
            onChange={(e) => setCuit(e.target.value)}
            placeholder="CUIT (ej: 30-71234567-8)"
            className={`${cls} ${cuitMal ? "border-red-400" : ""}`}
          />
          {cuitMal && <p className="text-xs font-bold text-red-600">Ese CUIT no es válido: revisá los números.</p>}
        </>
      )}
      <input
        autoFocus={!pedirCuit}
        value={empresa}
        onChange={(e) => setEmpresa(e.target.value)}
        placeholder={pedirCuit ? "Nombre del negocio (si es distinto)" : "Negocio o empresa"}
        className={cls}
      />
      <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre de la persona" className={cls} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Teléfono / WhatsApp" className={cls} />
        <input value={localidad} onChange={(e) => setLocalidad(e.target.value)} placeholder="Localidad" className={cls} />
      </div>
      {error && <p className="text-sm font-bold text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={pending || (pedirCuit ? !razonSocial.trim() || !cuitValido(cuit) : !nombre.trim() && !empresa.trim())}
          onClick={() => crear()}
          className="min-h-11 rounded-xl bg-marino px-4 text-[15px] font-bold text-white disabled:opacity-50"
        >
          {pending ? "Cargando…" : "Cargar cliente"}
        </button>
        <button type="button" onClick={onCancelar} className="text-sm text-azul underline">
          Buscar en la base
        </button>
      </div>
    </div>
  );
}
