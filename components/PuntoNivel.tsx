import { NIVELES_INTERES } from "@/lib/constants";
import { fechaCorta } from "@/lib/format";
import { nombreAccion } from "@/lib/actividad";

const PUNTO_NIVEL: Record<string, string> = {
  caliente: "bg-naranja",
  tibio: "bg-ambar",
  frio: "bg-gray-300",
};

/** Puntito de color con el nivel de interés (se usa en todas las listas). */
export function PuntoNivel({ nivel, conTexto = false }: { nivel: string | null; conTexto?: boolean }) {
  const label = NIVELES_INTERES.find((n) => n.value === nivel)?.label ?? "Sin nivel";
  return (
    <span className="inline-flex items-center gap-1 text-xs text-piedra" title={label}>
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${PUNTO_NIVEL[nivel ?? ""] ?? "bg-gray-200"}`} />
      {conTexto ? label : null}
    </span>
  );
}

/** Texto de la próxima fecha: atrasado / hoy / fecha / sin fecha. Sin rojos. */
export function textoProximo(proximo: string | null, nota: string | null, hoy: string, accion?: string | null) {
  if (!proximo) return { texto: "Sin próximo paso", clase: "text-piedra" };
  const n = nota ? ` · ${nota}` : "";
  const a = nombreAccion(accion);
  if (proximo < hoy) return { texto: `${a ? `${a}: e` : "E"}ra para el ${fechaCorta(proximo)}${n}`, clase: "text-ambar font-semibold" };
  if (proximo === hoy) return { texto: `${a ?? "Contactar"} hoy${n}`, clase: "text-tinta font-semibold" };
  return { texto: `${a ? `${a} el` : "Volver a contactar el"} ${fechaCorta(proximo)}${n}`, clase: "text-azul" };
}

export const COLOR_ETAPA: Record<string, string> = {
  nueva: "bg-azul-soft text-azul",
  cotizada: "bg-violeta-soft text-violeta",
  seguimiento: "bg-ambar-soft text-ambar",
  espera: "bg-naranja-soft text-naranja",
  ganada: "bg-verde-soft text-verde",
  perdida: "bg-crema-deep text-piedra",
};
