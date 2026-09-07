import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { hoyISO, sumarDias } from "@/lib/format";

type Mov = {
  id: string;
  cliente_id: string;
  tipo: string;
  contenido: string | null;
  created_by: string | null;
  created_at: string;
  cliente: { nombre_comercial: string } | null;
};

function diaDe(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

function horaDe(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function tituloDia(dia: string): string {
  const hoy = hoyISO();
  if (dia === hoy) return "Hoy";
  if (dia === sumarDias(-1)) return "Ayer";
  const d = new Date(dia + "T12:00:00");
  const t = d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Todo lo que hizo el equipo, en orden: notas, ventas, services, cambios. */
export default async function MovimientosPage({
  searchParams,
}: {
  searchParams: Promise<{ quien?: string }>;
}) {
  const { quien } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let query = supabase
    .from("actividades")
    .select("id, cliente_id, tipo, contenido, created_by, created_at, cliente:clientes(nombre_comercial)")
    .order("created_at", { ascending: false })
    .limit(150);
  if (quien === "yo" && user) query = query.eq("created_by", user.id);

  const [{ data }, { data: usuariosData }] = await Promise.all([
    query,
    supabase.from("usuarios").select("id, nombre"),
  ]);
  const movimientos = (data ?? []) as unknown as Mov[];
  const nombres = new Map(
    ((usuariosData ?? []) as { id: string; nombre: string }[]).map((u) => [u.id, u.nombre])
  );

  const porDia = new Map<string, Mov[]>();
  for (const m of movimientos) {
    const d = diaDe(m.created_at);
    if (!porDia.has(d)) porDia.set(d, []);
    porDia.get(d)!.push(m);
  }

  const chip = (activo: boolean) =>
    `rounded-full px-3.5 py-1.5 text-sm font-medium ${
      activo ? "bg-tinta text-white" : "border border-borde bg-white text-piedra"
    }`;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Movimientos</h1>
        <div className="flex gap-1.5">
          <Link href="/movimientos" className={chip(quien !== "yo")}>
            Todo el equipo
          </Link>
          <Link href="/movimientos?quien=yo" className={chip(quien === "yo")}>
            Míos
          </Link>
        </div>
      </div>
      <p className="mb-4 text-sm text-piedra">
        Todo lo que se anotó, vendió y arregló, en orden. Tocá el nombre para ir a la ficha.
      </p>

      {movimientos.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-borde p-6 text-center text-sm text-piedra">
          Todavía no hay movimientos.
        </p>
      ) : (
        <div className="space-y-5">
          {Array.from(porDia.entries()).map(([dia, lista]) => (
            <section key={dia}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-piedra">
                {tituloDia(dia)}
              </h2>
              <div className="overflow-hidden rounded-2xl border border-borde bg-white shadow-sm">
                {lista.map((m) => (
                  <div
                    key={m.id}
                    className="flex gap-3 border-b border-borde/60 px-3.5 py-2.5 text-sm last:border-0"
                  >
                    <span className="w-11 shrink-0 text-xs text-piedra">{horaDe(m.created_at)}</span>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/clientes/${m.cliente_id}`}
                        className="font-semibold hover:underline"
                      >
                        {m.cliente?.nombre_comercial ?? "Contacto"}
                      </Link>
                      <span className="text-tinta/80"> — {m.contenido}</span>
                      {m.created_by && nombres.get(m.created_by) && (
                        <span className="text-piedra"> · {nombres.get(m.created_by)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
