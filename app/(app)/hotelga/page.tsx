import { createClient } from "@/lib/supabase/server";
import { iaConfigurada } from "@/lib/core/ia";
import { hoyISO } from "@/lib/format";
import FeriaForm from "@/components/FeriaForm";

// La lectura de credencial con IA puede tardar unos segundos
export const maxDuration = 60;

export default async function HotelgaPage() {
  const supabase = await createClient();
  const hoy = hoyISO();
  const [{ count: total }, { count: deHoy }] = await Promise.all([
    supabase
      .from("oportunidades")
      .select("id", { count: "exact", head: true })
      .eq("origen", "HOTELGA 2026"),
    supabase
      .from("oportunidades")
      .select("id", { count: "exact", head: true })
      .eq("origen", "HOTELGA 2026")
      .gte("created_at", `${hoy}T00:00:00-03:00`),
  ]);

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">HOTELGA 2026</h1>
        <span className="rounded-full bg-celeste-soft px-3 py-1 text-sm font-semibold text-sky-800">
          Hoy: {deHoy ?? 0} · Feria: {total ?? 0}
        </span>
      </div>
      <p className="mb-4 text-sm text-piedra">
        Captura rápida de visitantes: foto a la credencial, corregís lo que
        haga falta y siguiente.
      </p>
      <FeriaForm iaOn={iaConfigurada()} contadorInicial={deHoy ?? 0} />
    </div>
  );
}
