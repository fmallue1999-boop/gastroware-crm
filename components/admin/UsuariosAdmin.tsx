"use client";

import { useState, useTransition } from "react";
import { UserPlus } from "lucide-react";
import { crearUsuario, actualizarUsuario } from "@/lib/actions";
import { ROLES } from "@/lib/constants";
import type { Usuario } from "@/lib/types";

const inputCls =
  "w-full rounded-2xl border border-borde bg-white shadow-sm px-3 py-2.5 text-sm outline-none focus:border-tinta";

function etiquetaRol(rol: string) {
  return ROLES.find((r) => r.value === rol)?.label ?? rol;
}

function FilaUsuario({
  u,
  esDireccion,
}: {
  u: Usuario;
  esDireccion: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const cambiar = (patch: { rol?: string; activo?: boolean }) => {
    setError(null);
    startTransition(async () => {
      const res = await actualizarUsuario(u.id, patch);
      if (res && "error" in res && res.error) setError(res.error);
    });
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borde/60 px-4 py-3 last:border-0">
      <div className="min-w-40">
        <p className={`text-sm font-medium ${u.activo ? "" : "text-piedra line-through"}`}>
          {u.nombre}
        </p>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
      <div className="flex items-center gap-2">
        {esDireccion ? (
          <select
            value={u.rol}
            disabled={pending}
            onChange={(e) => cambiar({ rol: e.target.value })}
            className="rounded-xl border border-borde bg-white px-2.5 py-1.5 text-sm"
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        ) : (
          <span className="rounded-full bg-celeste-soft px-2.5 py-1 text-xs font-medium text-sky-800">
            {etiquetaRol(u.rol)}
          </span>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => cambiar({ activo: !u.activo })}
          className={`rounded-xl px-3 py-1.5 text-xs font-medium ${
            u.activo
              ? "border border-borde text-piedra hover:bg-crema"
              : "bg-green-600 text-white"
          }`}
        >
          {u.activo ? "Desactivar" : "Reactivar"}
        </button>
      </div>
    </div>
  );
}

export default function UsuariosAdmin({
  usuarios,
  esDireccion,
}: {
  usuarios: Usuario[];
  esDireccion: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [pending, startTransition] = useTransition();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState("comercial");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const rolesDisponibles = esDireccion
    ? ROLES
    : ROLES.filter((r) => !["direccion", "admin"].includes(r.value));

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    startTransition(async () => {
      const res = await crearUsuario({
        email,
        nombre,
        rol,
        passwordInicial: password,
      });
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      setOk(
        `Usuario creado. Pasale a ${nombre} el mail y la contraseña inicial para que entre (y la cambie).`
      );
      setNombre("");
      setEmail("");
      setPassword("");
      setAbierto(false);
    });
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-borde bg-white shadow-sm">
        {usuarios.map((u) => (
          <FilaUsuario key={u.id} u={u} esDireccion={esDireccion} />
        ))}
        {usuarios.length === 0 && (
          <p className="p-4 text-sm text-piedra">Sin usuarios visibles.</p>
        )}
      </div>

      {ok && (
        <p className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {ok}
        </p>
      )}

      {!abierto ? (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="inline-flex items-center gap-1.5 rounded-2xl bg-tinta px-4 py-2.5 text-sm font-medium text-white"
        >
          <UserPlus className="h-4 w-4" /> Crear usuario
        </button>
      ) : (
        <form
          onSubmit={enviar}
          className="space-y-3 rounded-2xl border border-borde bg-white p-4 shadow-sm"
        >
          <p className="text-sm font-semibold">Nuevo usuario</p>
          <input
            type="text"
            required
            placeholder="Nombre y apellido"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className={inputCls}
          />
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={rol}
              onChange={(e) => setRol(e.target.value)}
              className={inputCls}
            >
              {rolesDisponibles.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              required
              minLength={8}
              placeholder="Contraseña inicial"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-2xl bg-tinta px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {pending ? "Creando…" : "Crear"}
            </button>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="rounded-2xl border border-borde px-4 py-2.5 text-sm text-piedra"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
