import { createClient } from "@/lib/supabase/server";
import { cargarMarca } from "@/lib/servidor/marca";
import { esGestor } from "@/lib/puestos";
import MarcaAdmin from "@/components/admin/MarcaAdmin";
import SubirLogo from "@/components/admin/SubirLogo";

/** Administración → Marca: nombre, colores y logos del sistema; logo de los impresos. */
export default async function AdminMarcaPage() {
  const supabase = await createClient();
  const [{ data: rol }, marca, { data: logoImpresos }] = await Promise.all([
    supabase.rpc("fn_rol"),
    cargarMarca(supabase),
    supabase.from("config").select("valor").eq("clave", "logo_url").maybeSingle(),
  ]);
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-extrabold">Marca del sistema</h2>
        <p className="text-[14px] text-piedra">
          El nombre, los colores y los logos que ve todo el equipo. Probá en la vista previa y guardá cuando te guste.
        </p>
      </div>
      <MarcaAdmin inicial={marca} puedeEditar={esGestor(rol as string)} />
      <SubirLogo logoActual={logoImpresos?.valor?.trim() || null} />
    </div>
  );
}
