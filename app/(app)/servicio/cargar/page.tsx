import { createClient } from "@/lib/supabase/server";
import { listarEquiposCliente } from "@/lib/actions";
import ServiceHechoForm from "@/components/ServiceHechoForm";
import type { Cliente } from "@/lib/types";

// La foto se sube desde el servidor: puede tardar unos segundos
export const maxDuration = 60;

export default async function CargarServicePage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>;
}) {
  const { cliente: clienteId } = await searchParams;
  const supabase = await createClient();

  let clienteInicial: Cliente | null = null;
  let equiposIniciales: { id: string; etiqueta: string }[] = [];
  if (clienteId) {
    const { data: c } = await supabase
      .from("clientes")
      .select("*")
      .eq("id", clienteId)
      .single();
    if (c) {
      clienteInicial = c as Cliente;
      equiposIniciales = await listarEquiposCliente(clienteId);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-1 text-2xl font-bold tracking-tight">Cargar service hecho</h1>
      <p className="mb-5 text-sm text-piedra">
        Para dejar asentado un service que ya se hizo: de quién, qué equipo y
        qué se hizo. Un minuto.
      </p>
      <ServiceHechoForm
        clienteInicial={clienteInicial}
        equiposIniciales={equiposIniciales}
      />
    </div>
  );
}
