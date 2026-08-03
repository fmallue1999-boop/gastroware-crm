import { createClient } from "@/lib/supabase/server";
import PlantillaEditor from "@/components/admin/PlantillaEditor";
import type { Plantilla } from "@/lib/types";

export default async function AdminPlantillasPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("plantillas").select("*").order("uso");

  const plantillas = (data ?? []) as Plantilla[];

  return (
    <div className="space-y-3">
      <p className="text-sm text-piedra">
        Textos que el equipo copia con un toque desde las oportunidades y el
        inicio. Los marcadores como {"{monto}"} o {"{nombre}"} se reemplazan
        solos al usarlos.
      </p>
      {plantillas.map((p) => (
        <PlantillaEditor key={p.id} plantilla={p} />
      ))}
      {plantillas.length === 0 && (
        <p className="rounded-2xl border border-dashed border-borde p-6 text-center text-sm text-piedra">
          Sin plantillas cargadas.
        </p>
      )}
    </div>
  );
}
