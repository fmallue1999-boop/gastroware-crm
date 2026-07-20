"use client";

import { useState, useTransition } from "react";
import { guardarDiagnostico } from "@/lib/actions";

const inputCls =
  "w-full rounded-xl border border-borde bg-white px-3 py-2.5 text-sm outline-none focus:border-tinta";

type Diag = Record<string, string | number | null>;

export default function DiagnosticoForm({
  oportunidadId,
  categoria,
  diagnostico,
}: {
  oportunidadId: string;
  categoria: string;
  diagnostico: Diag;
}) {
  const [pending, startTransition] = useTransition();
  const [d, setD] = useState<Diag>(diagnostico);
  const [guardado, setGuardado] = useState(false);

  const set = (k: string, v: string) =>
    setD((prev) => ({ ...prev, [k]: v === "" ? null : v }));
  const num = (k: string) => Number(d[k]) || 0;

  // Cuenta de recupero Zumex (en vivo)
  const margenVaso = num("precio_vaso") - num("costo_naranja_vaso") - num("otros_costos_vaso");
  const diasMes = num("dias_mes") || 26;
  const margenMensual = num("vasos_dia") * margenVaso * diasMes;
  const recuperoMeses =
    margenMensual > 0 && num("valor_equipo") > 0
      ? num("valor_equipo") / margenMensual
      : 0;

  function guardar() {
    startTransition(async () => {
      const payload: Diag = { ...d };
      if (categoria === "exprimidora" && recuperoMeses > 0) {
        payload.recupero_meses = Math.round(recuperoMeses * 10) / 10;
        payload.margen_mensual = Math.round(margenMensual);
      }
      await guardarDiagnostico(oportunidadId, payload);
      setGuardado(true);
      setTimeout(() => setGuardado(false), 1500);
    });
  }

  if (categoria === "licuadora") {
    return (
      <div className="space-y-2">
        <select
          value={(d.uso_principal as string) ?? ""}
          onChange={(e) => set("uso_principal", e.target.value)}
          className={inputCls}
        >
          <option value="">Uso principal…</option>
          {["Licuados", "Smoothies", "Frappés", "Hielo", "Tragos", "Cocina", "Otro"].map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
        <input
          type="number"
          placeholder="Usos estimados por día"
          value={(d.usos_por_dia as string) ?? ""}
          onChange={(e) => set("usos_por_dia", e.target.value)}
          className={inputCls}
        />
        <input
          type="text"
          placeholder="Equipo actual (marca/modelo o «ninguno»)"
          value={(d.equipo_actual as string) ?? ""}
          onChange={(e) => set("equipo_actual", e.target.value)}
          className={inputCls}
        />
        <select
          value={(d.problema_actual as string) ?? ""}
          onChange={(e) => set("problema_actual", e.target.value)}
          className={inputCls}
        >
          <option value="">Problema actual…</option>
          {["Roturas", "Ruido", "Lentitud", "Calidad", "Falta de potencia", "Ninguno"].map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <BotonGuardar pending={pending} guardado={guardado} onClick={guardar} />
      </div>
    );
  }

  if (categoria === "exprimidora") {
    return (
      <div className="space-y-2">
        <select
          value={(d.punto_de_venta as string) ?? ""}
          onChange={(e) => set("punto_de_venta", e.target.value)}
          className={inputCls}
        >
          <option value="">Punto de venta…</option>
          {["Desayuno", "Take away", "Barra", "Autoservicio", "Supermercado", "Estación"].map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <input type="number" placeholder="Vasos por día" value={(d.vasos_dia as string) ?? ""} onChange={(e) => set("vasos_dia", e.target.value)} className={inputCls} />
          <input type="number" placeholder="Precio por vaso $" value={(d.precio_vaso as string) ?? ""} onChange={(e) => set("precio_vaso", e.target.value)} className={inputCls} />
          <input type="number" placeholder="Costo naranja/vaso $" value={(d.costo_naranja_vaso as string) ?? ""} onChange={(e) => set("costo_naranja_vaso", e.target.value)} className={inputCls} />
          <input type="number" placeholder="Otros costos/vaso $" value={(d.otros_costos_vaso as string) ?? ""} onChange={(e) => set("otros_costos_vaso", e.target.value)} className={inputCls} />
          <input type="number" placeholder="Días operativos/mes (26)" value={(d.dias_mes as string) ?? ""} onChange={(e) => set("dias_mes", e.target.value)} className={inputCls} />
          <input type="number" placeholder="Valor del equipo $" value={(d.valor_equipo as string) ?? ""} onChange={(e) => set("valor_equipo", e.target.value)} className={inputCls} />
        </div>
        <input
          type="text"
          placeholder="Espacio disponible (opcional)"
          value={(d.espacio as string) ?? ""}
          onChange={(e) => set("espacio", e.target.value)}
          className={inputCls}
        />

        {margenMensual > 0 && (
          <div className="rounded-xl bg-green-50 border border-green-200 p-3 text-sm text-green-900">
            <p>
              Margen bruto mensual:{" "}
              <strong>
                ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(margenMensual)}
              </strong>
            </p>
            {recuperoMeses > 0 && (
              <p>
                Recupero de la inversión:{" "}
                <strong>{(Math.round(recuperoMeses * 10) / 10).toLocaleString("es-AR")} meses</strong>
              </p>
            )}
            <p className="mt-1 text-xs text-green-700">
              Este es el número para mostrar: unidad de negocio, no precio de máquina.
            </p>
          </div>
        )}

        <BotonGuardar pending={pending} guardado={guardado} onClick={guardar} />
      </div>
    );
  }

  return null;
}

function BotonGuardar({
  pending,
  guardado,
  onClick,
}: {
  pending: boolean;
  guardado: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={pending}
      className="w-full rounded-xl border border-tinta py-2.5 text-sm font-medium disabled:opacity-50"
    >
      {guardado ? "✓ Guardado" : pending ? "Guardando…" : "Guardar diagnóstico"}
    </button>
  );
}
