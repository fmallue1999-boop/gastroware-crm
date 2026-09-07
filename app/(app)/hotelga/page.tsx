import Link from "next/link";
import { Camera, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ESTADOS_FERIA } from "@/lib/constants";
import FeriaLeadFila from "@/components/FeriaLeadFila";
import type { FeriaLead } from "@/lib/types";

/**
 * Seguimiento de los contactos de HOTELGA: quién falta contactar, quién
 * los contactó, calificación, asignación por vendedor y observaciones.
 * Un comercial ve los suyos y los sin asignar; dirección ve todo.
 */
export default async function HotelgaPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; vista?: string; q?: string }>;
}) {
  const { estado, vista, q } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: rol } = await supabase.rpc("fn_rol");
  const esGestor = ["direccion", "admin"].includes((rol as string) ?? "");
  const busqueda = q?.trim() ?? "";

  let query = supabase
    .from("feria_leads")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);
  if (estado && ESTADOS_FERIA.some((e) => e.value === estado)) query = query.eq("estado", estado);
  if (vista === "mios" && user) query = query.eq("asignado_a", user.id);
  if (vista === "sin_asignar") query = query.is("asignado_a", null);
  if (busqueda) {
    const digitos = busqueda.replace(/\D/g, "");
    const filtros = [
      `nombre.ilike.%${busqueda}%`,
      `empresa.ilike.%${busqueda}%`,
      `email.ilike.%${busqueda}%`,
      `cargo.ilike.%${busqueda}%`,
      `observaciones.ilike.%${busqueda}%`,
    ];
    if (digitos.length >= 4) filtros.push(`telefono.ilike.%${digitos}%`);
    query = query.or(filtros.join(","));
  }

  const [{ data }, { data: usuariosData }, ...conteos] = await Promise.all([
    query,
    supabase.from("usuarios").select("id, nombre, rol, activo"),
    ...ESTADOS_FERIA.map((e) =>
      supabase
        .from("feria_leads")
        .select("id", { count: "exact", head: true })
        .eq("estado", e.value)
    ),
  ]);
  const leads = (data ?? []) as FeriaLead[];
  const usuarios = (usuariosData ?? []) as {
    id: string;
    nombre: string;
    rol: string;
    activo: boolean;
  }[];
  const nombres: Record<string, string> = {};
  for (const u of usuarios) nombres[u.id] = u.nombre;
  const vendedores = usuarios.filter(
    (u) => u.activo && ["comercial", "direccion", "admin", "marketing"].includes(u.rol)
  );
  const totalPorEstado = Object.fromEntries(
    ESTADOS_FERIA.map((e, i) => [e.value, conteos[i]?.count ?? 0])
  ) as Record<string, number>;
  const total = Object.values(totalPorEstado).reduce((s, n) => s + n, 0);

  const link = (p: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { estado, vista, q: busqueda, ...p };
    for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, v);
    const s = sp.toString();
    return `/hotelga${s ? `?${s}` : ""}`;
  };
  const chip = (activo: boolean) =>
    `shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${
      activo ? "bg-tinta text-white" : "border border-borde bg-white text-piedra"
    }`;

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">HOTELGA 2026</h1>
        <Link
          href="/hotelga/capturar"
          className="inline-flex items-center gap-1.5 rounded-xl bg-tinta px-3.5 py-2 text-sm font-semibold text-white shadow-sm"
        >
          <Camera className="h-4 w-4" /> Capturar en el stand
        </Link>
      </div>
      <p className="mb-3 text-sm text-piedra">
        {total > 0
          ? `${total} contactos de la feria. Marcá a quién contactaste, calificalo y asignale vendedor.`
          : "Todavía no hay contactos cargados de la feria. Cuando llegue la base, aparecen acá."}
      </p>

      <form method="get" className="relative mb-3">
        {estado && <input type="hidden" name="estado" value={estado} />}
        {vista && <input type="hidden" name="vista" value={vista} />}
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-piedra" />
        <input
          type="search"
          name="q"
          defaultValue={busqueda}
          placeholder="Buscar por nombre, empresa, email, teléfono o interés (ej: zumex)"
          className="w-full rounded-2xl border border-borde bg-white py-3 pl-11 pr-4 text-base shadow-sm outline-none focus:border-tinta"
        />
      </form>

      <div className="-mx-4 mb-2 flex gap-1.5 overflow-x-auto px-4 pb-1">
        <Link href={link({ estado: undefined })} className={chip(!estado)}>
          Todos ({total})
        </Link>
        {ESTADOS_FERIA.map((e) => (
          <Link key={e.value} href={link({ estado: e.value })} className={chip(estado === e.value)}>
            {e.label} ({totalPorEstado[e.value] ?? 0})
          </Link>
        ))}
      </div>
      <div className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
        <Link href={link({ vista: undefined })} className={chip(!vista)}>
          {esGestor ? "De todos" : "Míos y sin asignar"}
        </Link>
        <Link href={link({ vista: "mios" })} className={chip(vista === "mios")}>
          Asignados a mí
        </Link>
        {esGestor && (
          <Link href={link({ vista: "sin_asignar" })} className={chip(vista === "sin_asignar")}>
            Sin asignar
          </Link>
        )}
      </div>

      {leads.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-borde p-6 text-center text-sm text-piedra">
          Nada acá con estos filtros.
        </p>
      ) : (
        <div className="grid gap-2 lg:grid-cols-2">
          {leads.map((l) => (
            <FeriaLeadFila
              key={l.id}
              lead={l}
              nombres={nombres}
              vendedores={vendedores}
              esGestor={esGestor}
            />
          ))}
          {leads.length >= 300 && (
            <p className="text-center text-xs text-piedra lg:col-span-2">
              Se muestran 300. Filtrá por estado o buscá para ver el resto.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
