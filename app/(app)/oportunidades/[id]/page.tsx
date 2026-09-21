import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * La pantalla de la consulta ya no existe: todo vive en la ficha del
 * contacto (Etapa 1, 1.5). Los links viejos caen acá y siguen a la ficha
 * con esa tarjeta de interés abierta.
 */
export default async function OportunidadRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("oportunidades")
    .select("cliente_id")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  redirect(`/clientes/${data.cliente_id}?interes=${id}`);
}
