import { createClient } from "@/lib/supabase/server";
import OTForm from "@/components/OTForm";
import type { Usuario } from "@/lib/types";

export default async function NuevaOTPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("usuarios")
    .select("*")
    .eq("activo", true)
    .order("nombre");

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Nueva orden de trabajo</h1>
      <p className="text-sm text-piedra mb-5">
        Buscá el cliente, elegí el equipo y asignala.
      </p>
      <OTForm usuarios={(data ?? []) as Usuario[]} />
    </div>
  );
}
