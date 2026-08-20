import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { iaConfigurada } from "@/lib/core/ia";
import CampaniaForm from "@/components/CampaniaForm";

// El diseño de email con IA puede tardar ~30s
export const maxDuration = 60;

export default async function NuevaCampaniaPage() {
  const supabase = await createClient();
  const [{ data: rol }, { data: cfgDormido }] = await Promise.all([
    supabase.rpc("fn_rol"),
    supabase.from("config").select("valor").eq("clave", "meses_cliente_dormido").maybeSingle(),
  ]);
  if (!["direccion", "admin", "marketing"].includes(rol ?? ""))
    redirect("/hoy");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight mb-1">Nueva campaña</h1>
      <p className="text-sm text-piedra mb-5">
        Armá el segmento, mirá a cuántos les llega, escribí el mensaje y listo.
      </p>
      <CampaniaForm
        mesesDormidoDefault={Number(cfgDormido?.valor) || 6}
        iaOn={iaConfigurada()}
      />
    </div>
  );
}
