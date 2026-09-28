import { Banknote, CalendarDays, Droplets, GraduationCap, ListTodo, Users, type LucideIcon } from "lucide-react";

/** Ícono y colores de cada tipo de la agenda. */
export const ESTILO_TIPO: Record<string, { icono: LucideIcon; chip: string; punto: string }> = {
  tarea: { icono: ListTodo, chip: "bg-azul-soft text-azul", punto: "bg-azul" },
  reunion: { icono: Users, chip: "bg-violeta-soft text-violeta", punto: "bg-violeta" },
  capacitacion: { icono: GraduationCap, chip: "bg-naranja-soft text-naranja", punto: "bg-naranja" },
  pago: { icono: Banknote, chip: "bg-ambar-soft text-ambar", punto: "bg-ambar" },
  otro: { icono: CalendarDays, chip: "bg-celeste-soft text-marino", punto: "bg-marino" },
  consumible: { icono: Droplets, chip: "bg-verde-soft text-verde", punto: "bg-verde" },
};

export const estiloTipo = (t: string) => ESTILO_TIPO[t] ?? ESTILO_TIPO.tarea;
