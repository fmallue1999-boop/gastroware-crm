import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fechaCorta } from "@/lib/format";

type ClienteMin = {
  id: string;
  nombre_comercial: string;
  telefono: string | null;
  cuit: string | null;
  estado: string;
  created_at: string;
};

function normalizarNombre(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

type Grupo = { motivo: string; clientes: ClienteMin[] };

function detectarGrupos(clientes: ClienteMin[]): Grupo[] {
  const grupos: Grupo[] = [];
  const agrupar = (
    clave: (c: ClienteMin) => string | null,
    motivo: (valor: string) => string
  ) => {
    const mapa = new Map<string, ClienteMin[]>();
    for (const c of clientes) {
      const k = clave(c);
      if (!k) continue;
      mapa.set(k, [...(mapa.get(k) ?? []), c]);
    }
    for (const [valor, lista] of mapa) {
      if (lista.length > 1) grupos.push({ motivo: motivo(valor), clientes: lista });
    }
  };

  agrupar(
    (c) => c.telefono || null,
    (v) => `Mismo teléfono (${v})`
  );
  agrupar(
    (c) => c.cuit || null,
    (v) => `Mismo CUIT (${v})`
  );
  agrupar(
    (c) => {
      const n = normalizarNombre(c.nombre_comercial);
      return n.length >= 4 ? n : null;
    },
    () => "Mismo nombre (ignorando mayúsculas y acentos)"
  );

  // Evitar repetir el mismo conjunto de clientes con dos motivos
  const vistos = new Set<string>();
  return grupos.filter((g) => {
    const firma = g.clientes
      .map((c) => c.id)
      .sort()
      .join("|");
    if (vistos.has(firma)) return false;
    vistos.add(firma);
    return true;
  });
}

export default async function AdminDuplicadosPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("clientes")
    .select("id, nombre_comercial, telefono, cuit, estado, created_at")
    .is("deleted_at", null)
    .limit(5000);

  const grupos = detectarGrupos((data ?? []) as ClienteMin[]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-piedra">
        Posibles clientes duplicados, detectados por teléfono, CUIT o nombre
        parecido. La unificación es manual: revisá cada caso, pasá los datos al
        cliente que quede y avisale al equipo cuál usar.
      </p>

      {grupos.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-borde p-8 text-center text-sm text-piedra">
          No se detectaron duplicados. La base está prolija.
        </p>
      ) : (
        grupos.map((g, i) => (
          <div
            key={i}
            className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm"
          >
            <p className="mb-2 text-sm font-semibold text-amber-900">
              {g.motivo}
            </p>
            <div className="space-y-1.5">
              {g.clientes.map((c) => (
                <Link
                  key={c.id}
                  href={`/clientes/${c.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-borde bg-white px-3 py-2 text-sm shadow-sm hover:border-celeste"
                >
                  <span className="font-medium">{c.nombre_comercial}</span>
                  <span className="text-xs text-piedra">
                    {c.telefono ?? "sin tel."} · {c.cuit ?? "sin CUIT"} · alta{" "}
                    {fechaCorta(c.created_at)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
