import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NotificacionesLista from "@/components/NotificacionesLista";
import type { Notificacion } from "@/lib/types";

export default async function NotificacionesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("notificaciones")
    .select("*")
    .eq("usuario_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Notificaciones</h1>
      <div className="mt-4">
        <NotificacionesLista
          notificaciones={(data ?? []) as Notificacion[]}
        />
      </div>
    </div>
  );
}
