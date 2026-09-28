import { redirect } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { hoyISO } from "@/lib/format";
import { textoMontos } from "@/lib/dinero";
import { clasificarFacturas } from "@/lib/cobranzas";
import { esGestor, veTodo } from "@/lib/puestos";
import ConPanel from "@/components/ficha/ConPanel";
import CobranzaFila, { type FacturaFila } from "@/components/cobranzas/CobranzaFila";
import CargarFactura from "@/components/cobranzas/CargarFactura";
import AyudaLink from "@/components/guia/AyudaLink";

const COLS =
  "id, cliente_id, numero, tipo, fecha, vencimiento, monto, moneda, cobro_estado, promesa_fecha, ultimo_reclamo_at, condicion_aprobada_at, condicion_nota, oportunidad_id, cliente:clientes(nombre_comercial, telefono)";

function sumar(lista: FacturaFila[]): Record<string, number> {
  const t: Record<string, number> = {};
  for (const f of lista) if (f.monto != null) t[f.moneda] = (t[f.moneda] ?? 0) + Number(f.monto);
  return t;
}

function Grupo({
  titulo,
  lista,
  color,
  hoy,
  puedeAprobar,
}: {
  titulo: string;
  lista: FacturaFila[];
  color: string;
  hoy: string;
  puedeAprobar: boolean;
}) {
  if (!lista.length) return null;
  return (
    <section>
      <h2 className="mb-2 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wide text-piedra">
        <span className={`rounded-full px-2 py-0.5 ${color}`}>{lista.length}</span>
        {titulo}
        <span className="font-extrabold normal-case text-tinta">{textoMontos(sumar(lista))}</span>
      </h2>
      <div className="grid gap-2 lg:grid-cols-2">
        {lista.map((f) => (
          <CobranzaFila key={f.id} f={f} hoy={hoy} puedeAprobar={puedeAprobar} />
        ))}
      </div>
    </section>
  );
}

/**
 * Cobranzas (manual 4.4): lo que hay que cobrar hoy. Vencidas primero,
 * después vencen hoy y en 48 h hábiles, y las promesas. Las facturas que
 * frenan un despacho se marcan.
 */
export default async function CobranzasPage({ searchParams }: { searchParams: Promise<{ c?: string; interes?: string }> }) {
  const { c, interes } = await searchParams;
  const supabase = await createClient();
  const { data: rol } = await supabase.rpc("fn_rol");
  if (!veTodo(rol as string)) redirect("/");
  const hoy = hoyISO();

  const [{ data: abiertas }, { data: cobradas }, { data: frenadas }] = await Promise.all([
    supabase.from("facturas").select(COLS).neq("cobro_estado", "cobrado").order("vencimiento").limit(1000),
    supabase.from("facturas").select(COLS).eq("cobro_estado", "cobrado").order("cobrado_at", { ascending: false }).limit(30),
    supabase.from("oportunidades").select("id").eq("etapa", "ganada").eq("pedido_estado", "facturado"),
  ]);
  const ventasFrenadas = new Set(((frenadas ?? []) as { id: string }[]).map((o) => o.id));
  const todas = [...((abiertas ?? []) as unknown as FacturaFila[]), ...((cobradas ?? []) as unknown as FacturaFila[])].map((f) => ({
    ...f,
    frenaDespacho: Boolean(f.oportunidad_id && ventasFrenadas.has(f.oportunidad_id) && !f.condicion_aprobada_at),
  }));
  const g = clasificarFacturas(todas, hoy);
  const frenan = [...g.vencidas, ...g.hoy, ...g.en48, ...g.prometidas, ...g.alDia].filter((f) => f.frenaDespacho);
  const puedeAprobar = esGestor(rol as string);


  const kpi = "rounded-2xl bg-white p-3 shadow-sm";
  return (
    <ConPanel c={c} interes={interes} cerrarHref="/cobranzas">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="flex flex-wrap items-center gap-x-2 text-2xl font-extrabold tracking-tight">
          Cobranzas <AyudaLink tarea="cobranzas" />
        </h1>
            <p className="text-[15px] text-piedra">Nada se despacha sin cobro acreditado o condición aprobada.</p>
          </div>
          <CargarFactura hoy={hoy} />
        </div>

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <div className={kpi}>
            <p className="text-[11px] font-bold uppercase tracking-wide text-piedra">Vencidas</p>
            <p className="text-2xl font-extrabold text-red-600">{g.vencidas.length}</p>
            <p className="truncate text-xs text-piedra">{textoMontos(sumar(g.vencidas)) || "—"}</p>
          </div>
          <div className={kpi}>
            <p className="text-[11px] font-bold uppercase tracking-wide text-piedra">Vencen hoy</p>
            <p className="text-2xl font-extrabold">{g.hoy.length}</p>
            <p className="truncate text-xs text-piedra">{textoMontos(sumar(g.hoy)) || "—"}</p>
          </div>
          <div className={kpi}>
            <p className="text-[11px] font-bold uppercase tracking-wide text-piedra">Vencen en 48 h</p>
            <p className="text-2xl font-extrabold">{g.en48.length}</p>
            <p className="truncate text-xs text-piedra">{textoMontos(sumar(g.en48)) || "—"}</p>
          </div>
          <div className={kpi}>
            <p className="text-[11px] font-bold uppercase tracking-wide text-piedra">Frenan un despacho</p>
            <p className="text-2xl font-extrabold text-violeta">{frenan.length}</p>
            <p className="truncate text-xs text-piedra">ventas facturadas sin cobro</p>
          </div>
        </div>

        <Grupo titulo="Vencidas" lista={g.vencidas} color="bg-red-100 text-red-700" hoy={hoy} puedeAprobar={puedeAprobar} />
        <Grupo titulo="Vencen hoy" lista={g.hoy} color="bg-ambar-soft text-ambar" hoy={hoy} puedeAprobar={puedeAprobar} />
        <Grupo titulo="Vencen en 48 h" lista={g.en48} color="bg-azul-soft text-azul" hoy={hoy} puedeAprobar={puedeAprobar} />
        <Grupo titulo="Prometieron pagar" lista={g.prometidas} color="bg-celeste-soft text-marino" hoy={hoy} puedeAprobar={puedeAprobar} />

        {g.vencidas.length + g.hoy.length + g.en48.length + g.prometidas.length === 0 && (
          <p className="rounded-2xl bg-white px-4 py-6 text-center text-lg font-bold text-verde shadow-sm">Nada para cobrar hoy.</p>
        )}

        {g.alDia.length > 0 && (
          <details className="group">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-[15px] font-bold text-piedra [&::-webkit-details-marker]:hidden">
              Al día, vencen más adelante ({g.alDia.length}) · {textoMontos(sumar(g.alDia))}
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-2 grid gap-2 lg:grid-cols-2">
              {g.alDia.map((f) => (
                <CobranzaFila key={f.id} f={f} hoy={hoy} puedeAprobar={puedeAprobar} />
              ))}
            </div>
          </details>
        )}
        {g.cobradas.length > 0 && (
          <details className="group">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-[15px] font-bold text-piedra [&::-webkit-details-marker]:hidden">
              Cobradas hace poco ({g.cobradas.length})
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-2 grid gap-2 lg:grid-cols-2">
              {g.cobradas.map((f) => (
                <CobranzaFila key={f.id} f={f} hoy={hoy} puedeAprobar={false} />
              ))}
            </div>
          </details>
        )}
      </div>
    </ConPanel>
  );
}
