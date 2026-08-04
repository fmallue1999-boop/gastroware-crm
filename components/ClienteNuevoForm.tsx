"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { buscarClientePorTelefono, crearCliente } from "@/lib/actions";
import { telefonoProlijo, normalizarTelefono } from "@/lib/format";
import { RUBROS } from "@/lib/constants";
import type { Cliente } from "@/lib/types";

const inputCls =
  "w-full rounded-2xl border border-borde bg-white shadow-sm px-4 py-3 text-base outline-none focus:border-tinta";

export default function ClienteNuevoForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [rubro, setRubro] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [cuit, setCuit] = useState("");
  const [email, setEmail] = useState("");
  const [notas, setNotas] = useState("");
  const [duplicado, setDuplicado] = useState<Cliente | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Aviso de duplicado por teléfono mientras escribe
  useEffect(() => {
    const digitos = normalizarTelefono(telefono);
    if (digitos.length < 8) {
      setDuplicado(null);
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setDuplicado(await buscarClientePorTelefono(digitos));
    }, 400);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [telefono]);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (duplicado) return;
    setError(null);
    startTransition(async () => {
      const res = await crearCliente({
        nombre_comercial: nombre,
        telefono: normalizarTelefono(telefono) || undefined,
        rubro,
        ciudad,
        razon_social: razonSocial,
        cuit,
        email,
        notas,
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      router.push(`/clientes/${res.id}`);
    });
  }

  return (
    <form onSubmit={enviar} className="space-y-3">
      <input
        type="text"
        required
        placeholder="Nombre del negocio"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        className={inputCls}
      />

      <input
        type="tel"
        placeholder="Teléfono / WhatsApp (opcional, pegalo como venga)"
        value={telefono}
        onChange={(e) => setTelefono(e.target.value)}
        onBlur={() => setTelefono(telefono ? telefonoProlijo(telefono) : "")}
        onPaste={(e) => {
          e.preventDefault();
          setTelefono(telefonoProlijo(e.clipboardData.getData("text")));
        }}
        className={inputCls}
      />

      {duplicado && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <p className="font-medium">
            Ese teléfono ya está cargado: {duplicado.nombre_comercial}
          </p>
          <p className="mt-0.5">
            No hace falta crearlo de nuevo.{" "}
            <Link href={`/clientes/${duplicado.id}`} className="underline">
              Abrir su ficha
            </Link>
          </p>
        </div>
      )}

      <select
        required
        value={rubro}
        onChange={(e) => setRubro(e.target.value)}
        className={inputCls}
      >
        <option value="">Rubro…</option>
        {RUBROS.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>

      <input
        type="text"
        placeholder="Ciudad (opcional)"
        value={ciudad}
        onChange={(e) => setCiudad(e.target.value)}
        className={inputCls}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          type="text"
          placeholder="Razón social (opcional)"
          value={razonSocial}
          onChange={(e) => setRazonSocial(e.target.value)}
          className={inputCls}
        />
        <input
          type="text"
          placeholder="CUIT (opcional)"
          value={cuit}
          onChange={(e) => setCuit(e.target.value)}
          className={inputCls}
        />
      </div>

      <input
        type="email"
        placeholder="Email (opcional)"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={inputCls}
      />

      <textarea
        placeholder="Notas (opcional): cómo lo conociste, qué tiene, qué compra…"
        value={notas}
        onChange={(e) => setNotas(e.target.value)}
        rows={2}
        className={inputCls}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending || !!duplicado}
        className="w-full rounded-2xl bg-tinta py-3.5 font-medium text-white disabled:opacity-60"
      >
        {pending ? "Creando…" : "Crear cliente"}
      </button>
      <p className="text-center text-xs text-piedra">
        Esto carga el cliente a la cartera, sin abrir una consulta. Si te está
        consultando por un producto, usá{" "}
        <Link href="/alta" className="underline">
          Nuevo lead
        </Link>
        .
      </p>
    </form>
  );
}
