import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fechaCorta } from "@/lib/format";
import { ESTADOS_RENDICION, aReintegrar, estadoRendicion, hayAlgo, textoTotales, totalPorMoneda } from "@/lib/viaticos";
import { cargarRendicion } from "@/lib/servidor/viaticos";
import TarjetaGasto from "@/components/viaticos/TarjetaGasto";
import { AccionesRendicion, DecidirGasto } from "@/components/viaticos/AccionesRendicion";

/**
 * Una rendición de viáticos (v1.25): los gastos con sus comprobantes;
 * dirección aprueba o rechaza cada uno y administración marca el reintegro.
 */
export default async function RendicionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    { data: rolData },
    datos,
  ] = await Promise.all([supabase.auth.getUser(), supabase.rpc("fn_rol"), cargarRendicion(supabase, id)]);
  if (!datos) notFound();
  const { rendicion: r, gastos, urls } = datos;
  const rol = (rolData as string) ?? "comercial";
  const puedeAprobar = rol === "direccion" || rol === "admin";
  const puedeReintegrar = puedeAprobar || rol === "administrativa";
  const propia = r.usuario_id === user!.id;
  const e = ESTADOS_RENDICION[estadoRendicion(r.estado)];
  const pendientes = gastos.filter((g) => !g.decision).length;
  const aprobados = gastos.filter((g) => g.decision === "aprobado");
  const devolver = aReintegrar(gastos);
  const decidirAhora = puedeAprobar && r.estado === "enviada";
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
  const { data: nombresData } = await supabase.from("usuarios").select("id, nombre").in("id", [r.revisada_por, r.reintegrada_por].filter((x): x is string => Boolean(x)));
  const nombre = new Map(((nombresData ?? []) as { id: string; nombre: string }[]).map((u) => [u.id, u.nombre]));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/viaticos" className="inline-flex min-h-10 items-center gap-1 text-[14px] font-bold text-piedra hover:text-marino">
        <ChevronLeft className="h-4 w-4" /> Viáticos
      </Link>

      <div className="space-y-2 rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-extrabold tracking-tight">
            Rendición N° {r.numero}
            {propia ? "" : ` · ${r.usuario?.nombre ?? "—"}`}
          </h1>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${e.clase}`}>{e.label}</span>
        </div>
        <p className="text-[14px] text-piedra">
          Enviada el {fechaCorta(r.enviada_at)} · {gastos.length} {gastos.length === 1 ? "gasto" : "gastos"} · {e.detalle}
        </p>
        {r.nota && <p className="rounded-xl bg-crema px-3 py-2 text-[15px]">“{r.nota}”</p>}
        <dl className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-3">
          <div className="rounded-xl bg-crema px-3 py-2">
            <dt className="text-xs font-bold text-piedra">Rendido</dt>
            <dd className="text-[16px] font-extrabold">{textoTotales(totalPorMoneda(gastos))}</dd>
          </div>
          <div className="rounded-xl bg-crema px-3 py-2">
            <dt className="text-xs font-bold text-piedra">Aprobado</dt>
            <dd className="text-[16px] font-extrabold">{r.estado === "enviada" && pendientes === gastos.length ? "—" : textoTotales(totalPorMoneda(aprobados))}</dd>
          </div>
          <div className="rounded-xl bg-crema px-3 py-2">
            <dt className="text-xs font-bold text-piedra">{r.estado === "reintegrada" ? "Reintegrado" : "A devolver"}</dt>
            <dd className="text-[16px] font-extrabold">{r.estado === "enviada" ? "—" : textoTotales(devolver)}</dd>
          </div>
        </dl>
        {r.estado === "enviada" && pendientes > 0 && pendientes < gastos.length && (
          <p className="text-[14px] text-piedra">
            Revisados {gastos.length - pendientes} de {gastos.length}.
          </p>
        )}
        {r.revisada_at && (
          <p className="text-[13px] text-piedra">
            Revisada por {nombre.get(r.revisada_por ?? "") ?? "dirección"} el {fechaCorta(r.revisada_at)}
          </p>
        )}
        {r.estado === "reintegrada" && (
          <p className="rounded-xl bg-verde-soft px-3 py-2 text-[15px] font-bold text-verde">
            Reintegrado el {fechaCorta(r.reintegro_fecha)}
            {r.reintegro_nota ? ` · ${r.reintegro_nota}` : ""}
            {r.reintegrada_por ? ` · marcó ${nombre.get(r.reintegrada_por) ?? "administración"}` : ""}
          </p>
        )}
        {r.estado === "cerrada" && !hayAlgo(devolver) && <p className="text-[14px] text-piedra">No hay nada para devolver (lo aprobado se pagó con la tarjeta de la empresa o un adelanto, o se rechazó todo).</p>}
      </div>

      <AccionesRendicion
        rendicionId={r.id}
        estado={r.estado}
        pendientes={pendientes}
        hoy={hoy}
        puedeAprobar={puedeAprobar}
        puedeReintegrar={puedeReintegrar}
        puedeRetirar={propia && r.estado === "enviada" && pendientes === gastos.length}
      />

      <div className="space-y-3">
        {gastos.map((g) => (
          <TarjetaGasto key={g.id} g={g} url={g.archivo_path ? urls.get(g.archivo_path) : null}>
            {decidirAhora && <DecidirGasto gastoId={g.id} decision={g.decision} />}
          </TarjetaGasto>
        ))}
      </div>
    </div>
  );
}
