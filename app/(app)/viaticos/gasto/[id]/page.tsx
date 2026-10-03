import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { iaConfigurada } from "@/lib/core/ia";
import { firmarUrl } from "@/lib/core/storage";
import { COLS_GASTO, type Gasto } from "@/lib/servidor/viaticos";
import GastoForm from "@/components/viaticos/GastoForm";
import TarjetaGasto from "@/components/viaticos/TarjetaGasto";

/** Un gasto (v1.25): si es propio y no se rindió, se corrige o se borra; si ya se rindió, se ve en su rendición. */
export default async function GastoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data } = await supabase.from("gastos").select(COLS_GASTO).eq("id", id).maybeSingle();
  if (!data) notFound();
  const g = { ...(data as unknown as Gasto), importe: Number((data as unknown as Gasto).importe) };
  if (g.rendicion_id) redirect(`/viaticos/rendicion/${g.rendicion_id}`);
  const url = await firmarUrl("viaticos", g.archivo_path);
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
  const propio = g.usuario_id === user!.id;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/viaticos" className="inline-flex min-h-10 items-center gap-1 text-[14px] font-bold text-piedra hover:text-marino">
        <ChevronLeft className="h-4 w-4" /> Viáticos
      </Link>
      <h1 className="text-2xl font-extrabold tracking-tight">{propio ? "Corregir gasto" : `Gasto de ${g.usuario?.nombre ?? "—"}`}</h1>
      {propio ? (
        <GastoForm
          usuarioId={user!.id}
          hoy={hoy}
          iaOn={iaConfigurada()}
          id={g.id}
          urlComprobante={url}
          inicial={{
            fecha: g.fecha,
            categoria: g.categoria,
            importe: g.importe,
            moneda: g.moneda,
            medio_pago: g.medio_pago,
            comercio: g.comercio,
            cuit: g.cuit,
            tipo_comprobante: g.tipo_comprobante,
            numero_comprobante: g.numero_comprobante,
            iva: g.iva,
            detalle: g.detalle,
            clienteId: g.cliente_id,
            cliente: g.cliente_id && g.cliente ? { id: g.cliente_id, nombre_comercial: g.cliente.nombre_comercial } : null,
            archivoPath: g.archivo_path,
            leidoPorIA: g.leido_por_ia,
          }}
        />
      ) : (
        <>
          <p className="text-[15px] text-piedra">Todavía no lo rindió.</p>
          <TarjetaGasto g={g} url={url} />
        </>
      )}
    </div>
  );
}
