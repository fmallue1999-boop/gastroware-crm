import { createClient } from "@/lib/supabase/server";
import { listarEquiposCliente } from "@/lib/actions";
import OTForm from "@/components/OTForm";
import type { Cliente, Usuario } from "@/lib/types";

export default async function NuevaOTPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string; equipo?: string; tipo?: string }>;
}) {
  const { cliente: clienteId, equipo: equipoId, tipo } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("usuarios")
    .select("*")
    .eq("activo", true)
    .order("nombre");

  // Si llega desde la ficha de un equipo/cliente, precargar
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
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-1">Nueva orden de trabajo</h1>
      <p className="text-sm text-piedra mb-5">
        Buscá el cliente, elegí el equipo y asignala.
      </p>
      <OTForm
        usuarios={(data ?? []) as Usuario[]}
        clienteInicial={clienteInicial}
        equiposIniciales={equiposIniciales}
        equipoInicialId={equipoId ?? ""}
        tipoInicial={tipo}
      />
    </div>
  );
}
