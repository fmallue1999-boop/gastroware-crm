import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { controlaServicio, veTodo } from "@/lib/puestos";
import AliadosAdmin, { type Aliado } from "@/components/admin/AliadosAdmin";
import AyudaLink from "@/components/guia/AyudaLink";

/** Técnicos aliados: terceros que atienden fuera de la zona del técnico propio. */
export default async function AliadosPage() {
  const supabase = await createClient();
  const { data: rol } = await supabase.rpc("fn_rol");
  if (!veTodo(rol as string) && rol !== "tecnico") redirect("/");
  const { data } = await supabase.from("tecnicos_aliados").select("*").order("activo", { ascending: false }).order("nombre");
  return (
    <div className="space-y-3">
      <div>
        <h1 className="flex flex-wrap items-center gap-x-2 text-2xl font-extrabold tracking-tight">
          Técnicos aliados <AyudaLink tarea="aliados" />
        </h1>
        <p className="text-[15px] text-piedra">
          Atienden los trabajos fuera de Mar del Plata y zona. Los asigna dirección de administración (o servicio técnico).
        </p>
      </div>
      <AliadosAdmin aliados={(data ?? []) as Aliado[]} puedeEditar={controlaServicio(rol as string)} />
    </div>
  );
}
