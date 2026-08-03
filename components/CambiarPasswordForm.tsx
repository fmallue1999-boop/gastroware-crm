"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

const inputCls =
  "w-full rounded-2xl border border-borde bg-white shadow-sm px-3 py-2.5 text-sm outline-none focus:border-tinta";

export default function CambiarPasswordForm() {
  const [pending, startTransition] = useTransition();
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (nueva.length < 8) {
      setError("Usá al menos 8 caracteres.");
      return;
    }
    if (nueva !== repetida) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    startTransition(async () => {
      const supabase = createClient();
      const { error: err } = await supabase.auth.updateUser({
        password: nueva,
      });
      if (err) {
        setError(
          err.message.includes("different from the old")
            ? "La contraseña nueva tiene que ser distinta a la actual."
            : err.message
        );
        return;
      }
      setListo(true);
      setNueva("");
      setRepetida("");
    });
  }

  if (listo) {
    return (
      <p className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        Contraseña cambiada. Desde ahora entrás con la nueva.
      </p>
    );
  }

  return (
    <form onSubmit={enviar} className="space-y-3">
      <input
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        placeholder="Contraseña nueva (mínimo 8)"
        value={nueva}
        onChange={(e) => setNueva(e.target.value)}
        className={inputCls}
      />
      <input
        type="password"
        required
        autoComplete="new-password"
        placeholder="Repetila para confirmar"
        value={repetida}
        onChange={(e) => setRepetida(e.target.value)}
        className={inputCls}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-2xl bg-tinta py-3 font-medium text-white disabled:opacity-60"
      >
        {pending ? "Cambiando…" : "Cambiar contraseña"}
      </button>
    </form>
  );
}
