import Link from "next/link";
import { Plus } from "lucide-react";
import { agendaDeMiDia } from "@/lib/servidor/agenda";
import type { SupabaseServidor } from "@/lib/actions/comun";
import FilaAgenda from "@/components/agenda/FilaAgenda";

/** Mi día: lo de la agenda para hoy (más lo atrasado y los pagos por vencer). */
export default async function AgendaHoy({ supabase, yo, gestor, hoy }: { supabase: SupabaseServidor; yo: string; gestor: boolean; hoy: string }) {
  const items = await agendaDeMiDia(supabase, { yo, gestor }, hoy);
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-piedra">Tu agenda de hoy ({items.length})</h2>
        <div className="flex items-center gap-3">
          <Link href="/tareas/nueva" className="inline-flex items-center gap-1 text-[14px] font-bold text-marino">
            <Plus className="h-4 w-4" /> Nueva
          </Link>
          <Link href="/tareas" className="text-[14px] font-bold text-marino">
            Ver todo
          </Link>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="rounded-2xl bg-white px-4 py-3 text-[15px] text-piedra shadow-sm">Nada en tu agenda para hoy.</p>
      ) : (
        <div className="space-y-2">
          {items.map((i) => (
            <FilaAgenda key={i.id} item={i} hoy={hoy} />
          ))}
        </div>
      )}
    </section>
  );
}
