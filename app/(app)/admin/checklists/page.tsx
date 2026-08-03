import { createClient } from "@/lib/supabase/server";
import ChecklistsAdmin from "@/components/admin/ChecklistsAdmin";
import type { ChecklistPlantilla, Modelo } from "@/lib/types";

export default async function AdminChecklistsPage() {
  const supabase = await createClient();
  const [{ data: plantillas }, { data: modelos }] = await Promise.all([
    supabase
      .from("checklist_plantillas")
      .select("*, modelo:modelos(marca, nombre)")
      .order("nombre"),
    supabase.from("modelos").select("*").eq("activo", true).order("marca"),
  ]);

  return (
    <ChecklistsAdmin
      plantillas={(plantillas ?? []) as ChecklistPlantilla[]}
      modelos={(modelos ?? []) as Modelo[]}
    />
  );
}
