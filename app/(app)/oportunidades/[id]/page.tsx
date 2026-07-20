import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fechaCorta, dinero } from "@/lib/format";
import { ProductoBadge } from "@/components/Badges";
import EtapaControl from "@/components/EtapaControl";
import TemperaturaControl from "@/components/TemperaturaControl";
import DiagnosticoForm from "@/components/DiagnosticoForm";
import CotizacionForm from "@/components/CotizacionForm";
import ObjecionControl from "@/components/ObjecionControl";
import PlantillaCopiar from "@/components/PlantillaCopiar";
import MaterialItem from "@/components/MaterialItem";
import NotaForm from "@/components/NotaForm";
import { rellenarPlantilla } from "@/lib/format";
import type {
  Actividad,
  Cotizacion,
  Oportunidad,
  Plantilla,
  Tarea,
} from "@/lib/types";

export default async function OportunidadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("oportunidades")
    .select("*, cliente:clientes(*), producto:productos(*)")
    .eq("id", id)
    .single();
  if (!data) notFound();
  const opp = data as unknown as Oportunidad;

  const [cotizacionesRes, tareasRes, plantillasRes, actividadesRes, materialesRes] =
    await Promise.all([
      supabase
        .from("cotizaciones")
        .select("*")
        .eq("oportunidad_id", id)
        .order("enviada_at", { ascending: false }),
      supabase
        .from("tareas")
        .select("*")
        .eq("oportunidad_id", id)
        .is("completada_at", null)
        .eq("cancelada", false)
        .order("vence_el"),
      supabase.from("plantillas").select("*"),
      supabase
        .from("actividades")
        .select("*")
        .eq("oportunidad_id", id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("materiales")
        .select("id, nombre, tipo, url, producto_id")
        .order("nombre"),
    ]);

  const cotizaciones = (cotizacionesRes.data ?? []) as Cotizacion[];
  const tareas = (tareasRes.data ?? []) as Tarea[];
  const plantillas = (plantillasRes.data ?? []) as Plantilla[];
  const actividades = (actividadesRes.data ?? []) as Actividad[];
  const materiales = (
    (materialesRes.data ?? []) as {
      id: string;
      nombre: string;
      tipo: string;
      url: string | null;
      producto_id: string | null;
    }[]
  ).filter((m) => !m.producto_id || m.producto_id === opp.producto_id);

  const categoria = opp.producto?.categoria ?? "otro";
  const esZumex = categoria === "exprimidora";
  const esGX = categoria === "licuadora";

  const diag = opp.diagnostico ?? {};
  const faltaDiagnostico = esZumex
    ? !diag.vasos_dia || !diag.precio_vaso
    : esGX
      ? !diag.uso_principal || !diag.usos_por_dia
      : false;

  const usosRelevantes = esZumex
    ? ["diagnostico:zumex", "precio:zumex"]
    : esGX
      ? ["diagnostico:gx", "precio:gx"]
      : [];
  const plantillasUtiles = plantillas.filter(
    (p) => usosRelevantes.includes(p.uso) || p.uso === "objecion:precio"
  );

  const vars = {
    nombre: opp.cliente?.nombre_comercial ?? "",
    producto: opp.producto?.nombre ?? "el producto",
    monto: opp.monto_estimado
      ? dinero(opp.monto_estimado, opp.moneda)
      : "$X",
  };

  return (
    <div className="space-y-5">
      <header>
        <Link
          href={`/clientes/${opp.cliente_id}`}
          className="text-sm text-sky-700"
        >
          ← {opp.cliente?.nombre_comercial}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold">
            {opp.producto?.nombre ?? "Consulta"}
          </h1>
          <ProductoBadge nombre={opp.cliente?.rubro} />
          <TemperaturaControl
            oportunidadId={opp.id}
            temperatura={opp.temperatura}
          />
        </div>
        <p className="mt-0.5 text-sm text-piedra">
          {opp.origen} · creada {fechaCorta(opp.created_at)}
          {opp.monto_estimado
            ? ` · ${dinero(opp.monto_estimado, opp.moneda)}`
            : ""}
        </p>
        {opp.mensaje_inicial && (
          <p className="mt-1 text-sm text-tinta/70 italic">
            “{opp.mensaje_inicial}”
          </p>
        )}
      </header>

      <EtapaControl
        oportunidadId={opp.id}
        etapa={opp.etapa}
        motivoPerdida={opp.motivo_perdida}
      />

      {(esGX || esZumex) && (
        <section className="rounded-xl border border-borde bg-white p-4">
          <h2 className="text-sm font-semibold mb-1">
            Diagnóstico {faltaDiagnostico && (
              <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                incompleto — completar antes de cotizar
              </span>
            )}
          </h2>
          <DiagnosticoForm
            oportunidadId={opp.id}
            categoria={categoria}
            diagnostico={diag}
          />
        </section>
      )}

      <section className="rounded-xl border border-borde bg-white p-4">
        <h2 className="text-sm font-semibold mb-2">Cotizaciones</h2>
        {cotizaciones.map((c) => (
          <div
            key={c.id}
            className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-crema px-3 py-2 text-sm"
          >
            <span>
              {dinero(c.monto, c.moneda)}
              {c.forma_pago ? ` · ${c.forma_pago}` : ""}
              <span className="text-piedra/80">
                {" "}
                · {fechaCorta(c.enviada_at)}
              </span>
            </span>
            {c.archivo_url && (
              <a
                href={c.archivo_url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-sky-700"
              >
                Ver PDF
              </a>
            )}
          </div>
        ))}
        <CotizacionForm
          oportunidadId={opp.id}
          monedaDefault={opp.producto?.moneda ?? "ARS"}
          advertencia={
            faltaDiagnostico
              ? esZumex
                ? "Falta la cuenta de recupero (vasos por día y precio). El precio suelto es donde se pierde la venta."
                : "Falta el diagnóstico (uso y volumen). El precio suelto es donde se pierde la venta."
              : null
          }
        />
      </section>

      <ObjecionControl
        oportunidadId={opp.id}
        objecion={opp.objecion_principal}
      />

      {plantillasUtiles.length > 0 && (
        <section className="rounded-xl border border-borde bg-white p-4">
          <h2 className="text-sm font-semibold mb-2">Mensajes listos</h2>
          <div className="space-y-2">
            {plantillasUtiles.map((p) => (
              <PlantillaCopiar
                key={p.id}
                nombre={p.nombre}
                texto={rellenarPlantilla(p.contenido, vars)}
                telefono={opp.cliente?.telefono ?? null}
              />
            ))}
          </div>
        </section>
      )}

      {materiales.length > 0 && (
        <section className="rounded-xl border border-borde bg-white p-4">
          <h2 className="text-sm font-semibold mb-2">Material para mandar</h2>
          <div className="space-y-2">
            {materiales.map((m) => (
              <MaterialItem
                key={m.id}
                material={m}
                telefono={opp.cliente?.telefono ?? null}
              />
            ))}
          </div>
        </section>
      )}

      {tareas.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-2">Próximas acciones</h2>
          <div className="space-y-1.5">
            {tareas.map((t) => (
              <p key={t.id} className="text-sm text-tinta/70">
                <span className="text-piedra/80">
                  {fechaCorta(t.vence_el)}:
                </span>{" "}
                {t.titulo}
              </p>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold mb-2">Notas</h2>
        <NotaForm clienteId={opp.cliente_id} oportunidadId={opp.id} />
        <div className="mt-3 space-y-2">
          {actividades.map((a) => (
            <p key={a.id} className="text-sm">
              <span className="text-piedra/80">
                {fechaCorta(a.created_at)}
              </span>{" "}
              <span className="text-tinta/80">{a.contenido}</span>
            </p>
          ))}
        </div>
      </section>
    </div>
  );
}
