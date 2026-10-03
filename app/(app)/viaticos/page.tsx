import Link from "next/link";
import { BarChart3, ChevronRight, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fechaCorta } from "@/lib/format";
import { ESTADOS_RENDICION, aReintegrar, estadoRendicion, hayAlgo, textoTotales, totalPorMoneda } from "@/lib/viaticos";
import { cargarRendiciones, gastosSinRendir, type Rendicion } from "@/lib/servidor/viaticos";
import RendirGastos from "@/components/viaticos/RendirGastos";

const titulo = "text-xs font-bold uppercase tracking-wide text-piedra";

function FilaRendicion({ r, conPersona }: { r: Rendicion; conPersona?: boolean }) {
  const e = ESTADOS_RENDICION[estadoRendicion(r.estado)];
  const decididos = r.gastos.filter((g) => g.decision).length;
  const devolver = aReintegrar(r.gastos);
  return (
    <Link href={`/viaticos/rendicion/${r.id}`} className="flex items-center gap-3 px-3.5 py-3 hover:bg-crema/60">
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[15px] font-bold">
            {conPersona ? `${r.usuario?.nombre ?? "—"} · ` : ""}N° {r.numero}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-extrabold ${e.clase}`}>{e.label}</span>
        </span>
        <span className="block text-[13px] text-piedra">
          {fechaCorta(r.enviada_at)} · {r.gastos.length} {r.gastos.length === 1 ? "gasto" : "gastos"} · {textoTotales(totalPorMoneda(r.gastos))}
          {r.estado === "enviada" && decididos > 0 ? ` · ${decididos} revisados` : ""}
          {r.estado === "aprobada" && hayAlgo(devolver) ? ` · devolver ${textoTotales(devolver)}` : ""}
          {r.estado === "reintegrada" && r.reintegro_fecha ? ` · reintegrada el ${fechaCorta(r.reintegro_fecha)}` : ""}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-piedra/60" />
    </Link>
  );
}

function ListaRendiciones({ lista, conPersona, vacio }: { lista: Rendicion[]; conPersona?: boolean; vacio: string }) {
  if (!lista.length) return <p className="rounded-2xl bg-white px-4 py-4 text-center text-[15px] text-piedra shadow-sm">{vacio}</p>;
  return (
    <div className="divide-y divide-borde/70 overflow-hidden rounded-2xl border border-borde bg-white">
      {lista.map((r) => (
        <FilaRendicion key={r.id} r={r} conPersona={conPersona} />
      ))}
    </div>
  );
}

/**
 * Viáticos (v1.25): cada uno carga sus gastos con el comprobante y los rinde;
 * dirección aprueba o rechaza cada gasto y administración reintegra.
 */
export default async function ViaticosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: rolData } = await supabase.rpc("fn_rol");
  const rol = (rolData as string) ?? "comercial";
  const aprueba = rol === "direccion" || rol === "admin";
  const administra = aprueba || rol === "administrativa";

  const [sinRendir, mias, paraAprobar, paraReintegrar] = await Promise.all([
    gastosSinRendir(supabase, user!.id),
    cargarRendiciones(supabase, { usuarioId: user!.id, limite: 20 }),
    administra ? cargarRendiciones(supabase, { estados: ["enviada"] }) : Promise.resolve([]),
    administra ? cargarRendiciones(supabase, { estados: ["aprobada"] }) : Promise.resolve([]),
  ]);
  const mes = new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).slice(0, 7);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Viáticos</h1>
          <p className="text-[15px] text-piedra">Cargá cada gasto con la foto del comprobante y rendilos juntos.</p>
        </div>
        <Link href="/viaticos/nuevo" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-verde px-4 text-[15px] font-extrabold text-white">
          <Plus className="h-5 w-5" /> Cargar gasto
        </Link>
      </div>

      {administra && (
        <>
          <section className="space-y-2">
            <h2 className={titulo}>{aprueba ? "Para aprobar" : "Esperando a dirección"} ({paraAprobar.length})</h2>
            <ListaRendiciones lista={paraAprobar} conPersona vacio="No hay rendiciones esperando aprobación." />
          </section>
          <section className="space-y-2">
            <h2 className={titulo}>Para reintegrar ({paraReintegrar.length})</h2>
            <ListaRendiciones lista={paraReintegrar} conPersona vacio="No hay nada para reintegrar." />
          </section>
        </>
      )}

      <Link href={`/viaticos/resumen?mes=${mes}`} className="flex items-center gap-3 rounded-2xl border border-borde bg-white p-3.5 shadow-sm hover:border-celeste-deep">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-crema text-tinta/80">
          <BarChart3 className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Resumen del mes</span>
          <span className="block text-xs text-piedra">{administra ? "Por persona y por tipo de gasto, con Excel" : "Tus gastos por tipo, con Excel"}</span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-piedra/60" />
      </Link>

      <section className="space-y-2">
        <h2 className={titulo}>Tus gastos sin rendir ({sinRendir.length})</h2>
        {sinRendir.length ? (
          <RendirGastos
            gastos={sinRendir.map((g) => ({
              id: g.id,
              fecha: g.fecha,
              categoria: g.categoria,
              importe: g.importe,
              moneda: g.moneda,
              medio_pago: g.medio_pago,
              comercio: g.comercio,
              detalle: g.detalle,
              conComprobante: Boolean(g.archivo_path),
              cliente: g.cliente?.nombre_comercial ?? null,
            }))}
          />
        ) : (
          <p className="rounded-2xl bg-white px-4 py-4 text-center text-[15px] text-piedra shadow-sm">
            No tenés gastos sin rendir. Cargá cada gasto cuando lo hacés (sacale foto al ticket) y después rendilos todos juntos.
          </p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className={titulo}>Tus rendiciones</h2>
        <ListaRendiciones lista={mias} vacio="Todavía no rendiste gastos." />
      </section>

      <section className="rounded-2xl border border-dashed border-borde p-4 text-[14px] text-piedra">
        <p className="font-bold text-tinta/70">Cómo funciona</p>
        <p>
          1) Cargás cada gasto con la foto o el PDF del comprobante (la IA completa los datos). 2) Los rendís: le llegan a dirección. 3) Dirección
          aprueba o rechaza cada gasto. 4) Administración te devuelve lo aprobado que pagaste con tu plata (lo pagado con la tarjeta de la empresa o con
          un adelanto no se devuelve).
        </p>
      </section>
    </div>
  );
}
