import { CUENTAS, ESTADOS, cuentaDe, estadoDe } from "@/lib/contenidos";

/** Estado de una ficha: pastilla con punto de color y el texto (no depende solo del color). */
export function EstadoPastilla({ estado, corto = false }: { estado: string; corto?: boolean }) {
  const e = estadoDe(estado);
  return (
    <span className={`inline-flex max-w-full items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-none ${e.pastilla}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${e.punto}`} />
      <span className="truncate">{corto ? e.corto : e.label}</span>
    </span>
  );
}

/** Cuenta: barrita de color + nombre. */
export function CuentaEtiqueta({ cuenta }: { cuenta: string }) {
  const c = cuentaDe(cuenta);
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-tinta">
      <span className={`h-3 w-1.5 rounded-full ${c.punto}`} />
      {c.label}
    </span>
  );
}

/** Leyenda compacta: cuenta = color del borde; estado = pastilla. */
export function LeyendaColores() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-piedra">
      <span className="font-bold uppercase tracking-wide">Cuenta</span>
      {CUENTAS.map((c) => (
        <span key={c.value} className="inline-flex items-center gap-1.5">
          <span className={`h-3.5 w-1.5 rounded-full ${c.punto}`} /> {c.label}
        </span>
      ))}
      <span className="ml-2 font-bold uppercase tracking-wide">Estado</span>
      {ESTADOS.map((e) => (
        <EstadoPastilla key={e.value} estado={e.value} />
      ))}
    </div>
  );
}
