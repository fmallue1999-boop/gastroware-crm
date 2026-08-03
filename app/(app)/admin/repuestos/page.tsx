import { createClient } from "@/lib/supabase/server";
import RepuestosAdmin from "@/components/admin/RepuestosAdmin";
import type { Repuesto } from "@/lib/types";

export default async function AdminRepuestosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("repuestos")
    .select("*")
    .order("descripcion")
    .limit(200);
  if (q)
    query = query.or(
      `descripcion.ilike.%${q}%,codigo_interno.ilike.%${q}%,marca.ilike.%${q}%`
    );

  const { data } = await query;

  return <RepuestosAdmin repuestos={(data ?? []) as Repuesto[]} q={q ?? ""} />;
}
