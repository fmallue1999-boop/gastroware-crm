import { diaLargo, esEvento, estadoAgenda, horaCorta, masDias, textoFaltan, tocaAvisar } from "@/lib/agenda";
import { dinero, fechaCorta } from "@/lib/format";
import type { SupabaseServidor } from "@/lib/actions/comun";

/**
 * Recordatorios de la agenda para el cron de la mañana (8:30): deja en la
 * campana de cada persona lo que vence hoy y lo que entró en sus días de
 * aviso (una sola vez por día, columna avisado_el) y arma una línea por
 * persona para el aviso al celular. Corre con la clave de servicio.
 */

type Fila = {
  agenda_id: string;
  usuario_id: string;
  avisado_el: string | null;
  agenda: { id: string; titulo: string; tipo: string; fecha: string; hora: string | null; aviso_dias: number; monto: number | null; moneda: string };
};

export async function recordatoriosAgenda(db: SupabaseServidor, hoy: string): Promise<Map<string, string>> {
  const resumen = new Map<string, string>();
  const { data, error } = await db
    .from("agenda_personas")
    .select("agenda_id, usuario_id, avisado_el, agenda:agenda!inner(id, titulo, tipo, fecha, hora, aviso_dias, monto, moneda)")
    .is("hecha_at", null)
    .gte("agenda.fecha", masDias(hoy, -120))
    .lte("agenda.fecha", masDias(hoy, 30))
    .limit(5000);
  if (error || !data) return resumen;
  const filas = data as unknown as Fila[];

  // 1. Campana: el día de aviso y el día mismo, una vez
  const nuevas = filas.filter((f) => tocaAvisar(f.agenda, hoy) && f.avisado_el !== hoy);
  if (nuevas.length) {
    const ahora = new Date().toISOString();
    await db.from("notificaciones").insert(
      nuevas.map((f) => {
        const a = f.agenda;
        const pago = a.tipo === "pago" && a.monto != null ? ` · ${dinero(Number(a.monto), a.moneda)}` : "";
        const titulo = a.fecha === hoy ? `Hoy${a.hora ? ` ${horaCorta(a.hora)}` : ""}: ${a.titulo}` : `${textoFaltan(a.fecha, hoy)}: ${a.titulo}`;
        return {
          usuario_id: f.usuario_id,
          tipo: "agenda_aviso",
          titulo: `${titulo}${pago}`.slice(0, 200),
          cuerpo: a.tipo === "pago" ? `Vence el ${diaLargo(a.fecha)}` : diaLargo(a.fecha),
          url: `/tareas/${a.id}`,
          // Va en el aviso de la mañana: no se manda aparte
          push_at: ahora,
        };
      })
    );
    const porAgenda = new Map<string, string[]>();
    for (const f of nuevas) porAgenda.set(f.agenda_id, [...(porAgenda.get(f.agenda_id) ?? []), f.usuario_id]);
    await Promise.all(
      [...porAgenda.entries()].map(([agendaId, usuarios]) =>
        db.from("agenda_personas").update({ avisado_el: hoy }).eq("agenda_id", agendaId).in("usuario_id", usuarios)
      )
    );
  }

  // 2. Una línea por persona para el celular
  const porUsuario = new Map<string, Fila[]>();
  for (const f of filas) porUsuario.set(f.usuario_id, [...(porUsuario.get(f.usuario_id) ?? []), f]);
  for (const [usuario, mias] of porUsuario) {
    const deHoy = mias.filter((f) => f.agenda.fecha === hoy).sort((a, b) => (a.agenda.hora ?? "").localeCompare(b.agenda.hora ?? ""));
    const avisos = mias.filter((f) => f.agenda.fecha > hoy && estadoAgenda(f.agenda, hoy, false) === "aviso");
    const atrasadas = mias.filter((f) => f.agenda.fecha < hoy && !esEvento(f.agenda.tipo));
    const partes = [
      ...deHoy.slice(0, 3).map((f) => `${f.agenda.hora ? `${horaCorta(f.agenda.hora)} ` : ""}${f.agenda.titulo}`),
      ...(deHoy.length > 3 ? [`y ${deHoy.length - 3} más hoy`] : []),
      ...avisos.slice(0, 2).map((f) => `${f.agenda.titulo} (${fechaCorta(f.agenda.fecha)})`),
      ...(atrasadas.length ? [`${atrasadas.length} atrasada${atrasadas.length > 1 ? "s" : ""}`] : []),
    ];
    if (partes.length) resumen.set(usuario, `Agenda: ${partes.join(" · ")}.`);
  }
  return resumen;
}
