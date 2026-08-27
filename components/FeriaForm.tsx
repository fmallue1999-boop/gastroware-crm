"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, Check, Sparkles } from "lucide-react";
import { crearLeadFeria, iaLeerCredencial } from "@/lib/actions";
import { telefonoProlijo } from "@/lib/format";
import { RUBROS, LINEAS_FERIA, PROVINCIAS_AR } from "@/lib/constants";

const inputCls =
  "w-full rounded-2xl border border-borde bg-white shadow-sm px-4 py-3.5 text-base outline-none focus:border-tinta";

/** Reduce la foto a máx 1100px y la devuelve como JPEG base64 (sin prefijo). */
async function comprimirFoto(archivo: File): Promise<string> {
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, 1100 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.78);
  return dataUrl.split(",")[1];
}

export default function FeriaForm({
  iaOn,
  contadorInicial,
}: {
  iaOn: boolean;
  contadorInicial: number;
}) {
  const [pending, startTransition] = useTransition();
  const fotoInput = useRef<HTMLInputElement>(null);
  const [foto, setFoto] = useState<string | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [lineas, setLineas] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [rubro, setRubro] = useState("");
  const [provincia, setProvincia] = useState("");
  const [nota, setNota] = useState("");
  const [contador, setContador] = useState(contadorInicial);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function tomarFoto(archivo: File | null) {
    if (!archivo) return;
    setError(null);
    const base64 = await comprimirFoto(archivo);
    setFoto(base64);
    if (!iaOn) return;
    setLeyendo(true);
    const res = await iaLeerCredencial(base64);
    setLeyendo(false);
    if ("error" in res && res.error) {
      setError(`La IA no pudo leer la credencial (${res.error}). Cargá a mano.`);
      return;
    }
    if ("nombre" in res) {
      // Solo completa lo que está vacío: no pisa lo que ya se tipeó
      if (res.nombre && !nombre) setNombre(res.nombre);
      if (res.apellido && !apellido) setApellido(res.apellido);
      if (res.empresa && !empresa) setEmpresa(res.empresa);
      if (res.email && !email) setEmail(res.email);
      if (res.telefono && !telefono) setTelefono(telefonoProlijo(res.telefono));
      if (res.rubro && !rubro) setRubro(res.rubro);
      if (res.provincia && !provincia) setProvincia(res.provincia);
    }
  }

  function limpiar() {
    setFoto(null);
    setNombre("");
    setApellido("");
    setEmpresa("");
    setLineas([]);
    setEmail("");
    setTelefono("");
    setRubro("");
    setProvincia("");
    setNota("");
    if (fotoInput.current) fotoInput.current.value = "";
  }

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await crearLeadFeria({
        nombre,
        apellido,
        empresa,
        email,
        telefono,
        lineas,
        rubro,
        provincia,
        nota,
        fotoBase64: foto ?? undefined,
      });
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      if ("ok" in res) {
        const n = contador + 1;
        setContador(n);
        setFlash(
          res.existente
            ? `✓ Ya estaba en la base: se le sumó la consulta (${n} cargados)`
            : `✓ Cargado (${n} en la feria)`
        );
        limpiar();
        setTimeout(() => setFlash(null), 2500);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  const chip = (activo: boolean) =>
    `rounded-full px-4 py-2.5 text-sm font-medium ${
      activo ? "bg-tinta text-white" : "border border-borde bg-white text-piedra"
    }`;

  return (
    <form onSubmit={guardar} className="space-y-3">
      {flash && (
        <p className="rounded-2xl border border-green-300 bg-green-50 px-4 py-3 text-center text-sm font-semibold text-green-800">
          {flash}
        </p>
      )}

      {/* Foto de la credencial: el atajo estrella */}
      <input
        ref={fotoInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => tomarFoto(e.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        onClick={() => fotoInput.current?.click()}
        disabled={leyendo}
        className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-semibold ${
          foto
            ? "border border-green-300 bg-green-50 text-green-800"
            : "bg-tinta text-white"
        }`}
      >
        {leyendo ? (
          <>
            <Sparkles className="h-5 w-5 animate-pulse" /> Leyendo credencial…
          </>
        ) : foto ? (
          <>
            <Check className="h-5 w-5" /> Foto lista — tocá para cambiarla
          </>
        ) : (
          <>
            <Camera className="h-5 w-5" /> Foto de la credencial
          </>
        )}
      </button>
      {iaOn && !foto && (
        <p className="-mt-1 text-center text-xs text-piedra">
          La IA lee la credencial y te precarga los datos. También podés cargar
          a mano directamente.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          placeholder="Nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className={inputCls}
        />
        <input
          type="text"
          placeholder="Apellido"
          value={apellido}
          onChange={(e) => setApellido(e.target.value)}
          className={inputCls}
        />
      </div>

      <input
        type="text"
        placeholder="Empresa / negocio"
        value={empresa}
        onChange={(e) => setEmpresa(e.target.value)}
        className={inputCls}
      />

      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-piedra">
          Línea de interés
        </p>
        <div className="flex flex-wrap gap-1.5">
          {LINEAS_FERIA.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() =>
                setLineas(
                  lineas.includes(l)
                    ? lineas.filter((x) => x !== l)
                    : [...lineas, l]
                )
              }
              className={chip(lineas.includes(l))}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <input
        type="email"
        placeholder="Correo electrónico"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={inputCls}
      />

      <input
        type="tel"
        placeholder="Teléfono / WhatsApp"
        value={telefono}
        onChange={(e) => setTelefono(e.target.value)}
        onBlur={() => telefono && setTelefono(telefonoProlijo(telefono))}
        className={inputCls}
      />

      <div className="grid grid-cols-2 gap-2">
        <select
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
        <select
          value={provincia}
          onChange={(e) => setProvincia(e.target.value)}
          className={inputCls}
        >
          <option value="">Provincia…</option>
          {PROVINCIAS_AR.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      <input
        type="text"
        placeholder="Nota rápida (opcional): qué buscaba, cuándo llamarlo…"
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        className={inputCls}
      />

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || leyendo}
        className="w-full rounded-2xl bg-tinta py-4 text-base font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Guardar y siguiente →"}
      </button>
      <p className="text-center text-xs text-piedra">
        Si el teléfono o email ya están en la base, no se duplica: se le suma
        la consulta al cliente existente.
      </p>
    </form>
  );
}
