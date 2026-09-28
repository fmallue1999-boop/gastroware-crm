/**
 * Versiones de GastroWare OS (docs/VERSIONES.md). La primera es la actual.
 * Cada actualización que se publica suma una versión acá, sube la de
 * package.json y se marca con un tag de git (vX.Y.Z). El test de versiones
 * falla si package.json y esta lista no coinciden.
 *
 * Cómo se numera: X.Y.Z
 *  - Z (1.0.1): arreglos, sin cambios de uso.
 *  - Y (1.1.0): funciones nuevas o cambios que el equipo nota.
 *  - X (2.0.0): cambios grandes en la forma de trabajar.
 */

export type Version = {
  version: string;
  fecha: string;
  titulo: string;
  cambios: string[];
};

export const VERSIONES: Version[] = [
  {
    version: "1.3.0",
    fecha: "2026-09-28",
    titulo: "Seguimiento comercial: qué pasó, con quién y cuál es el próximo paso",
    cambios: [
      "Registrar actividad: elegís cómo fue (Llamada, WhatsApp, Email, Visita, Demo), el resultado (Conversamos, No respondió, Quedó en responder, No le interesa) y el próximo paso con su fecha, todo en un solo guardado.",
      "El próximo paso dice qué hacer: Llamar, Escribir, Cotizar, Coordinar demo o Visitar. Si ya había uno, se puede mantener sin duplicarlo.",
      "Si cambiás la fecha del próximo contacto, anotás el motivo y la fecha anterior queda en el historial.",
      "Si no le interesa, se cierra el interés como “No se dio” en el mismo paso, sin agendar nada.",
      "Personas separadas de la empresa: cada ficha tiene su pestaña Personas (cargo, teléfono, email, quién decide la compra). Las que estaban escritas en las notas ya pasaron a Personas.",
      "Nueva consulta: nombre de la persona y empresa o proyecto por separado, localidad y provincia, y más orígenes (Instagram, Prospección, Otro).",
      "Si el teléfono o el email ya están cargados, el sistema avisa y elegís si es el mismo contacto o es otra persona: nunca se unen solos.",
      "Mi día: “Sin próximo paso” muestra las operaciones abiertas sin fecha de próximo contacto; cada fila dice la acción pendiente y, para dirección, de quién es.",
      "Cada operación queda marcada como Equipos, Consumibles o Repuestos (base para los próximos apartados).",
    ],
  },
  {
    version: "1.2.0",
    fecha: "2026-09-28",
    titulo: "Tareas y agenda del equipo, con avisos al celular",
    cambios: [
      "Nuevo apartado Tareas: tareas sueltas, reuniones, capacitaciones y recordatorios de pago (por ejemplo, el alquiler).",
      "Se asignan a una persona, a varias o a todo el equipo, con fecha, hora, links, link de la videollamada, monto y detalle.",
      "Se pueden repetir cada semana, cada 2 semanas o cada mes, y avisar el mismo día o unos días antes.",
      "Lo de hoy aparece arriba de todo en Mi día: se marca hecha (o pagado) con un toque. Lo atrasado queda en rojo.",
      "Tareas en lista o en el calendario del mes; “Lo que asigné” muestra quién ya lo hizo. Dirección ve la agenda de todo el equipo.",
      "Avisos: al que le asignan algo, le cambian la fecha o se cancela, le llega a la campana y al celular al instante; a las 8:30 llega lo del día y lo que está por vencer.",
      "Todos los avisos de la campana (consultas asignadas, aprobaciones, services…) ahora llegan también al celular apenas pasan.",
      "Botones para sumar cada tarea a Google Calendar o al calendario del iPhone / Outlook.",
      "El Asistente IA también responde sobre tu agenda (“¿qué reuniones tengo esta semana?”).",
    ],
  },
  {
    version: "1.1.0",
    fecha: "2026-09-27",
    titulo: "Asistente con IA para el trabajo de todos los días",
    cambios: [
      "Nuevo Asistente IA en el menú: preguntale con tus palabras qué tenés pendiente, qué pasa con un cliente, cómo se hace algo o pedile que te arme un WhatsApp. Mira solo lo que tu puesto puede ver y te lleva a la pantalla donde se resuelve.",
      "Nueva consulta: “Cargar desde un mensaje o una captura”. Pegás el WhatsApp o subís la captura del chat y la IA completa el formulario; vos revisás y guardás.",
      "Mi informe de los lunes: “Armar borrador con IA” lo completa con tus consultas, propuestas y números.",
      "Casos: “Ayuda IA” sugiere qué preguntarle al cliente, pruebas simples y seguras, un WhatsApp listo y si conviene derivar a servicio técnico.",
      "Botones violetas de IA en la ficha del contacto, Mi día, el tablero y cobranzas.",
      "Administración → IA: dirección elige el modelo de IA y ve el uso del mes.",
      "La IA nunca guarda, cambia ni envía nada sola: todo es borrador o consulta.",
    ],
  },
  {
    version: "1.0.0",
    fecha: "2026-09-27",
    titulo: "GastroWare OS: la empresa trabaja por puestos",
    cambios: [
      "El sistema se llama GastroWare OS y tiene la marca de GastroWare (logo, colores e ícono). Dirección la puede cambiar en Administración → Marca.",
      "Cada persona tiene un puesto y ve su Mi día con lo que le toca hoy.",
      "Las consultas se asignan por lugar de entrega al vendedor del territorio y se mide el primer contacto (dentro de la hora).",
      "Cadencia de seguimiento de propuestas (días 1, 3, 7, 14, 30 y 60) y botón “No respondió”.",
      "Las propuestas fuera de lista esperan la aprobación de dirección antes de imprimirse.",
      "Circuito de venta del manual: informar, facturar, cobrar, preparar, despachar y entregar. Nada se prepara sin cobro.",
      "Postventa automática al entregar (días 2, 10 y 30) y recontacto de consumibles a cargo de la administrativa.",
      "Cobranzas: vencidas, vencen hoy y en 48 h, promesas y reclamo por WhatsApp.",
      "Casos de postventa con plazos, derivación a servicio técnico y cierre con causa y solución.",
      "Servicio técnico: remito obligatorio con fotos, control del remito, técnicos aliados, cobro previo fuera de garantía, acta de instalación y reclamos de garantía.",
      "Informe comercial de los lunes, pedidos de material a marketing y videos por modelo.",
      "Tablero con la operación del manual y guía de uso dentro del sistema.",
    ],
  },
];

export const VERSION = VERSIONES[0].version;

/** "v1.0" para mostrar (sin el último número si es 0). */
export function versionCorta(v: string = VERSION): string {
  const [x, y, z] = v.split(".");
  return z && z !== "0" ? `v${x}.${y}.${z}` : `v${x}.${y}`;
}
