import { ETAPAS, ESTADOS_OT } from "@/lib/constants";

export function EstadoOTBadge({ estado }: { estado: string }) {
  const estilos: Record<string, string> = {
    abierta: "bg-celeste-soft text-sky-800",
    en_proceso: "bg-amber-100 text-amber-700",
    cerrada_tecnico: "bg-purple-100 text-purple-700",
    facturable: "bg-orange-100 text-orange-700",
    facturada: "bg-green-100 text-green-700",
    anulada: "bg-crema-deep text-piedra",
  };
  const label = ESTADOS_OT.find((e) => e.value === estado)?.label ?? estado;
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${estilos[estado] ?? ""}`}
    >
      {label}
    </span>
  );
}

export function TempBadge({ temperatura }: { temperatura: string | null }) {
  if (!temperatura) return null;
  const estilos: Record<string, string> = {
    caliente: "bg-red-100 text-red-700",
    tibio: "bg-amber-100 text-amber-700",
    frio: "bg-crema-deep text-piedra",
  };
  const labels: Record<string, string> = {
    caliente: "Caliente",
    tibio: "Tibio",
    frio: "Frío",
  };
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${estilos[temperatura] ?? ""}`}
    >
      {labels[temperatura] ?? temperatura}
    </span>
  );
}

export function EtapaBadge({ etapa }: { etapa: string }) {
  const estilos: Record<string, string> = {
    nueva: "bg-celeste-soft text-sky-800",
    diagnostico: "bg-purple-100 text-purple-700",
    cotizada: "bg-amber-100 text-amber-700",
    seguimiento: "bg-cyan-100 text-cyan-700",
    negociacion: "bg-orange-100 text-orange-700",
    ganada: "bg-green-100 text-green-700",
    perdida: "bg-crema-deep text-piedra",
  };
  const label = ETAPAS.find((e) => e.value === etapa)?.label ?? etapa;
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${estilos[etapa] ?? ""}`}
    >
      {label}
    </span>
  );
}

export function ProductoBadge({ nombre }: { nombre?: string | null }) {
  if (!nombre) return null;
  return (
    <span className="inline-block rounded-full border border-borde px-2.5 py-0.5 text-xs text-tinta/70">
      {nombre}
    </span>
  );
}
