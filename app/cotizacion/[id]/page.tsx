import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { CotizacionVersion } from "@/lib/types";

/**
 * La cotización para el cliente es el PDF (/cotizacion/[id]/pdf, v1.8).
 * Esta página queda para los links viejos y para explicar por qué una
 * propuesta fuera de lista todavía no se puede mandar.
 */
export default async function CotizacionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const { id } = await params;
  const { v } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("cotizacion_versiones")
    .select("version, aprobacion, aprobacion_nota")
    .eq("cotizacion_id", id);
  query = Number(v) ? query.eq("version", Number(v)) : query.order("version", { ascending: false });
  const { data } = await query.limit(1);
  const version = (data?.[0] ?? null) as Pick<CotizacionVersion, "version" | "aprobacion" | "aprobacion_nota"> | null;
  if (!version) notFound();

  // Fuera de lista: no se manda hasta que dirección la apruebe
  if (version.aprobacion === "pendiente" || version.aprobacion === "rechazada")
    return (
      <div className="mx-auto max-w-xl p-8 text-center">
        <p className="text-xl font-extrabold">
          {version.aprobacion === "pendiente" ? "Esta propuesta está esperando la aprobación de dirección" : "Dirección rechazó esta propuesta"}
        </p>
        <p className="mt-2 text-[15px] text-piedra">
          {version.aprobacion === "pendiente"
            ? "Va fuera de lista. Cuando dirección la apruebe te llega el aviso y la podés mandar."
            : version.aprobacion_nota ?? "Armá una nueva versión con lo que pidió dirección."}
        </p>
      </div>
    );

  redirect(`/cotizacion/${id}/pdf?v=${version.version}`);
}
