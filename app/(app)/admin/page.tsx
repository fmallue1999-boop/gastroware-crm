import { createClient } from "@/lib/supabase/server";
import UsuariosAdmin from "@/components/admin/UsuariosAdmin";
import ConfigForm from "@/components/ConfigForm";
import SubirLogo from "@/components/admin/SubirLogo";
import type { Usuario } from "@/lib/types";

export default async function AdminUsuariosPage() {
  const supabase = await createClient();
  const [{ data: rol }, { data: usuariosData }, { data: cfgTarifa }, { data: cfgLogo }] =
    await Promise.all([
      supabase.rpc("fn_rol"),
      supabase.from("usuarios").select("*").order("nombre"),
      supabase.from("config").select("valor").eq("clave", "tarifa_hora").single(),
      supabase.from("config").select("valor").eq("clave", "logo_url").maybeSingle(),
    ]);

  const usuarios = (usuariosData ?? []) as Usuario[];

  return (
    <div className="space-y-5">
      <UsuariosAdmin usuarios={usuarios} esDireccion={rol === "direccion"} />
      <ConfigForm tarifaActual={cfgTarifa?.valor ?? "0"} />
      <SubirLogo logoActual={cfgLogo?.valor?.trim() || null} />
    </div>
  );
}
