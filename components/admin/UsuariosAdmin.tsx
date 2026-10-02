"use client";

import { useState, useTransition } from "react";
import { UserPlus } from "lucide-react";
import { crearUsuario, actualizarUsuario } from "@/lib/actions";
import { PUESTOS, nombrePuesto } from "@/lib/puestos";
import type { Usuario } from "@/lib/types";

const inputCls =
  "min-h-11 w-full rounded-xl border border-borde bg-white px-3 py-2 text-[15px] outline-none focus:border-marino";

type TerritorioMin = { codigo: string; nombre: string };

function FilaUsuario({
  u,
  esDireccion,
  esGestor,
  territorios,
}: {
  u: Usuario;
  esDireccion: boolean;
  esGestor: boolean;
  territorios: TerritorioMin[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [telefono, setTelefono] = useState(u.telefono ?? "");
  const [guardado, setGuardado] = useState(false);

  const cambiar = (patch: Parameters<typeof actualizarUsuario>[1]) => {
    setError(null);
    startTransition(async () => {
      const res = await actualizarUsuario(u.id, patch);
      if (res && "error" in res && res.error) setError(res.error);
      else {
        setGuardado(true);
        setTimeout(() => setGuardado(false), 1500);
      }
    });
  };
  const detalle = PUESTOS.find((p) => p.value === u.rol)?.detalle;
  const vende = ["comercial", "direccion"].includes(u.rol);

  return (
    <div className="grid gap-2 border-b border-borde/60 px-4 py-3 last:border-0 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(0,1fr)_auto] lg:items-center">
      <div className="min-w-0">
        <p className={`text-[15px] font-extrabold ${u.activo ? "" : "text-piedra line-through"}`}>
          {u.nombre} {guardado && <span className="text-xs font-bold text-verde">✓ guardado</span>}
        </p>
        {detalle && <p className="text-xs text-piedra">{detalle}</p>}
        {error && <p className="text-xs font-bold text-red-600">{error}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {esDireccion ? (
          <select
            value={u.rol}
            disabled={pending}
            onChange={(e) => cambiar({ rol: e.target.value })}
            aria-label="Puesto"
            className={`${inputCls} lg:w-auto lg:flex-1`}
          >
            {PUESTOS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        ) : (
          <span className="rounded-full bg-celeste-soft px-2.5 py-1 text-xs font-bold text-azul">{nombrePuesto(u.rol)}</span>
        )}
        {vende && (
          <select
            value={u.territorio ?? ""}
            disabled={pending || !esGestor}
            onChange={(e) => cambiar({ territorio: e.target.value || null })}
            aria-label="Territorio"
            className={`${inputCls} lg:w-auto lg:flex-1`}
          >
            <option value="">Sin territorio</option>
            {territorios.map((t) => (
              <option key={t.codigo} value={t.codigo}>
                {t.nombre}
              </option>
            ))}
          </select>
        )}
      </div>
      <input
        value={telefono}
        onChange={(e) => setTelefono(e.target.value)}
        onBlur={() => telefono !== (u.telefono ?? "") && cambiar({ telefono })}
        placeholder="Teléfono (WhatsApp)"
        aria-label="Teléfono"
        className={inputCls}
      />
      {esGestor && (
        <div className="flex flex-wrap items-center gap-2">
          {!["marketing", "direccion", "admin"].includes(u.rol) && (
            <label className="flex min-h-11 items-center gap-2 text-[13px] font-semibold" title="Marketing y dirección lo ven siempre">
              <input
                type="checkbox"
                checked={Boolean(u.ve_contenidos)}
                disabled={pending}
                onChange={(e) => cambiar({ ve_contenidos: e.target.checked })}
                className="h-5 w-5"
              />
              Ve el calendario de contenidos
            </label>
          )}
          <label className="flex min-h-11 items-center gap-2 text-[13px] font-semibold" title="Puede volver una venta a otro paso (por ejemplo, un cobro registrado por error)">
            <input
              type="checkbox"
              checked={Boolean(u.corrige_ventas)}
              disabled={pending}
              onChange={(e) => cambiar({ corrige_ventas: e.target.checked })}
              className="h-5 w-5"
            />
            Puede corregir ventas
          </label>
        <button
          type="button"
          disabled={pending}
          onClick={() => cambiar({ activo: !u.activo })}
          className={`min-h-11 rounded-xl px-3 text-[14px] font-bold ${
            u.activo ? "border border-borde text-piedra hover:bg-crema" : "bg-verde text-white"
          }`}
        >
          {u.activo ? "Desactivar" : "Reactivar"}
        </button>
        </div>
      )}
    </div>
  );
}

/**
 * Equipo por puestos: cada usuario tiene un puesto (lo cambia dirección) y,
 * si vende, un territorio. Cuando alguien entra, sale o cambia de puesto se
 * cambia acá y el CRM se reacomoda solo.
 */
export default function UsuariosAdmin({
  usuarios,
  esDireccion,
  esGestor = esDireccion,
  territorios = [],
}: {
  usuarios: Usuario[];
  esDireccion: boolean;
  esGestor?: boolean;
  territorios?: TerritorioMin[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [pending, startTransition] = useTransition();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState("comercial");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const puestosDisponibles = esDireccion ? PUESTOS : PUESTOS.filter((r) => !["direccion", "admin"].includes(r.value));
  const orden = PUESTOS.map((p) => p.value as string);
  const lista = [...usuarios].sort(
    (a, b) =>
      Number(b.activo) - Number(a.activo) || orden.indexOf(a.rol) - orden.indexOf(b.rol) || a.nombre.localeCompare(b.nombre)
  );

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    startTransition(async () => {
      const res = await crearUsuario({ email, nombre, rol, passwordInicial: password });
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      setOk(`Usuario creado. Pasale el mail y la contraseña inicial para que entre (y la cambie).`);
      setNombre("");
      setEmail("");
      setPassword("");
      setAbierto(false);
    });
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-extrabold">Equipo y puestos</h2>
        <p className="text-[14px] text-piedra">
          El puesto define qué ve cada uno al entrar y qué puede hacer. El nombre de la persona no importa: importa el puesto.
        </p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-borde bg-white shadow-sm">
        {lista.map((u) => (
          <FilaUsuario key={u.id} u={u} esDireccion={esDireccion} esGestor={esGestor} territorios={territorios} />
        ))}
        {lista.length === 0 && <p className="p-4 text-sm text-piedra">Sin usuarios visibles.</p>}
      </div>

      {ok && <p className="rounded-2xl bg-verde-soft px-4 py-3 text-[15px] font-bold text-verde">{ok}</p>}

      {!abierto ? (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-marino px-4 text-[15px] font-extrabold text-white"
        >
          <UserPlus className="h-4 w-4" /> Crear usuario
        </button>
      ) : (
        <form onSubmit={enviar} className="space-y-3 rounded-2xl border border-borde bg-white p-4 shadow-sm">
          <p className="text-[15px] font-extrabold">Nuevo usuario</p>
          <input type="text" required placeholder="Nombre y apellido" value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputCls} />
          <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <select value={rol} onChange={(e) => setRol(e.target.value)} className={inputCls} aria-label="Puesto">
              {puestosDisponibles.map((r) => (
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
          {error && <p className="text-sm font-bold text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="min-h-11 rounded-xl bg-marino px-4 text-[15px] font-extrabold text-white disabled:opacity-60">
              {pending ? "Creando…" : "Crear"}
            </button>
            <button type="button" onClick={() => setAbierto(false)} className="min-h-11 rounded-xl border border-borde px-4 text-[15px] text-piedra">
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
