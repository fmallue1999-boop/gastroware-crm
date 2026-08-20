import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fechaCorta } from "@/lib/format";
import ActivarCampania from "@/components/ActivarCampania";
import ColaCampania from "@/components/ColaCampania";
import EnviarEmails from "@/components/EnviarEmails";
import type { Cliente } from "@/lib/types";

// Las tandas de email pueden tardar (envío secuencial): margen amplio
export const maxDuration = 60;

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

  // Contadores exactos por consulta (traer todas las filas se corta en 1000)
  const contar = (estado: string) =>
    supabase
      .from("campania_destinatarios")
      .select("id", { count: "exact", head: true })
      .eq("campania_id", id)
      .eq("estado", estado);

  const [
    { data: camp },
    { count: enviados },
    { count: salteados },
    { count: conError },
    { count: pendientesTotal },
    { data: dests },
  ] = await Promise.all([
    supabase.from("campanias").select("*").eq("id", id).single(),
    contar("enviado"),
    contar("salteado"),
    contar("error"),
    contar("pendiente"),
    supabase
      .from("campania_destinatarios")
      .select("id, estado, cliente:clientes(id, nombre_comercial, telefono, rubro)")
      .eq("campania_id", id)
      .eq("estado", "pendiente")
      .limit(200),
  ]);
  if (!camp) notFound();

  const pendientes = (dests ?? []) as unknown as Destinatario[];
  const esEmail = camp.canal === "email";

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/marketing" className="text-sm text-sky-700">
        ← Campañas
      </Link>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">{camp.nombre}</h1>
        <span className="text-sm text-piedra">{fechaCorta(camp.created_at)}</span>
      </div>

      <div className={`mt-3 grid gap-2 text-center ${(conError ?? 0) > 0 ? "grid-cols-4" : "grid-cols-3"}`}>
        <div className="rounded-2xl border border-borde bg-white p-3 shadow-sm">
          <p className="text-xl font-bold text-green-700">{enviados ?? 0}</p>
          <p className="text-xs text-piedra">Enviados</p>
        </div>
        <div className="rounded-2xl border border-borde bg-white p-3 shadow-sm">
          <p className="text-xl font-bold">{pendientesTotal ?? 0}</p>
          <p className="text-xs text-piedra">Pendientes</p>
        </div>
        <div className="rounded-2xl border border-borde bg-white p-3 shadow-sm">
          <p className="text-xl font-bold text-piedra">{salteados ?? 0}</p>
          <p className="text-xs text-piedra">Salteados</p>
        </div>
        {(conError ?? 0) > 0 && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-3 shadow-sm">
            <p className="text-xl font-bold text-red-700">{conError}</p>
            <p className="text-xs text-red-700">Con error</p>
          </div>
        )}
      </div>

      {camp.estado === "borrador" && (
        <div className="mt-4">
          <ActivarCampania campaniaId={camp.id} />
          <div className="mt-3 rounded-2xl border border-borde bg-white p-4 text-sm shadow-sm">
            {camp.asunto && (
              <p className="mb-1">
                <span className="font-semibold">Asunto:</span> {camp.asunto}
              </p>
            )}
            {camp.html ? (
              <iframe
                srcDoc={camp.html
                  .replaceAll("{nombre}", "Juan Pérez")
                  .replaceAll("{baja}", "#")}
                title="Vista previa del email"
                className="h-[560px] w-full rounded-xl border-0 bg-white"
                sandbox=""
              />
            ) : (
              <p className="whitespace-pre-wrap text-tinta/80">{camp.plantilla}</p>
            )}
          </div>
        </div>
      )}

      <div className="mt-4">
        {camp.estado === "borrador" ? null : esEmail ? (
          <EnviarEmails
            campaniaId={camp.id}
            pendientes={pendientesTotal ?? 0}
            terminada={camp.estado === "terminada"}
          />
        ) : (
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
        )}
      </div>
    </div>
  );
}
