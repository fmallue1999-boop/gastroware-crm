import { createClient } from "@/lib/supabase/server";
import GuiaUso from "@/components/guia/GuiaUso";

/** Guía de uso dentro del CRM (?tarea=id abre una tarea puntual). */
export default async function GuiaPage({ searchParams }: { searchParams: Promise<{ tarea?: string }> }) {
  const { tarea } = await searchParams;
  const supabase = await createClient();
  const { data: rol } = await supabase.rpc("fn_rol");
  return <GuiaUso rol={(rol as string) ?? "comercial"} tareaInicial={tarea ?? null} />;
}
