import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { firmarUrl } from "@/lib/core/storage";
import { fechaCorta, dinero, rellenarPlantilla } from "@/lib/format";
import { EtapaBadge } from "@/components/Badges";
import EtapaControl from "@/components/EtapaControl";
import TemperaturaControl from "@/components/TemperaturaControl";
import DiagnosticoForm from "@/components/DiagnosticoForm";
import CotizacionForm from "@/components/CotizacionForm";
import ObjecionControl from "@/components/ObjecionControl";
import PlantillaCopiar from "@/components/PlantillaCopiar";
import MaterialItem from "@/components/MaterialItem";
import NotaForm from "@/components/NotaForm";
import { AccionAhora, CrearAccionRapida } from "@/components/AccionAhora";
import type {
  Actividad,
  Cotizacion,
  Oportunidad,
  Plantilla,
  Tarea,
} from "@/lib/types";

const sumario =
  "flex cursor-pointer items-center justify-between rounded-2xl border border-borde bg-white shadow-sm px-4 py-3 text-sm font-medium list-none [&::-webkit-details-marker]:hidden";

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
        .select("*, versiones:cotizacion_versiones(*)")
        .eq("oportunidad_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("tareas")
        .select("*, plantilla:plantillas(*)")
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
  // Aplanar versiones (la más nueva primero) y firmar los PDFs del bucket privado
  const versiones = await Promise.all(
    cotizaciones
      .flatMap((c) =>
        (c.versiones ?? []).map((v) => ({ ...v, numeroCot: c.numero }))
      )
      .sort((a, b) => (b.created_at < a.created_at ? -1 : 1))
      .map(async (v) => ({
        ...v,
        archivoUrl: await firmarUrl("documentos", v.archivo_path),
      }))
  );
  const tareas = (tareasRes.data ?? []) as unknown as Tarea[];
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
    monto: opp.monto_estimado ? dinero(opp.monto_estimado, opp.moneda) : "$X",
  };

  const cerrada = opp.etapa === "ganada" || opp.etapa === "perdida";
  const proximaTarea = tareas[0] ?? null;
  const mostrarDiagnosticoArriba =
    !cerrada && faltaDiagnostico && (esGX || esZumex);

  return (
    <div className="space-y-3">
      <header className="rounded-2xl border border-borde bg-white shadow-sm p-4">
        <Link href={`/clientes/${opp.cliente_id}`} className="text-sm text-sky-700">
          ← {opp.cliente?.nombre_comercial}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold">
            {opp.producto?.nombre ?? "Consulta"}
          </h1>
          <EtapaBadge etapa={opp.etapa} />
          <TemperaturaControl oportunidadId={opp.id} temperatura={opp.temperatura} />
        </div>
        <p className="mt-0.5 text-sm text-piedra">
          {opp.cliente?.rubro} · {opp.origen} · {fechaCorta(opp.created_at)}
          {opp.monto_estimado ? ` · ${dinero(opp.monto_estimado, opp.moneda)}` : ""}
        </p>
      </header>

      {cerrada ? (
        <EtapaControl
          oportunidadId={opp.id}
          etapa={opp.etapa}
          motivoPerdida={opp.motivo_perdida}
        />
      ) : mostrarDiagnosticoArriba ? (
        <div className="rounded-2xl border-2 border-celeste-deep bg-white shadow-sm p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700 mb-1">
            Ahora toca
          </p>
          <p className="text-sm font-medium mb-2">
            Diagnóstico antes de cotizar
            {esZumex ? " — la cuenta de recupero es el argumento" : ""}
          </p>
          <DiagnosticoForm
            oportunidadId={opp.id}
            categoria={categoria}
            diagnostico={diag}
          />
        </div>
      ) : proximaTarea ? (
        <AccionAhora
          tarea={proximaTarea}
          telefono={opp.cliente?.telefono ?? null}
          vars={vars}
        />
      ) : (
        <CrearAccionRapida clienteId={opp.cliente_id} oportunidadId={opp.id} />
      )}

      {(esGX || esZumex) && !mostrarDiagnosticoArriba && (
        <details className="group">
          <summary className={sumario}>
            <span>
              Diagnóstico{" "}
              {!faltaDiagnostico && esZumex && diag.recupero_meses ? (
                <span className="text-green-700 font-normal">
                  ✓ recupero {String(diag.recupero_meses)} meses
                </span>
              ) : !faltaDiagnostico ? (
                <span className="text-green-700 font-normal">✓ completo</span>
              ) : null}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-piedra transition-transform group-open:rotate-90" />
          </summary>
          <div className="mt-2 rounded-2xl border border-borde bg-white shadow-sm p-4">
            <DiagnosticoForm
              oportunidadId={opp.id}
              categoria={categoria}
              diagnostico={diag}
            />
          </div>
        </details>
      )}

      <details className="group" {...(versiones.length === 0 && !cerrada && !faltaDiagnostico ? { open: true } : {})}>
        <summary className={sumario}>
          <span>
            Cotizaciones{" "}
            <span className="font-normal text-piedra">({versiones.length})</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-piedra transition-transform group-open:rotate-90" />
        </summary>
        <div className="mt-2 rounded-2xl border border-borde bg-white shadow-sm p-4">
          {versiones.map((v) => (
            <div
              key={v.id}
              className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-crema px-3 py-2 text-sm"
            >
              <span>
                <span className="font-medium">
                  COT-{v.numeroCot} v{v.version}
                </span>{" "}
                · {dinero(v.total ?? 0, v.moneda)}
                {v.forma_pago ? ` · ${v.forma_pago}` : ""}
                <span className="text-piedra"> · {fechaCorta(v.created_at)}</span>
              </span>
              {v.archivoUrl && (
                <a
                  href={v.archivoUrl}
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
        </div>
      </details>

      <details className="group">
        <summary className={sumario}>
          <span>
            Guiones y objeción{" "}
            {opp.objecion_principal && (
              <span className="font-normal text-amber-700">
                · {opp.objecion_principal}
              </span>
            )}
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-piedra transition-transform group-open:rotate-90" />
        </summary>
        <div className="mt-2 space-y-3">
          <ObjecionControl oportunidadId={opp.id} objecion={opp.objecion_principal} />
          {plantillasUtiles.length > 0 && (
            <div className="rounded-2xl border border-borde bg-white shadow-sm p-4 space-y-2">
              {plantillasUtiles.map((p) => (
                <PlantillaCopiar
                  key={p.id}
                  nombre={p.nombre}
                  texto={rellenarPlantilla(p.contenido, vars)}
                  telefono={opp.cliente?.telefono ?? null}
                />
              ))}
            </div>
          )}
        </div>
      </details>

      {materiales.length > 0 && (
        <details className="group">
          <summary className={sumario}>
            <span>
              Material para mandar{" "}
              <span className="font-normal text-piedra">({materiales.length})</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-piedra transition-transform group-open:rotate-90" />
          </summary>
          <div className="mt-2 space-y-2">
            {materiales.map((m) => (
              <MaterialItem
                key={m.id}
                material={m}
                telefono={opp.cliente?.telefono ?? null}
              />
            ))}
          </div>
        </details>
      )}

      <details className="group">
        <summary className={sumario}>
          <span>Historial y notas</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-piedra transition-transform group-open:rotate-90" />
        </summary>
        <div className="mt-2 rounded-2xl border border-borde bg-white shadow-sm p-4">
          {opp.mensaje_inicial && (
            <p className="mb-2 text-sm text-tinta/70 italic">
              “{opp.mensaje_inicial}”
            </p>
          )}
          {tareas.length > 1 && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-piedra mb-1">
                Próximas acciones
              </p>
              {tareas.map((t) => (
                <p key={t.id} className="text-sm text-tinta/70">
                  <span className="text-piedra">{fechaCorta(t.vence_el)}:</span>{" "}
                  {t.titulo}
                </p>
              ))}
            </div>
          )}
          <NotaForm clienteId={opp.cliente_id} oportunidadId={opp.id} />
          <div className="mt-3 space-y-2">
            {actividades.map((a) => (
              <p key={a.id} className="text-sm">
                <span className="text-piedra">{fechaCorta(a.created_at)}</span>{" "}
                <span className="text-tinta/80">{a.contenido}</span>
              </p>
            ))}
          </div>
        </div>
      </details>

      {!cerrada && (
        <EtapaControl
          oportunidadId={opp.id}
          etapa={opp.etapa}
          motivoPerdida={opp.motivo_perdida}
        />
      )}
    </div>
  );
}
