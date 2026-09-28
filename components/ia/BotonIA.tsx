import Link from "next/link";
import { Sparkles } from "lucide-react";

/** Botón que abre el asistente con una pregunta ya armada para esta pantalla. */
export default function BotonIA({ pregunta, texto = "Preguntale a la IA" }: { pregunta?: string; texto?: string }) {
  return (
    <Link
      href={pregunta ? `/asistente?q=${encodeURIComponent(pregunta)}` : "/asistente"}
      className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-violeta/30 bg-violeta-soft px-3 text-[14px] font-bold text-violeta hover:border-violeta"
    >
      <Sparkles className="h-4 w-4" /> {texto}
    </Link>
  );
}
