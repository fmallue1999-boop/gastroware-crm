import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { hoyISO } from "@/lib/format";
import { MOTIVOS_PERDIDA } from "@/lib/constants";

interface OppRow {
  id: string;
  etapa: string;
  origen: string;
  monto_estimado: number | null;
  moneda: string;
  motivo_perdida: string | null;
  created_at: string;
  closed_at: string | null;
  producto: { nombre: string } | null;
  cliente: { rubro: string } | null;
}

const dinero = (n: number) =>
  "$" + new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(n);

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string }>;
}) {
  const { dias } = await searchParams;
  const rango = Number(dias) || 90;
  const desde = new Date(Date.now() - rango * 86400000).toISOString();

  const supabase = await createClient();
  const [oppsRes, vencidasRes] = await Promise.all([
    supabase
      .from("oportunidades")
      .select(
        "id, etapa, origen, monto_estimado, moneda, motivo_perdida, created_at, closed_at, producto:productos(nombre), cliente:clientes(rubro)"
      )
      .gte("created_at", desde)
      .limit(2000),
    supabase
      .from("tareas")
      .select("id, usuario:usuarios(nombre)")
      .is("completada_at", null)
      .eq("cancelada", false)
      .lt("vence_el", hoyISO()),
  ]);

  const opps = (oppsRes.data ?? []) as unknown as OppRow[];
  const vencidas = (vencidasRes.data ?? []) as unknown as {
    id: string;
    usuario: { nombre: string } | null;
  }[];

  const ganadas = opps.filter((o) => o.etapa === "ganada");
  const perdidas = opps.filter((o) => o.etapa === "perdida");
  const abiertas = opps.filter(
    (o) => !["ganada", "perdida"].includes(o.etapa)
  );
  const cotizadas = opps.filter((o) =>
    ["cotizada", "seguimiento", "negociacion", "ganada", "perdida"].includes(o.etapa)
  );

  const montoGanado = ganadas.reduce((s, o) => s + (o.monto_estimado ?? 0), 0);
  const pipeline = abiertas.reduce((s, o) => s + (o.monto_estimado ?? 0), 0);

  const agrupar = (rows: OppRow[], clave: (o: OppRow) => string) => {
    const m = new Map<string, { total: number; ganadas: number }>();
    for (const o of rows) {
      const k = clave(o) || "Sin dato";
      const v = m.get(k) ?? { total: 0, ganadas: 0 };
      v.total++;
      if (o.etapa === "ganada") v.ganadas++;
      m.set(k, v);
    }
    return Array.from(m.entries()).sort((a, b) => b[1].total - a[1].total);
  };

  const porProducto = agrupar(opps, (o) => o.producto?.nombre ?? "Sin producto");
  const porCanal = agrupar(opps, (o) => o.origen);
  const porRubro = agrupar(opps, (o) => o.cliente?.rubro ?? "Sin rubro");

  const motivos = MOTIVOS_PERDIDA.map((m) => ({
    motivo: m,
    count: perdidas.filter((o) => o.motivo_perdida === m).length,
  }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);

  const vencidasPorVendedor = (() => {
    const m = new Map<string, number>();
    for (const t of vencidas) {
      const k = t.usuario?.nombre ?? "Sin asignar";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  })();

  const diasCierre = ganadas
    .filter((o) => o.closed_at)
    .map(
      (o) =>
        (new Date(o.closed_at!).getTime() - new Date(o.created_at).getTime()) /
        86400000
    );
  const promedioCierre = diasCierre.length
    ? Math.round(diasCierre.reduce((a, b) => a + b, 0) / diasCierre.length)
    : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Reportes</h1>
        <div className="flex gap-1">
          {[30, 90, 365].map((d) => (
            <Link
              key={d}
              href={`/reportes?dias=${d}`}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                rango === d
                  ? "bg-tinta text-white"
                  : "border border-borde text-piedra"
              }`}
            >
              {d === 365 ? "1 año" : `${d}d`}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metrica label="Leads" valor={String(opps.length)} />
        <Metrica label="Ganadas" valor={String(ganadas.length)} />
        <Metrica label="Vendido" valor={dinero(montoGanado)} />
        <Metrica label="Pipeline abierto" valor={dinero(pipeline)} />
      </div>

      <Seccion titulo={`Tasa de cotización: ${pct(cotizadas.length, opps.length)} · Tasa de cierre: ${pct(ganadas.length, cotizadas.length)}${promedioCierre != null ? ` · Cierre promedio: ${promedioCierre} días` : ""}`} />

      <Barras titulo="Embudo por producto" datos={porProducto.map(([k, v]) => ({ label: k, valor: v.total, extra: `${v.ganadas} ganadas` }))} />
      <Barras titulo="Consultas por canal" datos={porCanal.map(([k, v]) => ({ label: k, valor: v.total, extra: `${pct(v.ganadas, v.total)} cierre` }))} />
      <Barras titulo="Consultas por rubro" datos={porRubro.map(([k, v]) => ({ label: k, valor: v.total, extra: `${v.ganadas} ganadas` }))} />

      {motivos.length > 0 && (
        <Barras titulo="Motivos de pérdida" datos={motivos.map((m) => ({ label: m.motivo, valor: m.count, extra: "" }))} color="bg-red-300" />
      )}

      <section className="rounded-2xl border border-borde bg-white shadow-sm p-4">
        <h2 className="text-sm font-semibold mb-2">
          Seguimientos vencidos {vencidas.length > 0 && (
            <span className="text-red-600">({vencidas.length})</span>
          )}
        </h2>
        {vencidasPorVendedor.length === 0 ? (
          <p className="text-sm text-green-700">
            ✓ Nadie tiene seguimientos vencidos. Disciplina perfecta.
          </p>
        ) : (
          vencidasPorVendedor.map(([nombre, count]) => (
            <p key={nombre} className="text-sm text-tinta/80">
              {nombre}: <span className="font-semibold text-red-600">{count}</span>
            </p>
          ))
        )}
      </section>
    </div>
  );
}

function pct(parte: number, total: number) {
  return total > 0 ? Math.round((parte / total) * 100) + "%" : "—";
}

function Metrica({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-2xl border border-borde bg-white shadow-sm p-3">
      <p className="text-lg font-semibold truncate">{valor}</p>
      <p className="text-xs text-piedra">{label}</p>
    </div>
  );
}

function Seccion({ titulo }: { titulo: string }) {
  return (
    <p className="rounded-2xl bg-celeste-soft px-4 py-2.5 text-sm text-tinta/80">
      {titulo}
    </p>
  );
}

function Barras({
  titulo,
  datos,
  color = "bg-celeste-deep",
}: {
  titulo: string;
  datos: { label: string; valor: number; extra: string }[];
  color?: string;
}) {
  const max = Math.max(...datos.map((d) => d.valor), 1);
  return (
    <section className="rounded-2xl border border-borde bg-white shadow-sm p-4">
      <h2 className="text-sm font-semibold mb-3">{titulo}</h2>
      {datos.length === 0 ? (
        <p className="text-sm text-piedra/80">Sin datos todavía.</p>
      ) : (
        <div className="space-y-2">
          {datos.map((d) => (
            <div key={d.label}>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-tinta/80">{d.label}</span>
                <span className="text-piedra">
                  {d.valor}
                  {d.extra ? ` · ${d.extra}` : ""}
                </span>
              </div>
              <div className="h-2 rounded-full bg-crema">
                <div
                  className={`h-2 rounded-full ${color}`}
                  style={{ width: `${(d.valor / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
