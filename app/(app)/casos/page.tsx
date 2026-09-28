import Link from "next/link";
import { ChevronDown, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { hoyISO } from "@/lib/format";
import { veTodo } from "@/lib/puestos";
import { cargarCasos } from "@/lib/servidor/casos";
import ConPanel from "@/components/ficha/ConPanel";
import CasoTarjeta, { type CasoVista } from "@/components/casos/CasoTarjeta";
import AyudaLink from "@/components/guia/AyudaLink";
import { iaConfigurada } from "@/lib/core/ia";

const ahora = () => Date.now();

// La ayuda con IA de los casos puede tardar unos segundos
export const maxDuration = 60;

function Grupo({ titulo, casos, color, iaOn }: { titulo: string; casos: CasoVista[]; color: string; iaOn: boolean }) {
  if (!casos.length) return null;
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-piedra">
        <span className={`rounded-full px-2 py-0.5 ${color}`}>{casos.length}</span>
        {titulo}
      </h2>
      <div className="grid gap-2 lg:grid-cols-2">
        {casos.map((c) => (
          <CasoTarjeta key={c.id} caso={c} iaOn={iaOn} />
        ))}
      </div>
    </section>
  );
}

/**
 * Casos de postventa (manual 4.3): reclamos con su plazo. Primero los que no
 * tienen respuesta, después los abiertos y los derivados a servicio técnico.
 */
export default async function CasosPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; interes?: string; ver?: string }>;
}) {
  const { c, interes, ver } = await searchParams;
  const iaOn = iaConfigurada();
  const supabase = await createClient();
  const [{ data: rol }, { data: auth }] = await Promise.all([supabase.rpc("fn_rol"), supabase.auth.getUser()]);
  const todos = veTodo(rol as string) && ver !== "mios";
  const hoy = hoyISO();
  const t = ahora();
  const [abiertos, cerrados] = await Promise.all([
    cargarCasos(supabase, { abiertos: true, responsableId: todos ? null : auth.user?.id, ahora: t, hoy }),
    cargarCasos(supabase, { abiertos: false, responsableId: todos ? null : auth.user?.id, limite: 20, ahora: t, hoy }),
  ]);
  const sinRespuesta = abiertos.filter((x) => !x.primera_respuesta_at);
  const enCurso = abiertos.filter((x) => x.primera_respuesta_at && x.estado === "abierto");
  const derivados = abiertos.filter((x) => x.primera_respuesta_at && x.estado === "derivado");

  return (
    <ConPanel c={c} interes={interes} cerrarHref="/casos">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="flex flex-wrap items-center gap-x-2 text-2xl font-extrabold tracking-tight">
          Casos <AyudaLink tarea="responder-caso" />
        </h1>
            <p className="text-[15px] text-piedra">
              Reclamos y consultas de clientes: responder en 24 h hábiles (1 h si está parado) y cerrar en 5 días hábiles.
            </p>
          </div>
          <div className="flex gap-2">
            {veTodo(rol as string) && (
              <Link
                href={todos ? "/casos?ver=mios" : "/casos"}
                className="inline-flex min-h-11 items-center rounded-xl border border-borde bg-white px-3 text-[15px] font-bold"
              >
                {todos ? "Ver los míos" : "Ver todos"}
              </Link>
            )}
            <Link href="/casos/nuevo" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-marino px-4 text-[15px] font-extrabold text-white">
              <Plus className="h-4 w-4" /> Nuevo caso
            </Link>
          </div>
        </div>

        {abiertos.length === 0 && (
          <p className="rounded-2xl bg-white px-4 py-6 text-center text-lg font-bold text-verde shadow-sm">No hay casos abiertos.</p>
        )}
        <Grupo iaOn={iaOn} titulo="Sin primera respuesta" casos={sinRespuesta} color="bg-red-100 text-red-700" />
        <Grupo iaOn={iaOn} titulo="Abiertos" casos={enCurso} color="bg-ambar-soft text-ambar" />
        <Grupo iaOn={iaOn} titulo="Derivados a servicio técnico" casos={derivados} color="bg-azul-soft text-azul" />

        {cerrados.length > 0 && (
          <details className="group">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-[15px] font-bold text-piedra [&::-webkit-details-marker]:hidden">
              Cerrados hace poco ({cerrados.length})
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-2 grid gap-2 lg:grid-cols-2">
              {cerrados.map((x) => (
                <CasoTarjeta key={x.id} caso={x} />
              ))}
            </div>
          </details>
        )}
      </div>
    </ConPanel>
  );
}
