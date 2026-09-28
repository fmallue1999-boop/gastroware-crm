import { createClient } from "@/lib/supabase/server";
import { hoyISO } from "@/lib/format";
import { TIPOS_AGENDA, type TipoAgenda } from "@/lib/agenda";
import AgendaForm from "@/components/agenda/AgendaForm";
import AyudaLink from "@/components/guia/AyudaLink";

export const metadata = { title: "Nueva tarea" };

/** Nueva tarea, reunión, capacitación o pago (?fecha=, ?tipo=, ?persona= la precargan). */
export default async function NuevaTareaPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; tipo?: string; persona?: string; titulo?: string; link?: string }>;
}) {
  const p = await searchParams;
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    { data: usuarios },
  ] = await Promise.all([supabase.auth.getUser(), supabase.from("usuarios").select("id, nombre, rol").eq("activo", true).order("nombre")]);
  const yo = user?.id ?? "";
  const hoy = hoyISO();
  const tipo = TIPOS_AGENDA.some((t) => t.value === p.tipo) ? (p.tipo as TipoAgenda) : undefined;
  const lista = (usuarios ?? []) as { id: string; nombre: string; rol: string }[];
  const persona = lista.some((u) => u.id === p.persona) ? p.persona! : null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="flex flex-wrap items-center gap-x-2 text-2xl font-extrabold tracking-tight">
        Nueva tarea <AyudaLink tarea="agenda" />
      </h1>
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <AgendaForm
          usuarios={lista}
          yo={yo}
          hoy={hoy}
          inicial={{
            fecha: /^\d{4}-\d{2}-\d{2}$/.test(p.fecha ?? "") ? p.fecha : undefined,
            tipo,
            personas: persona ? [persona] : undefined,
            titulo: p.titulo?.slice(0, 200),
            links: p.link && /^https?:\/\//.test(p.link) ? [{ url: p.link.slice(0, 500), texto: "Ficha del cliente" }] : undefined,
          }}
        />
      </section>
    </div>
  );
}
