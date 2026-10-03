import Link from "next/link";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIAS_GASTO, mesVecino, nombreCategoria, nombreMes, rangoMes, resumenPorPersona, textoTotales, totalPorMoneda } from "@/lib/viaticos";
import { gastosDelMes } from "@/lib/servidor/viaticos";

const titulo = "text-xs font-bold uppercase tracking-wide text-piedra";

/**
 * Resumen de viáticos del mes (v1.25): cuánto se gastó, cuánto se aprobó y
 * cuánto falta revisar; por persona y por tipo de gasto. Dirección y
 * administración ven a todos; el resto, lo suyo. Con descarga en Excel.
 */
export default async function ResumenViaticosPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes: mesParam } = await searchParams;
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
  const mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(mesParam ?? "") ? mesParam! : hoy.slice(0, 7);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: rolData } = await supabase.rpc("fn_rol");
  const todos = ["direccion", "admin", "administrativa"].includes((rolData as string) ?? "");
  const { desde, hasta } = rangoMes(mes);
  const gastos = await gastosDelMes(supabase, desde, hasta, todos ? undefined : user!.id);

  const aprobados = gastos.filter((g) => g.decision === "aprobado");
  const rechazados = gastos.filter((g) => g.decision === "rechazado");
  const porRevisar = gastos.filter((g) => !g.decision);
  const porPersona = resumenPorPersona(gastos)
    .map((p) => ({ ...p, nombre: gastos.find((g) => g.usuario_id === p.usuarioId)?.usuario?.nombre ?? "—" }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const porCategoria = CATEGORIAS_GASTO.map((c) => ({ ...c, total: totalPorMoneda(gastos.filter((g) => g.categoria === c.value)) })).filter((c) =>
    Object.values(c.total).some((v) => v > 0)
  );

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/viaticos" className="inline-flex min-h-10 items-center gap-1 text-[14px] font-bold text-piedra hover:text-marino">
        <ChevronLeft className="h-4 w-4" /> Viáticos
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight">Resumen de viáticos</h1>
        <a
          href={`/viaticos/excel?mes=${mes}`}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-borde bg-white px-4 text-[15px] font-bold text-tinta"
        >
          <Download className="h-4 w-4" /> Excel del mes
        </a>
      </div>

      <div className="flex items-center justify-between gap-2 rounded-2xl bg-white px-2 py-1.5 shadow-sm">
        <Link href={`/viaticos/resumen?mes=${mesVecino(mes, -1)}`} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-tinta" aria-label="Mes anterior">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <p className="text-[16px] font-extrabold first-letter:uppercase">{nombreMes(mes)}</p>
        <Link href={`/viaticos/resumen?mes=${mesVecino(mes, 1)}`} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-tinta" aria-label="Mes siguiente">
          <ChevronRight className="h-5 w-5" />
        </Link>
      </div>

      {gastos.length === 0 ? (
        <p className="rounded-2xl bg-white px-4 py-6 text-center text-[15px] text-piedra shadow-sm">No hay gastos con fecha en este mes.</p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { t: "Cargado", v: totalPorMoneda(gastos), n: gastos.length },
              { t: "Aprobado", v: totalPorMoneda(aprobados), n: aprobados.length },
              { t: "Por revisar", v: totalPorMoneda(porRevisar), n: porRevisar.length },
              { t: "Rechazado", v: totalPorMoneda(rechazados), n: rechazados.length },
            ].map((x) => (
              <div key={x.t} className="rounded-2xl bg-white px-3 py-2.5 shadow-sm">
                <dt className="text-xs font-bold text-piedra">
                  {x.t} · {x.n}
                </dt>
                <dd className="text-[16px] font-extrabold">{textoTotales(x.v)}</dd>
              </div>
            ))}
          </dl>
          <p className="text-[13px] text-piedra">“Por revisar” incluye lo que todavía no se rindió.</p>

          {todos && (
            <section className="space-y-2">
              <h2 className={titulo}>Por persona</h2>
              <div className="space-y-2">
                {porPersona.map((p) => (
                  <div key={p.usuarioId} className="rounded-2xl bg-white p-3.5 shadow-sm">
                    <p className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-[16px] font-extrabold">{p.nombre}</span>
                      <span className="text-[16px] font-extrabold">{textoTotales(p.total)}</span>
                    </p>
                    <p className="mt-1 flex flex-wrap gap-1.5">
                      {Object.entries(p.porCategoria).map(([c, t]) => (
                        <span key={c} className="rounded-full bg-crema px-2.5 py-0.5 text-[13px]">
                          {nombreCategoria(c)} {textoTotales(t)}
                        </span>
                      ))}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="space-y-2">
            <h2 className={titulo}>Por tipo de gasto</h2>
            <ul className="divide-y divide-borde/70 overflow-hidden rounded-2xl border border-borde bg-white">
              {porCategoria.map((c) => (
                <li key={c.value} className="flex items-center justify-between gap-2 px-3.5 py-2.5 text-[15px]">
                  <span className="font-bold">{c.label}</span>
                  <span>{textoTotales(c.total)}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
