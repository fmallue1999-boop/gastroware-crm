"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { cargarFactura } from "@/lib/actions";
import ClienteSelector, { type ClienteElegido } from "@/components/ClienteSelector";

const cls = "min-h-11 w-full rounded-xl border border-borde bg-white px-3 text-[15px] outline-none focus:border-marino";

/** Factura cargada a mano (service, consumible o repuesto): queda en Cobranzas con su vencimiento. */
export default function CargarFactura({ hoy }: { hoy: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [cliente, setCliente] = useState<ClienteElegido | null>(null);
  const [tipo, setTipo] = useState<"servicio" | "consumible" | "repuesto" | "venta">("consumible");
  const [numero, setNumero] = useState("");
  const [fecha, setFecha] = useState(hoy);
  const [vence, setVence] = useState(hoy);
  const [monto, setMonto] = useState("");
  const [moneda, setMoneda] = useState("ARS");
  const [error, setError] = useState<string | null>(null);

  if (!abierto)
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-marino px-4 text-[15px] font-extrabold text-white"
      >
        <Plus className="h-4 w-4" /> Cargar factura
      </button>
    );

  return (
    <form
      className="space-y-2 rounded-2xl bg-white p-4 shadow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        if (!cliente) {
          setError("Elegí el cliente");
          return;
        }
        setError(null);
        startTransition(async () => {
          const r = await cargarFactura({
            clienteId: cliente.id,
            tipo,
            numero,
            fecha,
            vencimiento: vence,
            monto: monto ? Number(monto.replace(/\./g, "").replace(",", ".")) : null,
            moneda,
          });
          if (r && "error" in r && r.error) setError(r.error);
          else {
            setAbierto(false);
            setCliente(null);
            setNumero("");
            setMonto("");
            router.refresh();
          }
        });
      }}
    >
      <p className="text-[15px] font-extrabold">Nueva factura para cobrar</p>
      <ClienteSelector valor={cliente} onChange={setCliente} />
      <div className="grid gap-2 sm:grid-cols-2">
        <select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} className={cls} aria-label="Tipo">
          <option value="consumible">Consumible</option>
          <option value="repuesto">Repuesto</option>
          <option value="servicio">Service</option>
          <option value="venta">Venta de equipo</option>
        </select>
        <input required value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="N° de factura" className={cls} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-piedra">
          Fecha
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={cls} />
        </label>
        <label className="text-xs text-piedra">
          Vence
          <input type="date" value={vence} onChange={(e) => setVence(e.target.value)} className={cls} />
        </label>
      </div>
      <div className="flex gap-2">
        <input inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="Monto" className={cls} />
        <select value={moneda} onChange={(e) => setMoneda(e.target.value)} className={`${cls} w-24`} aria-label="Moneda">
          <option value="ARS">$</option>
          <option value="USD">USD</option>
        </select>
      </div>
      {error && <p className="text-[14px] font-bold text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button disabled={pending} className="min-h-11 rounded-xl bg-marino px-4 text-[15px] font-extrabold text-white disabled:opacity-50">
          {pending ? "Guardando…" : "Guardar"}
        </button>
        <button type="button" onClick={() => setAbierto(false)} className="min-h-11 rounded-xl border border-borde px-4 text-[15px] text-piedra">
          Cancelar
        </button>
      </div>
    </form>
  );
}
