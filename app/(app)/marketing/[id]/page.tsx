import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fechaCorta } from "@/lib/format";
import ColaCampania from "@/components/ColaCampania";
import type { Cliente } from "@/lib/types";

type Destinatario = {
  id: string;
  estado: string;
  cliente: Pick<Cliente, "id" | "nombre_comercial" | "telefono" | "rubro"> | null;
};

export default async function CampaniaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: rol } = await supabase.rpc("fn_rol");
  if (!["direccion", "admin", "marketing"].includes(rol ?? ""))
    redirect("/hoy");

  const [{ data: camp }, { data: dests }] = await Promise.all([
    supabase.from("campanias").select("*").eq("id", id).single(),
    supabase
      .from("campania_destinatarios")
      .select("id, estado, cliente:clientes(id, nombre_comercial, telefono, rubro)")
      .eq("campania_id", id)
      .order("estado"),
  ]);
  if (!camp) notFound();

  const destinatarios = (dests ?? []) as unknown as Destinatario[];
  const enviados = destinatarios.filter((d) => d.estado === "enviado").length;
  const salteados = destinatarios.filter((d) => d.estado === "salteado").length;
  const pendientes = destinatarios.filter((d) => d.estado === "pendiente");

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/marketing" className="text-sm text-sky-700">
        ← Campañas
      </Link>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">{camp.nombre}</h1>
        <span className="text-sm text-piedra">{fechaCorta(camp.created_at)}</span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl border border-borde bg-white p-3 shadow-sm">
          <p className="text-xl font-bold text-green-700">{enviados}</p>
          <p className="text-xs text-piedra">Enviados</p>
        </div>
        <div className="rounded-2xl border border-borde bg-white p-3 shadow-sm">
          <p className="text-xl font-bold">{pendientes.length}</p>
          <p className="text-xs text-piedra">Pendientes</p>
        </div>
        <div className="rounded-2xl border border-borde bg-white p-3 shadow-sm">
          <p className="text-xl font-bold text-piedra">{salteados}</p>
          <p className="text-xs text-piedra">Salteados</p>
        </div>
      </div>

      <div className="mt-4">
        <ColaCampania
          plantilla={camp.plantilla}
          pendientes={pendientes
            .filter((d) => d.cliente)
            .map((d) => ({
              destinatarioId: d.id,
              clienteId: d.cliente!.id,
              nombre: d.cliente!.nombre_comercial,
              telefono: d.cliente!.telefono,
              rubro: d.cliente!.rubro,
            }))}
          terminada={camp.estado === "terminada"}
        />
      </div>
    </div>
  );
}
