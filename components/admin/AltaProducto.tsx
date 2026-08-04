"use client";

import { useState, useTransition } from "react";
import { PackagePlus } from "lucide-react";
import { crearProducto } from "@/lib/actions";

const inputCls =
  "w-full rounded-2xl border border-borde bg-white shadow-sm px-3 py-2.5 text-sm outline-none focus:border-tinta";

const CATEGORIAS = [
  "exprimidora",
  "licuadora",
  "horno",
  "maquina_cafe",
  "consumible",
  "repuesto",
  "otro",
];

export default function AltaProducto() {
  const [abierto, setAbierto] = useState(false);
  const [pending, startTransition] = useTransition();
  const [nombre, setNombre] = useState("");
  const [marca, setMarca] = useState("");
  const [categoria, setCategoria] = useState("otro");
  const [moneda, setMoneda] = useState("ARS");
  const [precio, setPrecio] = useState("");
  const [garantia, setGarantia] = useState("");
  const [error, setError] = useState<string | null>(null);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await crearProducto({
        nombre,
        marca,
        categoria,
        moneda,
        precio_referencia: precio ? Number(precio) : null,
        garantia_meses: garantia ? Number(garantia) : null,
      });
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      setNombre("");
      setMarca("");
      setPrecio("");
      setGarantia("");
      setAbierto(false);
    });
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-1.5 rounded-2xl bg-tinta px-4 py-2.5 text-sm font-medium text-white"
      >
        <PackagePlus className="h-4 w-4" /> Agregar producto
      </button>
    );
  }

  return (
    <form
      onSubmit={enviar}
      className="space-y-2 rounded-2xl border border-borde bg-white p-4 shadow-sm"
    >
      <p className="text-sm font-semibold">Producto nuevo</p>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          required
          placeholder="Nombre (ej: Zumex Soul Series 2)"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className={inputCls}
        />
        <input
          type="text"
          placeholder="Marca"
          value={marca}
          onChange={(e) => setMarca(e.target.value)}
          className={inputCls}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <select
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          className={inputCls}
        >
          {CATEGORIAS.map((c) => (
            <option key={c} value={c}>
              {c.replace("_", " ")}
            </option>
          ))}
        </select>
        <select
          value={moneda}
          onChange={(e) => setMoneda(e.target.value)}
          className={inputCls}
        >
          <option value="ARS">ARS</option>
          <option value="USD">USD</option>
        </select>
        <input
          type="number"
          min={0}
          placeholder="Precio"
          value={precio}
          onChange={(e) => setPrecio(e.target.value)}
          className={inputCls}
        />
        <input
          type="number"
          min={0}
          placeholder="Garantía (meses)"
          value={garantia}
          onChange={(e) => setGarantia(e.target.value)}
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
          {pending ? "Creando…" : "Crear producto"}
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
  );
}
