import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { firmarUrl } from "@/lib/core/storage";
import { fechaCorta, telefonoProlijo } from "@/lib/format";
import {
  esInspeccion,
  parseItemChecklist,
  respuestaObj,
} from "@/lib/checklist";
import BotonImprimir from "@/components/BotonImprimir";
import type { OrdenTrabajo, OTChecklist, Sucursal } from "@/lib/types";

/** Hoja de inspección imprimible de una OT, para entregar al cliente. */
export default async function InspeccionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data }, { data: checklists }] = await Promise.all([
    supabase
      .from("ordenes_trabajo")
      .select(
        "*, cliente:clientes(*, sucursales(*)), equipo:equipos(*, producto:productos(*)), tecnico:usuarios!ordenes_trabajo_tecnico_id_fkey(id, nombre)"
      )
      .eq("id", id)
      .single(),
    supabase
      .from("ot_checklists")
      .select("*, plantilla:checklist_plantillas(*)")
      .eq("ot_id", id),
  ]);
  if (!data) notFound();
  const ot = data as unknown as OrdenTrabajo & {
    cliente?: { sucursales?: Sucursal[] } & OrdenTrabajo["cliente"];
  };

  const listas = ((checklists ?? []) as unknown as OTChecklist[]).filter(
    (c) => (c.plantilla?.items ?? []).length > 0
  );
  if (listas.length === 0) notFound();
  // Las de inspección primero; si no hay, se imprimen las simples
  const inspecciones = listas.filter((c) =>
    esInspeccion(c.plantilla?.items ?? [])
  );
  const aImprimir = inspecciones.length > 0 ? inspecciones : listas;

  const sucursales = ot.cliente?.sucursales ?? [];
  const principal =
    sucursales.find((s) => s.es_principal) ?? sucursales[0] ?? null;
  const firmaUrl = await firmarUrl("servicio", ot.firma_path);

  return (
    <div className="mx-auto max-w-2xl bg-white p-8 text-tinta print:p-0">
      <div className="mb-4 flex items-start justify-between border-b-2 border-tinta pb-4">
        <div>
          <h1 className="text-xl font-bold">GastroWare</h1>
          <p className="text-sm text-piedra">
            Lista de inspección — Mantenimiento preventivo
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold">OT-{ot.numero}</p>
          <p className="text-sm text-piedra">
            {fechaCorta(ot.cerrada_tecnico_at ?? ot.fecha_programada ?? ot.created_at)}
          </p>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="font-semibold">Cliente</p>
          <p>{ot.cliente?.razon_social ?? ot.cliente?.nombre_comercial}</p>
          {principal?.direccion && (
            <p className="text-piedra">{principal.direccion}</p>
          )}
          {principal?.ciudad && <p className="text-piedra">{principal.ciudad}</p>}
          {ot.cliente?.telefono && (
            <p className="text-piedra">{telefonoProlijo(ot.cliente.telefono)}</p>
          )}
        </div>
        <div>
          <p className="font-semibold">Equipo</p>
          <p>
            {ot.equipo
              ? (ot.equipo.producto?.nombre ?? ot.equipo.marca_modelo_libre)
              : "—"}
          </p>
          {ot.equipo?.numero_serie && (
            <p className="text-piedra">N.º de serie {ot.equipo.numero_serie}</p>
          )}
          <p className="text-piedra">Técnico: {ot.tecnico?.nombre ?? "—"}</p>
        </div>
      </div>

      {aImprimir.map((checklist) => {
        const items = (checklist.plantilla?.items ?? []).map(parseItemChecklist);
        const inspeccion = esInspeccion(checklist.plantilla?.items ?? []);
        return (
          <div key={checklist.id} className="mb-6">
            {aImprimir.length > 1 && (
              <p className="mb-2 text-sm font-bold">
                {checklist.plantilla?.nombre}
              </p>
            )}
            <table className="w-full border-collapse text-sm">
              <tbody>
                {items.map((item, i) => {
                  if (item.tipo === "seccion")
                    return (
                      <tr key={i}>
                        <td
                          colSpan={3}
                          className="border-b border-tinta pt-3 pb-1 text-xs font-bold uppercase tracking-wide"
                        >
                          {item.texto}
                        </td>
                      </tr>
                    );

                  const r = respuestaObj(checklist.respuestas?.[String(i)]);
                  const simpleHecho =
                    checklist.respuestas?.[String(i)] === true;

                  if (item.tipo === "medicion")
                    return (
                      <tr key={i} className="border-b border-borde/70">
                        <td className="py-1 pr-2">{item.texto}</td>
                        <td colSpan={2} className="py-1 text-right font-medium">
                          {r.v ?? "________"}
                        </td>
                      </tr>
                    );

                  return (
                    <tr key={i} className="border-b border-borde/70">
                      <td className="py-1 pr-2">
                        {item.texto}
                        {r.c && (
                          <span className="block text-xs italic text-piedra">
                            Obs.: {r.c}
                          </span>
                        )}
                      </td>
                      {inspeccion ? (
                        <>
                          <td className="w-10 py-1 text-center font-semibold">
                            {r.r === "si" ? "☑ SÍ" : "☐ SÍ"}
                          </td>
                          <td className="w-10 py-1 text-center font-semibold">
                            {r.r === "no" ? "☑ NO" : "☐ NO"}
                          </td>
                        </>
                      ) : (
                        <td colSpan={2} className="w-20 py-1 text-center">
                          {simpleHecho ? "☑" : "☐"}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}

      {ot.trabajo_realizado && (
        <div className="mb-5 text-sm">
          <p className="font-semibold">Notas / Observaciones</p>
          <p className="whitespace-pre-wrap">{ot.trabajo_realizado}</p>
        </div>
      )}

      <div className="mt-8 grid grid-cols-2 gap-8 text-sm">
        <div>
          <div className="h-16">
            {firmaUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={firmaUrl} alt="Firma del cliente" className="h-16" />
            )}
          </div>
          <p className="border-t border-tinta pt-1">
            Cliente — firma y aclaración
            {ot.firmante ? `: ${ot.firmante}` : ""}
          </p>
        </div>
        <div>
          <div className="h-16" />
          <p className="border-t border-tinta pt-1">
            Técnico — firma y aclaración
            {ot.tecnico?.nombre ? `: ${ot.tecnico.nombre}` : ""}
          </p>
        </div>
      </div>

      <p className="mt-6 text-xs text-piedra">
        GastroWare · Servicio técnico oficial · Mantenimiento preventivo según
        lista de inspección del fabricante.
      </p>

      <BotonImprimir />
    </div>
  );
}
