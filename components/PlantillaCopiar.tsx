"use client";

import { useState } from "react";
import { linkWhatsApp } from "@/lib/format";

export default function PlantillaCopiar({
  nombre,
  texto,
  telefono,
}: {
  nombre: string;
  texto: string;
  telefono: string | null;
}) {
  const [abierto, setAbierto] = useState(false);
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    await navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }

  return (
    <div className="rounded-lg border border-borde">
      <button
        onClick={() => setAbierto(!abierto)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium"
      >
        {nombre}
        <span className="text-piedra/80">{abierto ? "−" : "+"}</span>
      </button>
      {abierto && (
        <div className="border-t border-crema-deep p-3">
          <p className="text-sm text-tinta/70 whitespace-pre-wrap">
            {texto}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={copiar}
              className="rounded-lg border border-borde px-3 py-1.5 text-xs"
            >
              {copiado ? "¡Copiado!" : "Copiar"}
            </button>
            {telefono && (
              <a
                href={linkWhatsApp(telefono, texto)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white"
              >
                Enviar por WhatsApp
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
