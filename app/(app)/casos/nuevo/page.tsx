import { createClient } from "@/lib/supabase/server";
import { equiposDeCliente } from "@/lib/actions";
import NuevoCasoForm from "@/components/casos/NuevoCasoForm";
import AyudaLink from "@/components/guia/AyudaLink";

/** Nuevo caso de postventa (lo carga quien recibe el reclamo). */
export default async function NuevoCasoPage({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const { cliente } = await searchParams;
  const supabase = await createClient();
  const { data: cli } = cliente
    ? await supabase.from("clientes").select("id, nombre_comercial, telefono").eq("id", cliente).maybeSingle()
    : { data: null };
  const equipos = cli ? await equiposDeCliente(cli.id) : [];
  return (
    <div className="mx-auto max-w-xl space-y-3">
      <div>
        <h1 className="flex flex-wrap items-center gap-x-2 text-2xl font-extrabold tracking-tight">
          Nuevo caso <AyudaLink tarea="abrir-caso" />
        </h1>
        <p className="text-[15px] text-piedra">Lo responde el vendedor de la cuenta. Si no se resuelve a distancia, se deriva a servicio técnico.</p>
      </div>
      <NuevoCasoForm
        clienteInicial={cli ? { id: cli.id, nombre_comercial: cli.nombre_comercial, telefono: cli.telefono } : null}
        equiposIniciales={equipos}
        volverA={cli ? `/clientes/${cli.id}` : "/casos"}
      />
    </div>
  );
}
