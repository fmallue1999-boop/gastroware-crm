import { createClient } from "@/lib/supabase/server";
import { iaConfigurada } from "@/lib/core/ia";
import { nombrePuesto, type Puesto } from "@/lib/puestos";
import { SUGERENCIAS_IA } from "@/lib/ia-sugerencias";
import Asistente from "@/components/ia/Asistente";

// El asistente puede consultar varias cosas antes de responder
export const maxDuration = 60;
export const metadata = { title: "Asistente" };

/** Asistente de IA (?q= manda una pregunta al abrir, desde los botones de otras pantallas). */
export default async function AsistentePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const supabase = await createClient();
  const [{ data: auth }, { data: rol }] = await Promise.all([supabase.auth.getUser(), supabase.rpc("fn_rol")]);
  const puesto = ((rol as string) ?? "comercial") as Puesto;
  return (
    <Asistente
      userId={auth.user?.id ?? "anonimo"}
      puesto={nombrePuesto(puesto)}
      sugerencias={SUGERENCIAS_IA[puesto] ?? SUGERENCIAS_IA.comercial}
      preguntaInicial={q?.slice(0, 500) ?? null}
      activa={iaConfigurada()}
    />
  );
}
