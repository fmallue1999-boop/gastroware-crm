import { createClient } from "@/lib/supabase/server";

const ACCIONES: Record<string, string> = {
  INSERT: "Creó",
  UPDATE: "Modificó",
  DELETE: "Borró",
};

type Registro = {
  id: number;
  tabla: string;
  registro_id: string | null;
  accion: string;
  usuario_id: string | null;
  diff: Record<string, unknown> | null;
  created_at: string;
};

const inputCls =
  "rounded-2xl border border-borde bg-white shadow-sm px-3 py-2.5 text-sm outline-none focus:border-tinta";

function valor(v: unknown): string {
  if (v == null || v === "") return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export default async function AdminAuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ tabla?: string; accion?: string }>;
}) {
  const { tabla, accion } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (tabla) query = query.eq("tabla", tabla);
  if (accion) query = query.eq("accion", accion);

  const [{ data }, { data: usuariosData }, { data: tablasData }] =
    await Promise.all([
      query,
      supabase.from("usuarios").select("id, nombre"),
      supabase.from("audit_log").select("tabla").limit(1000),
    ]);

  const registros = (data ?? []) as Registro[];
  const nombres = new Map(
    ((usuariosData ?? []) as { id: string; nombre: string }[]).map((u) => [
      u.id,
      u.nombre,
    ])
  );
  const tablas = Array.from(
    new Set(((tablasData ?? []) as { tabla: string }[]).map((t) => t.tabla))
  ).sort();

  const fmtFecha = (iso: string) =>
    new Date(iso).toLocaleString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="space-y-4">
      <p className="text-sm text-piedra">
        Registro inalterable de quién hizo qué. Se escribe solo desde la base de
        datos: no se puede editar ni borrar desde la aplicación.
      </p>

      <form method="get" className="flex flex-wrap gap-2">
        <select name="tabla" defaultValue={tabla ?? ""} className={inputCls}>
          <option value="">Todas las tablas</option>
          {tablas.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select name="accion" defaultValue={accion ?? ""} className={inputCls}>
          <option value="">Todas las acciones</option>
          <option value="INSERT">Altas</option>
          <option value="UPDATE">Modificaciones</option>
          <option value="DELETE">Borrados</option>
        </select>
        <button className="rounded-2xl bg-tinta px-4 py-2.5 text-sm text-white">
          Filtrar
        </button>
      </form>

      <div className="space-y-2">
        {registros.map((r) => (
          <details
            key={r.id}
            className="rounded-2xl border border-borde bg-white px-4 py-3 shadow-sm"
          >
            <summary className="cursor-pointer text-sm list-none [&::-webkit-details-marker]:hidden">
              <span className="text-piedra">{fmtFecha(r.created_at)}</span>{" "}
              <span className="font-medium">
                {r.usuario_id
                  ? (nombres.get(r.usuario_id) ?? "Usuario")
                  : "Sistema"}
              </span>{" "}
              {(ACCIONES[r.accion] ?? r.accion).toLowerCase()}{" "}
              <span className="font-medium">{r.tabla}</span>
              {r.diff && (
                <span className="text-piedra">
                  {" "}
                  · {Object.keys(r.diff).length} campo
                  {Object.keys(r.diff).length === 1 ? "" : "s"}
                </span>
              )}
            </summary>
            {r.diff && (
              <div className="mt-2 space-y-1 border-t border-borde/60 pt-2 text-xs">
                {r.accion === "UPDATE"
                  ? Object.entries(r.diff).map(([campo, v]) => {
                      const cambio = v as {
                        antes?: unknown;
                        despues?: unknown;
                      } | null;
                      return (
                        <p key={campo}>
                          <span className="font-medium">{campo}:</span>{" "}
                          <span className="text-red-700 line-through">
                            {valor(cambio?.antes)}
                          </span>{" "}
                          →{" "}
                          <span className="text-green-700">
                            {valor(cambio?.despues)}
                          </span>
                        </p>
                      );
                    })
                  : Object.entries(r.diff)
                      .filter(([, v]) => v != null && v !== "")
                      .map(([campo, v]) => (
                        <p key={campo}>
                          <span className="font-medium">{campo}:</span>{" "}
                          {valor(v)}
                        </p>
                      ))}
              </div>
            )}
          </details>
        ))}
        {registros.length === 0 && (
          <p className="rounded-2xl border border-dashed border-borde p-6 text-center text-sm text-piedra">
            Sin registros con esos filtros.
          </p>
        )}
      </div>
    </div>
  );
}
