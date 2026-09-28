import Link from "next/link";
import { CircleHelp } from "lucide-react";

/** "¿Cómo se usa?": lleva a la guía abierta en la tarea de esta pantalla. */
export default function AyudaLink({ tarea, texto = "¿Cómo se usa?" }: { tarea?: string; texto?: string }) {
  return (
    <Link
      href={tarea ? `/guia?tarea=${tarea}` : "/guia"}
      className="inline-flex min-h-10 items-center gap-1 rounded-xl px-2 text-[14px] font-bold text-marino hover:bg-celeste-soft"
    >
      <CircleHelp className="h-4 w-4" /> {texto}
    </Link>
  );
}
