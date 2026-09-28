import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fechaCorta, hoyISO, sumarDias } from "@/lib/format";
import { esGestor } from "@/lib/puestos";
import { lunesDe, periodoInforme, type NumerosInforme as Numeros } from "@/lib/semana";
import NumerosInforme from "@/components/informe/NumerosInforme";
import { ResponderInforme } from "@/components/informe/InformeForm";

type Informe = {
  id: string;
  usuario_id: string;
  semana: string;
  numeros: Numeros;
  bloqueos: string | null;
  decisiones: string | null;
  agenda: string | null;
  enviado_at: string | null;
  respuesta: string | null;
  respondido_at: string | null;
};

/** Informes comerciales de los lunes, para dirección: leer y responder las decisiones. */
export default async function InformesPage({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  const { semana: q } = await searchParams;
  const supabase = await createClient();
  const { data: rol } = await supabase.rpc("fn_rol");
  if (!esGestor(rol as string)) redirect("/informe");
  const semana = q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? lunesDe(q) : lunesDe(hoyISO());
  const { desde, hasta } = periodoInforme(semana);
  const [{ data: lista }, { data: usuarios }] = await Promise.all([
    supabase.from("informes_semanales").select("*").eq("semana", semana),
    supabase.from("usuarios").select("id, nombre, rol, activo").eq("activo", true).eq("rol", "comercial").order("nombre"),
  ]);
  const informes = (lista ?? []) as Informe[];
  const vendedores = (usuarios ?? []) as { id: string; nombre: string }[];
  const faltan = vendedores.filter((v) => !informes.some((i) => i.usuario_id === v.id && i.enviado_at));
  const nombre = new Map(vendedores.map((v) => [v.id, v.nombre]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Informes comerciales</h1>
          <p className="text-[15px] text-piedra">
            Semana del {fechaCorta(desde)} al {fechaCorta(hasta)} · se mandan los lunes antes de las 10
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/informes?semana=${sumarDias(-7, semana)}`} className="inline-flex min-h-11 items-center rounded-xl border border-borde bg-white px-3 text-[15px] font-bold">
            ← Anterior
          </Link>
          {semana !== lunesDe(hoyISO()) && (
            <Link href="/informes" className="inline-flex min-h-11 items-center rounded-xl border border-borde bg-white px-3 text-[15px] font-bold">
              Esta semana
            </Link>
          )}
        </div>
      </div>

      {faltan.length > 0 && (
        <p className="rounded-2xl bg-ambar-soft px-4 py-3 text-[15px] font-bold text-ambar">
          Sin enviar: {faltan.map((v) => v.nombre).join(", ")}
        </p>
      )}

      {informes.filter((i) => i.enviado_at).length === 0 && (
        <p className="rounded-2xl border border-dashed border-borde p-6 text-center text-[15px] text-piedra">Todavía no llegó ningún informe de esta semana.</p>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {informes
          .filter((i) => i.enviado_at)
          .map((i) => (
            <section key={i.id} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[17px] font-extrabold">{nombre.get(i.usuario_id) ?? "Vendedor"}</p>
                <span className="text-xs text-piedra">enviado {fechaCorta(i.enviado_at)}</span>
              </div>
              <NumerosInforme n={i.numeros} />
              {i.bloqueos && (
                <p className="text-[15px]">
                  <span className="font-bold">Lo frena:</span> {i.bloqueos}
                </p>
              )}
              {i.decisiones && (
                <p className="rounded-xl bg-ambar-soft px-3 py-2 text-[15px]">
                  <span className="font-bold">Necesita que decidas:</span> {i.decisiones}
                </p>
              )}
              {i.agenda && (
                <p className="text-[15px]">
                  <span className="font-bold">Agenda:</span> {i.agenda}
                </p>
              )}
              <ResponderInforme informeId={i.id} respuesta={i.respuesta} />
            </section>
          ))}
      </div>
    </div>
  );
}
