import { createClient } from "@/lib/supabase/server";
import { cargarMarca } from "@/lib/servidor/marca";
import { esGestor } from "@/lib/puestos";
import MarcaAdmin from "@/components/admin/MarcaAdmin";
import SubirLogo from "@/components/admin/SubirLogo";
import DatosCotizacion from "@/components/admin/DatosCotizacion";
import { CAMPOS_COTIZACION, type ClaveCotizacion } from "@/lib/cotizacion-pdf";

/** Administración → Marca: nombre, colores y logos del sistema; logo de los impresos; datos de la cotización en PDF. */
export default async function AdminMarcaPage() {
  const supabase = await createClient();
  const [{ data: rol }, marca, { data: logoImpresos }, { data: datosCot }, { data: ultima }] = await Promise.all([
    supabase.rpc("fn_rol"),
    cargarMarca(supabase),
    supabase.from("config").select("valor").eq("clave", "logo_url").maybeSingle(),
    supabase.from("config").select("clave, valor").in("clave", CAMPOS_COTIZACION.map((c) => c.clave)),
    supabase.from("cotizaciones").select("numero").order("numero", { ascending: false }).limit(1),
  ]);
  const inicialCot = Object.fromEntries((datosCot ?? []).map((c) => [c.clave, (c.valor as string | null) ?? ""])) as Partial<Record<ClaveCotizacion, string>>;
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
      <DatosCotizacion inicial={inicialCot} ultimoNumero={Number(ultima?.[0]?.numero ?? 0)} puedeEditar={esGestor(rol as string)} />
    </div>
  );
}
