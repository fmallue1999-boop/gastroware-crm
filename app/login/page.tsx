"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Logo from "@/components/Logo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const configurado = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    const supabase = createClient();
    let error;
    try {
      ({ error } = await supabase.auth.signInWithPassword({
        email,
        password,
      }));
    } catch {
      error = { message: "fetch" };
    }
    setCargando(false);
    if (error) {
      setError(
        error.message?.includes("Invalid login credentials")
          ? "Email o contraseña incorrectos."
          : "No se pudo conectar con el servidor. Puede ser un problema de internet o una caída temporal del servicio — probá de nuevo en unos minutos."
      );
      return;
    }
    router.push("/hoy");
    router.refresh();
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo tamano="lg" />
          <h1 className="mt-4 text-2xl font-bold tracking-tight">
            GastroWare <span className="font-medium text-piedra">CRM</span>
          </h1>
          <p className="mt-1 text-sm text-piedra">
            Ventas, servicio técnico y clientes en un solo lugar
          </p>
        </div>

        {!configurado ? (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm">
            <p className="mb-1 font-medium">Falta configurar Supabase</p>
            <p>
              Copiá <code>.env.example</code> a <code>.env.local</code>,
              completá las claves del proyecto y reiniciá el servidor. Los
              pasos completos están en el README.
            </p>
          </div>
        ) : (
          <form
            onSubmit={entrar}
            className="space-y-3 rounded-3xl border border-borde bg-white p-6 shadow-sm"
          >
            <input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-borde bg-white px-4 py-3 text-base outline-none transition-colors focus:border-tinta"
            />
            <input
              type="password"
              required
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-borde bg-white px-4 py-3 text-base outline-none transition-colors focus:border-tinta"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={cargando}
              className="w-full rounded-2xl bg-tinta py-3.5 font-semibold text-white transition-transform active:scale-[0.99] disabled:opacity-60"
            >
              {cargando ? "Entrando…" : "Entrar"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
