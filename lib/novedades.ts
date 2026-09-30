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
    version: "1.10.1",
    fecha: "2026-09-30",
    titulo: "Calendario: arranca en el día de hoy",
    cambios: [
      "En la vista MES, el calendario se desplaza solo hasta el día de hoy.",
      "Título de la semana más prolijo (“Semana del 28/09 al 04/10/2026”).",
    ],
  },
  {
    version: "1.10.0",
    fecha: "2026-09-30",
    titulo: "Calendario de contenidos para redes",
    cambios: [
      "Nueva sección Contenidos: cada publicación es una ficha con nombre, cuenta (GastroWare, ZUMEX o Colaboración), fecha, historia o feed, objetivo, copy e imágenes y videos.",
      "Calendario por MES (todo el mes de un vistazo; tocás un día y vas a esa semana) y por SEMANA (tarjetas con la miniatura). HISTORIAS y FEED siempre en filas separadas y el día de hoy resaltado.",
      "Cada ficha tiene su propio estado: Pendiente de aprobación, Aprobado, Re-edición o Cancelado. El borde de color es la cuenta; la pastilla con texto, el estado.",
      "Marketing carga y dirección aprueba, pide re-edición (con la corrección) o cancela. Los dos reciben el aviso.",
      "Filtros de cuenta y estado que se combinan y quedan en el link para compartir la vista. Listado “Fichas de contenido” con búsqueda y orden por fecha.",
      "Los archivos se ordenan solos por nombre (01, 02… 10) y los videos grandes se suben por partes, con el avance a la vista.",
      "Lo ven marketing y dirección; a cualquier otra persona se la habilita en Administración → Usuarios.",
    ],
  },
  {
    version: "1.9.1",
    fecha: "2026-09-28",
    titulo: "Ajustes de la ficha al costado",
    cambios: [
      "En la compu, la ficha abierta al costado queda fija mientras bajás por la lista de contactos.",
      "La pestaña “Equipos y services” ahora se llama “Equipos” para que entren todas a la vista (adentro siguen los services).",
    ],
  },
  {
    version: "1.9.0",
    fecha: "2026-09-28",
    titulo: "Ficha del cliente ordenada y cotizar más cómodo",
    cambios: [
      "La ficha del cliente ahora va por pestañas: Operaciones, Historial, Cotizaciones, Equipos y services, Personas y Datos. En la compu, al costado, se ve completa (todo desplaza junto) y con un botón se abre en grande.",
      "Cada interés muestra su cotización a la vista: “Cotizar”, o “Ver PDF” y “Compartir” si ya está hecha. Me compró / No se dio abajo, y el resto ordenado en “Más opciones”.",
      "Venta de consumibles, pedido de repuesto y tareas ya no aparecen mezclados arriba: están en “+ Nueva operación”, cada apartado por separado.",
      "Cotizar tiene su propia pantalla, en pasos: datos del cliente, productos, precio y pago, entrega y validez. El total queda siempre a la vista.",
      "Para cotizar son obligatorios razón social, CUIT (se controla que sea válido), dirección, localidad y email. Si falta alguno se completa ahí mismo y queda guardado en la ficha.",
      "“Nueva versión” arranca con todo lo de la cotización anterior.",
      "En venta de consumibles y en pedido de repuesto se puede cargar un cliente nuevo sin salir (avisa si el teléfono ya está cargado).",
    ],
  },
  {
    version: "1.8.0",
    fecha: "2026-09-28",
    titulo: "Cotización en PDF lista para mandar al cliente",
    cambios: [
      "Al guardar una cotización sale el PDF con la estética de GastroWare: arriba los datos de la empresa, el número (ej: 0007 - 00000315) y la fecha; después el cliente, los productos y los totales.",
      "Botones “Ver PDF” y “Compartir”: desde el celular se manda directo por WhatsApp o mail.",
      "Las fichas de los productos (PDF o imagen) se anexan solas al final. Se cargan en Administración → Catálogo, con “Cargar PDF”.",
      "Cada producto puede tener código y detalle técnico, que salen en la línea de la cotización.",
      "IVA al armar la cotización (10,5%, 21% o no discriminar): los precios son sin IVA y el PDF muestra neto gravado, IVA y total.",
      "Abajo del PDF: mantenimiento de oferta, forma de pago, plazo y condición de entrega, y en dólares la nota del BNA con el total y el tipo de cambio.",
      "Administración → Marca: los datos de la empresa, el punto de venta, la nota de dólares y desde qué número siguen las cotizaciones.",
    ],
  },
  {
    version: "1.7.0",
    fecha: "2026-09-28",
    titulo: "Tablero por apartado: equipos, consumibles y repuestos",
    cambios: [
      "Tablero: arriba elegís Consolidado, Venta de equipos, Consumibles o Repuestos, y todos los números se filtran por ese apartado.",
      "Nuevo panel Control: consultas sin atender y operaciones sin próximo paso, por vendedor.",
      "Nuevo panel Actividad comercial: intentos de contacto contra conversaciones reales, por medio (llamada, WhatsApp…) y por vendedor.",
      "Tareas de la agenda del período: cuántas se hicieron y cuántas quedaron vencidas.",
      "Consumibles: ventas del período, reposiciones para contactar y próximas. Repuestos: cuántas hay en cada paso y lo cotizado esperando al cliente.",
      "Los importes siempre separados en pesos y en dólares; una cotización abierta nunca cuenta como venta.",
      "El Asistente IA también responde por apartado (“¿cómo vienen los consumibles este mes?”).",
    ],
  },
  {
    version: "1.6.0",
    fecha: "2026-09-28",
    titulo: "Pesos y dólares, cada apartado con sus productos y cotizaciones con descuento especial",
    cambios: [
      "Cada producto puede tener precio de lista en pesos y en dólares (Administración → Catálogo), con su moneda principal.",
      "Al cotizar elegís Pesos o Dólares y los precios salen de la lista en esa moneda; si cambiás de moneda, las líneas se actualizan solas.",
      "Venta directa, venta de consumibles y repuestos también se hacen en pesos o en dólares, con el precio de lista a mano.",
      "Cotización: forma de pago (transferencia, anticipo y saldo, cheque, tarjeta, Mercado Pago, cuenta corriente) con su detalle.",
      "Cotización: descuento especial para la operación, con el % y el motivo. Muestra subtotal, descuento y total; si pasa lo que el vendedor puede dar solo, espera la aprobación de dirección.",
      "Cada formulario muestra solo lo suyo: Nueva consulta y “Otro interés” con equipos, Consumibles con consumibles y Repuestos con repuestos.",
      "Arreglo: las consultas de equipos en dólares ya no quedan guardadas en pesos.",
    ],
  },
  {
    version: "1.5.1",
    fecha: "2026-09-28",
    titulo: "Arreglo: la cotización de repuestos saluda a la persona",
    cambios: ["El WhatsApp de “Mandar cotización” saluda a la persona del cliente por su nombre (“Hola Martín”) en vez del nombre de la empresa."],
  },
  {
    version: "1.5.0",
    fecha: "2026-09-28",
    titulo: "Repuestos: de la consulta al pedido",
    cambios: [
      "Nuevo apartado Repuestos: cada solicitud con cliente, equipo y serie, qué pieza (del catálogo o descripta, con código o foto), cantidad, precio, disponibilidad y plazo.",
      "Pasos: Validación técnica (si hace falta) → Para cotizar → Cotización enviada → Esperando confirmación → Ganada o Perdida.",
      "Servicio técnico valida la pieza desde “Para validar” o su Mi día; al vendedor le llega el aviso para cotizar.",
      "Al cotizar, “Mandar cotización” abre el WhatsApp con el mensaje armado. “Confirmó” la pasa a Ventas: sigue el circuito de siempre (facturar, cobrar, preparar, entregar).",
      "Se puede pedir un repuesto desde la ficha del cliente, un caso o un service, sin volver a cargar cliente ni equipo.",
      "El Embudo muestra solo la venta de equipos, el negocio principal; consumibles y repuestos se trabajan en su apartado.",
    ],
  },
  {
    version: "1.4.0",
    fecha: "2026-09-28",
    titulo: "Consumibles: ventas y reposición de cada cliente",
    cambios: [
      "Nuevo apartado Consumibles en el menú: a quién contactar para reponer (agrupado por cliente), calendario de reposiciones y todos los planes.",
      "Cada consumible tiene su tiempo de reposición (Administración → Catálogo, “repone cada”). Con cada compra el plazo se reinicia desde la fecha de compra, y se puede ajustar para cada cliente.",
      "Registrar venta de consumibles: cliente, productos con cantidad, cada cuánto repone y cuántos días antes contactarlo; muestra el próximo contacto. La venta sigue el circuito de siempre (facturar, cobrar, entregar).",
      "Desde cada reposición: anotar el contacto, registrar la venta, cotizar, “Tiene stock” (volver a contactar más adelante), suspender con motivo o ajustar el tiempo.",
      "El aviso de reposición llega a Mi día de quien está a cargo (por defecto la administrativa). No le manda nada al cliente ni crea ventas solo.",
      "Un solo plan por cliente, sucursal y producto: una nueva compra actualiza el mismo plan, nunca lo duplica.",
      "La ficha muestra los consumibles de cada cliente con su última compra y próximo contacto, y tiene accesos rápidos a “Venta de consumibles” y “Tarea”.",
      "Arreglo: vender un consumible o un repuesto ya no lo carga como si fuera un equipo.",
    ],
  },
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
