"use client";

import { useState, useTransition } from "react";
import { setConfigValor } from "@/lib/actions";

type Opcion = { id: string; nombre: string; detalle: string };

/** Elegir qué modelo de IA usa todo el sistema. */
export default function ModeloIA({ actual, opciones }: { actual: string; opciones: Opcion[] }) {
  const [pending, startTransition] = useTransition();
  const [elegido, setElegido] = useState(actual);
  const [msg, setMsg] = useState<{ texto: string; error?: boolean } | null>(null);

  function elegir(id: string) {
    const anterior = elegido;
    setElegido(id);
    setMsg(null);
    startTransition(async () => {
      const r = await setConfigValor("ia_modelo", id);
      if (r && "error" in r && r.error) {
        setElegido(anterior);
        setMsg({ texto: r.error, error: true });
      } else setMsg({ texto: "Guardado ✓" });
    });
  }

  return (
    <div className="space-y-2">
      {opciones.map((o) => (
        <label
          key={o.id}
          className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${
            elegido === o.id ? "border-violeta bg-violeta-soft" : "border-borde bg-white"
          }`}
        >
          <input
            type="radio"
            name="modelo"
            checked={elegido === o.id}
            disabled={pending}
            onChange={() => elegir(o.id)}
            className="mt-1 accent-violeta"
          />
          <span>
            <span className="block text-[15px] font-bold">{o.nombre}</span>
            <span className="block text-sm text-piedra">{o.detalle}</span>
          </span>
        </label>
      ))}
      {msg && <p className={`text-sm font-bold ${msg.error ? "text-red-600" : "text-verde"}`}>{msg.texto}</p>}
    </div>
  );
}
