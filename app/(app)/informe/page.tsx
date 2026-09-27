import { createClient } from "@/lib/supabase/server";
import { fechaCorta, hoyISO } from "@/lib/format";
import { lunesDe, periodoInforme, type NumerosInforme as Numeros } from "@/lib/semana";
import { numerosInforme } from "@/lib/servidor/informe";
import NumerosInforme from "@/components/informe/NumerosInforme";
import { InformeForm } from "@/components/informe/InformeForm";

type Informe = {
  id: string;
  semana: string;
  numeros: Numeros;
  bloqueos: string | null;
  decisiones: string | null;
  agenda: string | null;
  enviado_at: string | null;
  respuesta: string | null;
  respondido_at: string | null;
};

/** Mi informe comercial de los lunes (manual 4.5): antes de las 10. */
export default async function InformePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const hoy = hoyISO();
  const semana = lunesDe(hoy);
  const { desde, hasta } = periodoInforme(semana);
  const [numeros, { data: lista }] = await Promise.all([
    numerosInforme(supabase, user!.id, desde, hasta),
    supabase.from("informes_semanales").select("*").eq("usuario_id", user!.id).order("semana", { ascending: false }).limit(8),
  ]);
  const informes = (lista ?? []) as Informe[];
  const actual = informes.find((i) => i.semana === semana) ?? null;
  const anteriores = informes.filter((i) => i.semana !== semana);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Informe de la semana</h1>
        <p className="text-[15px] text-piedra">
          Del {fechaCorta(desde)} al {fechaCorta(hasta)}. Se manda los lunes antes de las 10: los números los pone el CRM, vos
          agregás lo que falta.
        </p>
      </div>
      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <NumerosInforme n={numeros} />
        {actual?.respondido_at ? (
          <div className="space-y-1 rounded-xl bg-verde-soft p-3">
            <p className="text-[15px] font-bold text-verde">Dirección respondió</p>
            <p className="whitespace-pre-wrap text-[15px]">{actual.respuesta}</p>
          </div>
        ) : (
          <>
            {actual?.enviado_at && (
              <p className="text-[14px] font-bold text-verde">Enviado el {fechaCorta(actual.enviado_at)}. Esperando la respuesta de dirección.</p>
            )}
            <InformeForm
              enviado={Boolean(actual?.enviado_at)}
              inicial={{ bloqueos: actual?.bloqueos ?? "", decisiones: actual?.decisiones ?? "", agenda: actual?.agenda ?? "" }}
            />
          </>
        )}
      </section>

      {anteriores.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wide text-piedra">Semanas anteriores</h2>
          {anteriores.map((i) => (
            <details key={i.id} className="rounded-2xl bg-white p-3 shadow-sm">
              <summary className="cursor-pointer text-[15px] font-bold">
                Semana del {fechaCorta(periodoInforme(i.semana).desde)} {i.respondido_at ? "· respondido" : i.enviado_at ? "· enviado" : "· sin enviar"}
              </summary>
              <div className="mt-2 space-y-2 text-[14px]">
                <NumerosInforme n={i.numeros} />
                {i.bloqueos && <p>Bloqueos: {i.bloqueos}</p>}
                {i.decisiones && <p>Decisiones: {i.decisiones}</p>}
                {i.agenda && <p>Agenda: {i.agenda}</p>}
                {i.respuesta && <p className="font-bold text-verde">Dirección: {i.respuesta}</p>}
              </div>
            </details>
          ))}
        </section>
      )}
    </div>
  );
}
