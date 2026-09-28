import { createClient } from "@/lib/supabase/server";
import UsuariosAdmin from "@/components/admin/UsuariosAdmin";
import TerritoriosAdmin from "@/components/admin/TerritoriosAdmin";
import ReglasAdmin from "@/components/admin/ReglasAdmin";
import { nombrePuesto } from "@/lib/puestos";
import type { Usuario } from "@/lib/types";

/** Administración → Equipo: puestos, territorios y reglas del manual. */
export default async function AdminUsuariosPage() {
  const supabase = await createClient();
  const [{ data: rol }, { data: usuariosData }, { data: territoriosData }, { data: cfg }] = await Promise.all([
    supabase.rpc("fn_rol"),
    supabase.from("usuarios").select("*").order("nombre"),
    supabase.from("territorios").select("codigo, nombre, zonas, responsable_id").order("orden"),
    supabase.from("config").select("clave, valor"),
  ]);

  const usuarios = (usuariosData ?? []) as Usuario[];
  const territorios = (territoriosData ?? []) as { codigo: string; nombre: string; zonas: string[]; responsable_id: string | null }[];
  const config = Object.fromEntries(((cfg ?? []) as { clave: string; valor: string }[]).map((c) => [c.clave, c.valor]));
  const esDireccion = rol === "direccion";
  const esGestor = esDireccion || rol === "admin";
  const vendedores = usuarios
    .filter((u) => u.activo && ["comercial", "direccion"].includes(u.rol))
    .map((u) => ({ id: u.id, nombre: u.nombre, puesto: nombrePuesto(u.rol) }));

  return (
    <div className="space-y-8">
      <UsuariosAdmin usuarios={usuarios} esDireccion={esDireccion} esGestor={esGestor} territorios={territorios} />
      <TerritoriosAdmin territorios={territorios} vendedores={vendedores} puedeEditar={esGestor} />
      <ReglasAdmin
        puedeEditar={esGestor}
        valores={{
          dias_atraso_frena_despacho: config.dias_atraso_frena_despacho ?? "30",
          descuento_libre_pct: config.descuento_libre_pct ?? "0",
          plazo_pago_aliados_dias: config.plazo_pago_aliados_dias ?? "",
          tarifa_hora: config.tarifa_hora ?? "0",
        }}
      />
    </div>
  );
}
