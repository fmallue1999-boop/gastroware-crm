import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Los avisos de v1.24 llevaban a la conversación de la cotización. Desde
 * v1.26 la conversación es del interés: se va a la de su interés.
 */
export default async function CotizacionConversacionVieja({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("cotizaciones").select("oportunidad_id").eq("id", id).maybeSingle();
  if (!data?.oportunidad_id) notFound();
  redirect(`/conversacion/${data.oportunidad_id}`);
}
