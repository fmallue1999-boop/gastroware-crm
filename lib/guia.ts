import type { Puesto } from "@/lib/puestos";

/**
 * Guía de uso dentro del CRM (/guia): qué hace cada puesto y cómo se hace
 * cada cosa, paso a paso, con el link a la pantalla. Sin nombres de
 * personas: todo por puesto (docs/GUIA-POR-PUESTO.md es la versión larga).
 */

export type Paso = { texto: string; href?: string; boton?: string };
export type Tarea = { id: string; titulo: string; pasos: Paso[]; ojo?: string };
export type GuiaPuesto = {
  titulo: string;
  resumen: string;
  abreEn: { texto: string; href: string };
  cadaDia: string[];
  tareas: string[];
};

// ---------------------------------------------------------------------------
// Lo básico: para todos
// ---------------------------------------------------------------------------
export const BASICOS: Tarea[] = [
  {
    id: "mi-dia",
    titulo: "Qué es Mi día",
    pasos: [
      { texto: "Es la pantalla de todos los días. Cada tarjeta es algo que te toca hacer hoy según tu puesto.", href: "/hoy", boton: "Abrir Mi día" },
      { texto: "El número de la tarjeta dice cuántos hay. Rojo es urgente, ámbar es para hoy." },
      { texto: "Tocá un renglón y te lleva a la pantalla donde se resuelve." },
      { texto: "Abajo, en “Al día”, están las tarjetas que no tienen nada pendiente." },
    ],
  },
  {
    id: "avisos",
    titulo: "Recibir los avisos en el celular",
    pasos: [
      { texto: "Entrá a Más y activá “Avisos al celular”. Aceptá cuando el teléfono pregunte.", href: "/mas", boton: "Ir a Más" },
      { texto: "A la mañana te llega el resumen de tu día. Durante el día, la campana muestra los avisos nuevos (consultas asignadas, ventas para facturar, casos, aprobaciones)." },
    ],
  },
  {
    id: "instalar",
    titulo: "Tener el CRM como app en el celular",
    pasos: [
      { texto: "Abrí el CRM desde el navegador del teléfono." },
      { texto: "En el menú del navegador elegí “Agregar a pantalla de inicio”. Queda como una app más." },
    ],
  },
  {
    id: "buscar",
    titulo: "Buscar un contacto",
    pasos: [
      { texto: "Entrá a Contactos y escribí nombre, teléfono, empresa, CUIT o número de serie de un equipo.", href: "/clientes", boton: "Ir a Contactos" },
      { texto: "En la computadora la ficha se abre al costado; en el celular, en pantalla completa." },
    ],
  },
  {
    id: "ficha",
    titulo: "La ficha del contacto",
    pasos: [
      { texto: "Arriba: quién es, quién lo atiende y WhatsApp, llamar y email con un toque." },
      { texto: "Pestañas: Operaciones (lo abierto: intereses, ventas en curso, repuestos y casos), Historial (todo lo que pasó, en orden), Cotizaciones (con su PDF), Equipos y services, Personas y Datos (razón social, CUIT, dirección, locales)." },
      { texto: "En Operaciones, “+ Nueva operación”: interés en un equipo, venta de consumibles, pedido de repuesto o tarea. Cada apartado por separado." },
      { texto: "Abajo, siempre, la caja para anotar qué pasó. En la compu la ficha se abre al costado; con el botón de agrandar se abre completa." },
    ],
  },
  {
    id: "personas",
    titulo: "Cargar las personas de una empresa",
    pasos: [
      { texto: "En la ficha, pestaña “Personas”: cada persona con su cargo, teléfono y email, y la estrella si decide la compra." },
      { texto: "“Agregar persona” para sumar al encargado, al de compras, etc. Cada una tiene su WhatsApp y su Llamar." },
      { texto: "Al registrar una actividad, elegí “Con quién” hablaste." },
    ],
    ojo: "La empresa aparece una sola vez: sus personas, intereses, ventas, equipos y services quedan todos en la misma ficha.",
  },
  {
    id: "anotar",
    titulo: "Registrar lo que pasó y el próximo paso",
    pasos: [
      { texto: "En la ficha (caja de abajo) o en Mi día (botón del lápiz): elegí cómo fue — Llamada, WhatsApp, Email, Visita o Demo." },
      { texto: "Elegí el resultado: Conversamos, No respondió, Quedó en responder, No le interesa… Un intento sin respuesta no cuenta como conversación." },
      { texto: "Si querés, escribí qué pasó (“quiere para diciembre”). Con el resultado alcanza." },
      { texto: "Próximo paso: qué hacer (Llamar, Escribir, Cotizar, Demo, Visitar) y cuándo (Hoy, Mañana, 3 días, 1 semana…). Si ya había uno, podés mantenerlo." },
      { texto: "Si cambiás la fecha que había, anotá el motivo: la fecha anterior queda en el historial." },
      { texto: "Si no le interesa, podés cerrar el interés como “No se dio” en el mismo paso, sin agendar nada." },
    ],
    ojo: "Abrir WhatsApp o tocar Llamar no registra nada solo: el resultado lo cargás vos. Las operaciones abiertas sin próximo paso aparecen en Mi día, en “Sin próximo paso”.",
  },
  {
    id: "reprogramar",
    titulo: "Pasar un contacto para otro día u hora",
    pasos: [
      { texto: "Si todavía no hablaste y lo querés mover (“prefiere que lo visite la semana que viene”), no hace falta anotar un contacto: tocá “Reprogramar” (el botón del calendario)." },
      { texto: "Está en Mi día (al lado del lápiz), en la tarjeta del embudo y en la ficha, debajo del próximo contacto." },
      { texto: "Elegí cuándo: Hoy más tarde (con la hora), Mañana, Pasado mañana, El lunes, En una semana u Otra fecha. La hora es opcional." },
      { texto: "Si cambia lo que vas a hacer, elegilo (Llamar, Escribir, Cotizar, Demo, Visitar) y, si querés, dejá una nota." },
    ],
    ojo: "Queda en el historial de dónde a dónde se movió. Ese día aparece en Mi día, ordenado por hora.",
  },
  {
    id: "agenda",
    titulo: "Tareas, reuniones, capacitaciones y pagos",
    pasos: [
      { texto: "Entrá a “Tareas” en el menú (en el celular, desde Mi día o Más) y tocá “Nueva”.", href: "/tareas/nueva", boton: "Nueva tarea" },
      { texto: "Elegí el tipo (Tarea, Reunión, Capacitación, Pago u Otro), el título, la fecha y, si querés, la hora." },
      { texto: "Elegí quiénes: vos, una o varias personas, o “Todo el equipo”. A cada una le llega el aviso en la campana y en el celular." },
      { texto: "Podés sumar links (una presentación, un documento), el link de la videollamada, el monto de un pago y un detalle." },
      { texto: "“Repetir”: cada semana, cada 2 semanas o cada mes (por ejemplo, la reunión de los lunes o el alquiler del 10)." },
      { texto: "“Aviso”: el mismo día o unos días antes. Llega a las 8:30 a la campana y al celular." },
      { texto: "Lo de hoy aparece arriba de todo en Mi día. Tocá el círculo para marcarla hecha (o pagado).", href: "/hoy", boton: "Ir a Mi día" },
      { texto: "En Tareas tenés tu agenda en lista o en el calendario del mes, y “Lo que asigné” para ver quién ya lo hizo.", href: "/tareas", boton: "Ir a Tareas" },
    ],
    ojo: "Si una tarea la tenés solo vos, la podés mover de día. Si es de varios, la cambia quien la creó (o dirección) y a todos les llega el aviso del cambio. Con “Google Calendar” o “iPhone / Outlook” la sumás al calendario de tu celular.",
  },
  {
    id: "asistente",
    titulo: "Preguntarle al asistente (IA)",
    pasos: [
      { texto: "Entrá a “Asistente IA” (en el menú, o en Más desde el celular).", href: "/asistente", boton: "Abrir el asistente" },
      { texto: "Preguntale con tus palabras: “¿qué tengo pendiente hoy?”, “¿qué pasa con el Hotel X?”, “¿cómo cargo una factura?”, “armame un WhatsApp para…”." },
      { texto: "Mira tus datos (solo lo que tu puesto puede ver) y te contesta con links a la pantalla donde se resuelve." },
      { texto: "Los botones violetas “IA” de otras pantallas (ficha, Mi día, tablero, cobranzas) le hacen la pregunta por vos." },
    ],
    ojo: "El asistente no cambia nada solo: te dice qué hacer y dónde, y lo hacés vos. Si un dato no está en el sistema, te lo dice.",
  },
  {
    id: "contrasena",
    titulo: "Cambiar mi contraseña",
    pasos: [{ texto: "Más → Cambiar contraseña. Poné una tuya, sobre todo si te dieron una inicial.", href: "/password", boton: "Cambiar contraseña" }],
  },
];

// ---------------------------------------------------------------------------
// Cómo se hace cada cosa
// ---------------------------------------------------------------------------
export const TAREAS: Tarea[] = [
  // --- Consultas ---
  {
    id: "nueva-consulta",
    titulo: "Cargar una consulta nueva",
    pasos: [
      { texto: "Tocá el botón verde “Nueva consulta”.", href: "/alta", boton: "Nueva consulta" },
      { texto: "Elegí qué le interesa (el stock aparece al lado), cuántos de cada uno (ej. 2 licuadoras) y cuánto le interesa." },
      { texto: "Buscá a la persona en la base o cargala nueva: nombre de la persona, teléfono o email, y la empresa o proyecto (si todavía no tiene nombre: “Proyecto cafetería”)." },
      { texto: "Si el teléfono o el email ya están cargados, el sistema avisa: elegí “Es el mismo” o “Es otra persona”. Nunca se unen solos." },
      { texto: "Marcá dónde se entrega: el vendedor sale solo por la zona (ej. CABA). Si lo tiene que atender otro, elegilo en “¿Quién lo atiende?”." },
      { texto: "Marcá por dónde llegó (WhatsApp, web, llamada…) y Guardar. El primer contacto queda agendado para hoy: no hace falta poner fecha." },
      { texto: "Atajo con IA: arriba de todo, “Cargar desde un mensaje o una captura”. Pegá el WhatsApp o subí la captura del chat, “Completar con IA”, revisá lo que completó y Guardar." },
    ],
    ojo: "Si la zona es de otro territorio, la consulta le llega sola al vendedor de ese territorio con un aviso.",
  },
  {
    id: "asignar-consulta",
    titulo: "Asignar una consulta sin vendedor",
    pasos: [
      { texto: "En Mi día, tarjeta “Consultas por asignar”, tocá la consulta.", href: "/hoy", boton: "Ir a Mi día" },
      { texto: "En la tarjeta del interés, elegí dónde se entrega y tocá “Asignar”." },
      { texto: "El CRM se la pasa al vendedor del territorio y le avisa: tiene una hora para el primer contacto." },
    ],
  },
  {
    id: "primer-contacto",
    titulo: "Hacer el primer contacto (dentro de la hora)",
    pasos: [
      { texto: "Cuando te llega una consulta, abrila desde el aviso o desde Mi día." },
      { texto: "Contactalo por WhatsApp o llamada desde la ficha." },
      { texto: "En la tarjeta del interés, en “Sin primer contacto”, tocá “Ya lo contacté por: WhatsApp / Llamada / Email”. O anotá lo que pasó en la caja de abajo: cualquiera de las dos registra el primer contacto." },
      { texto: "Si no atiende, tocá “No respondió”: el CRM anota el intento y propone el siguiente (dos reintentos en 48 h y después espera 14 días)." },
    ],
    ojo: "En la tarjeta del interés aparece en rojo “Sin primer contacto” si pasó más de una hora.",
  },
  {
    id: "no-es-mio",
    titulo: "Me llegó una consulta que no es de mi zona",
    pasos: [
      { texto: "En la tarjeta del interés, tocá “No es de mi territorio”." },
      { texto: "Elegí dónde se entrega de verdad y tocá “Pasarla”. Le llega al otro vendedor con aviso." },
    ],
  },
  {
    id: "calificar",
    titulo: "Calificar la consulta",
    pasos: [
      { texto: "En la tarjeta del interés, “Más” → “Calificación”." },
      { texto: "Cargá cantidad, cuándo compra y quién decide la compra. Guardar." },
    ],
  },
  {
    id: "lista-espera",
    titulo: "Lo quiere pero no hay stock",
    pasos: [
      { texto: "En la tarjeta del interés, “Más” → “Poner en lista de espera”." },
      { texto: "Cuando el depósito marca que llegó la mercadería, el contacto aparece en tu Mi día con “Llegó stock”." },
    ],
  },
  // --- Propuesta ---
  {
    id: "cotizar",
    titulo: "Armar y mandar una propuesta",
    pasos: [
      { texto: "En la tarjeta del interés, “Cotizar” (o la pestaña Cotizaciones). Se abre la pantalla de cotizar, con los productos del interés ya cargados." },
      { texto: "1) Datos del cliente: razón social, CUIT, dirección, localidad y email son obligatorios. Si falta alguno, lo completás ahí y queda guardado en la ficha." },
      { texto: "2) Productos: vienen los del interés con su cantidad. Se cotiza en la moneda que fija dirección, a precio de catálogo y con el IVA de cada producto (no se elige)." },
      { texto: "3) Forma de pago, plazo y condición de entrega: se eligen del desplegable." },
      { texto: "4) Si el cliente pide algo especial (descuento, plazo o financiación), tildalo y contá qué pide: dirección lo aprueba antes de mandarla." },
      { texto: "“Guardar y armar PDF”. El seguimiento de la propuesta queda agendado para mañana (día 1) y podés volver al embudo o a Mi día." },
      { texto: "Para cambiar algo, “Nueva versión”: arranca con todo lo de la anterior." },
      { texto: "Listo el PDF: “Ver PDF” para revisarlo y “Compartir” para mandarlo por WhatsApp o mail desde el celular (en la compu se descarga). Sale con el número de cotización, los datos del cliente y las fichas de los productos al final." },
    ],
    ojo: "Si el descuento especial o el precio van más allá de lo que podés dar solo, o hay condición especial, queda “esperando aprobación” con el motivo y no se puede mandar hasta que dirección la apruebe. Te llega el aviso.",
  },
  {
    id: "preparar-cotizacion",
    titulo: "Preparar el catálogo y los datos de la cotización",
    pasos: [
      { texto: "En Administración → Marca → Cotización en PDF, “Cómo cotiza el vendedor”: la moneda (siempre dólares, siempre pesos o que elija) y las listas de formas de pago, plazos y condiciones de entrega (una por renglón).", href: "/admin/marca", boton: "Ir a Marca" },
      { texto: "En el Catálogo, el IVA de cada producto (10,5% equipos; 21% consumibles y repuestos): la cotización lo usa solo." },
      { texto: "En Administración → Catálogo, en cada producto abrí “Ficha de venta · PDF para cotizar”: cargá el código y el detalle técnico (la segunda línea que sale en la cotización).", href: "/admin/catalogo", boton: "Ir al Catálogo" },
      { texto: "“Cargar PDF”: la ficha técnica, un folleto o info adicional (PDF, JPG o PNG). Sale sola al final de cada cotización que lleve ese producto." },
      { texto: "En Administración → Marca, “Cotización en PDF”: los datos de la empresa que salen arriba, el punto de venta y la nota de las cotizaciones en dólares.", href: "/admin/marca", boton: "Ir a Marca" },
      { texto: "Numeración: ahí mismo elegís desde qué número siguen las cotizaciones (tiene que ser mayor que el último)." },
    ],
    ojo: "Los precios del catálogo son sin IVA. Lo cambia dirección.",
  },
  {
    id: "cadencia",
    titulo: "Seguir una propuesta enviada",
    pasos: [
      { texto: "Después de mandar la propuesta, la tarjeta del interés muestra el próximo seguimiento sugerido: días 1, 3 y 7; último intento a los 14; recontacto a los 30 y 60." },
      { texto: "Tocá el botón con la fecha y queda agendado en tu Mi día." },
    ],
  },
  // --- Venta ---
  {
    id: "datos-venta",
    titulo: "Me compró: informar la venta",
    pasos: [
      { texto: "En la tarjeta del interés, tocá “Me compró”." },
      { texto: "En la venta, “Completar datos de la venta”: forma de pago, dónde se entrega, a qué razón social se factura y fecha estimada." },
      { texto: "Si lleva instalación, tildala y completá el relevamiento del lugar (electricidad, agua, espacio, conectividad, accesos, horario)." },
      { texto: "“Pasar a administración”: le llega a la administrativa para facturar." },
    ],
    ojo: "Sin estos datos la venta no se puede facturar.",
  },
  {
    id: "confirmar-entrega",
    titulo: "Confirmar la entrega",
    pasos: [
      { texto: "Cuando administración despacha, te llega el aviso con el transporte y el seguimiento." },
      { texto: "Cuando el cliente lo recibe, en la venta tocá “Confirmar entrega”.", href: "/pedidos", boton: "Ir a Ventas" },
      { texto: "El CRM descuenta el stock y agenda la postventa: día 10 (y días 2 y 30 si lleva instalación)." },
    ],
  },
  {
    id: "postventa",
    titulo: "Hacer la postventa",
    pasos: [
      { texto: "En Mi día aparece “Postventa del día” con el cliente y qué preguntar.", href: "/hoy", boton: "Ir a Mi día" },
      { texto: "Llamalo o escribile, y tocá “Hecho” con el resultado (o cambiá la fecha)." },
    ],
  },
  {
    id: "facturar-venta",
    titulo: "Facturar una venta",
    pasos: [
      { texto: "En Ventas, columna “Vendido · para facturar”, o desde Mi día.", href: "/pedidos", boton: "Ir a Ventas" },
      { texto: "Tocá “Cargar factura”: número de ZEUS, fecha, vencimiento y monto. Si falta la serie del equipo, la pide." },
      { texto: "Guardar: la factura queda en Cobranzas y la venta pasa a “Facturado · esperando cobro”." },
    ],
  },
  {
    id: "registrar-cobro",
    titulo: "Registrar el cobro de una venta",
    pasos: [
      { texto: "En la venta, “Cobro acreditado”, o en Cobranzas el botón “Cobrado”.", href: "/cobranzas", boton: "Ir a Cobranzas" },
      { texto: "La venta pasa sola a “A preparar” y se avisa al depósito." },
    ],
    ojo: "Si el cliente debe facturas vencidas hace más de los días que fija dirección, no pasa sola: queda frenada hasta que dirección apruebe la condición.",
  },
  {
    id: "despachar",
    titulo: "Preparar y despachar",
    pasos: [
      { texto: "En Ventas, columna “A preparar y despachar”.", href: "/pedidos", boton: "Ir a Ventas" },
      { texto: "“Remito”: número de remito y, si hace falta, “Urgente: sale hoy”." },
      { texto: "“Despachar”: cómo sale (flete, transporte, retira el cliente), número de seguimiento y tildá “Le mandé los videos del modelo” (el link del video aparece ahí)." },
      { texto: "El vendedor recibe el aviso del despacho." },
    ],
  },
  {
    id: "aprobar-condicion",
    titulo: "Aprobar despachar sin cobro (condición)",
    pasos: [
      { texto: "En la venta facturada, “Aprobar sin cobro”, o en Cobranzas “Aprobar condición”.", href: "/cobranzas", boton: "Ir a Cobranzas" },
      { texto: "Anotá la condición (ej: e-cheq a 30 días) y aprobá: la venta pasa a preparar." },
    ],
    ojo: "Solo dirección general o dirección de administración.",
  },
  // --- Cobranzas ---
  {
    id: "cobranzas",
    titulo: "Cobranzas del día",
    pasos: [
      { texto: "Entrá a Cobranzas: primero las vencidas, después las que vencen hoy y en 48 h, y las promesas.", href: "/cobranzas", boton: "Ir a Cobranzas" },
      { texto: "“Reclamar” abre WhatsApp con el mensaje armado (número de factura, monto y vencimiento)." },
      { texto: "Después marcá lo que pasó: “Cobrado”, “Prometió…” (con la fecha) o “Sin respuesta”." },
    ],
  },
  {
    id: "cargar-factura",
    titulo: "Cargar una factura que no salió de una venta",
    pasos: [
      { texto: "En Cobranzas, “Cargar factura”: cliente, tipo (consumible, repuesto, service), número, fecha, vencimiento y monto.", href: "/cobranzas", boton: "Ir a Cobranzas" },
      { texto: "Queda para cobrar con su vencimiento." },
    ],
  },
  {
    id: "recontactos",
    titulo: "Recontactar consumibles",
    pasos: [
      { texto: "En Mi día aparecen los recontactos de consumibles del día (los arma el CRM según cada cuánto se compra cada consumible).", href: "/hoy", boton: "Ir a Mi día" },
      { texto: "Escribile al cliente y tocá “Hecho” con el resultado. Si compró, el ciclo vuelve a empezar." },
    ],
  },
  // --- Casos y service ---
  {
    id: "abrir-caso",
    titulo: "Abrir un caso (reclamo de un cliente)",
    pasos: [
      { texto: "En la ficha del cliente, desplegable Services → “Abrir caso (reclamo)”, o en Casos → “Nuevo caso”.", href: "/casos/nuevo", boton: "Nuevo caso" },
      { texto: "Elegí el equipo, qué tan urgente es (equipo parado, anda mal o consulta) y qué pasa." },
      { texto: "Lo responde el vendedor de la cuenta: en 24 h hábiles, o dentro de la hora si el equipo está parado." },
    ],
  },
  {
    id: "responder-caso",
    titulo: "Responder, derivar y cerrar un caso",
    pasos: [
      { texto: "En Casos o en la ficha: “Responder” y anotá qué le dijiste o qué probaron a distancia.", href: "/casos", boton: "Ir a Casos" },
      { texto: "Si no se resuelve a distancia: “Derivar a servicio”. Se crea el service y se avisa a servicio técnico." },
      { texto: "Cuando está resuelto: “Cerrar” con la causa y la solución (en 5 días hábiles)." },
      { texto: "“Ayuda IA” en el caso: te da qué preguntarle al cliente, pruebas simples y seguras, un WhatsApp listo y si conviene derivar." },
    ],
  },
  {
    id: "asignar-service",
    titulo: "Asignar un service: técnico propio o aliado",
    pasos: [
      { texto: "En Services, “Para asignar”, abrí el service.", href: "/servicio", boton: "Ir a Services" },
      { texto: "En el panel de servicio técnico elegí “Técnico propio” (Mar del Plata y zona) o “Técnico aliado” (fuera de zona), la persona y la fecha. “Asignar”." },
      { texto: "Al técnico le llega el aviso." },
    ],
  },
  {
    id: "presupuesto",
    titulo: "Presupuesto fuera de garantía (cobro antes de ir)",
    pasos: [
      { texto: "En el service, panel de servicio técnico: monto del presupuesto y “El cliente lo aprobó”. Guardar." },
      { texto: "Administración factura el presupuesto y registra el cobro." },
      { texto: "Hasta que no está cobrado, el técnico ve “esperando cobro: no salir todavía”." },
    ],
  },
  {
    id: "cerrar-trabajo",
    titulo: "Terminar un trabajo con remito",
    pasos: [
      { texto: "En el service: escribí el trabajo realizado y cargá el tiempo (cronómetro o a mano)." },
      { texto: "En “Remito”: número del remito en papel. Guardar remito." },
      { texto: "Fotos: “Remito firmado” y “Equipo funcionando” (y “Acta firmada” si es una instalación, con a quién capacitaste)." },
      { texto: "“Terminar trabajo”: pasa al control del remito. Si falta algo, el CRM te dice qué." },
    ],
    ojo: "Sin remito firmado y foto del equipo funcionando, el CRM no deja cerrar.",
  },
  {
    id: "service-hecho",
    titulo: "Cargar un service que ya hice",
    pasos: [
      { texto: "Botón verde “Cargar service hecho”.", href: "/servicio/cargar", boton: "Cargar service hecho" },
      { texto: "De quién, qué equipo, tipo, qué se hizo, fecha y horas." },
      { texto: "Remito: número, foto del remito firmado y foto del equipo funcionando. Si es instalación, a quién capacitaste." },
      { texto: "Guardar: queda para que servicio técnico controle el remito." },
    ],
  },
  {
    id: "controlar-remito",
    titulo: "Controlar un remito",
    pasos: [
      { texto: "En Services, “Remitos para controlar”, abrí el service.", href: "/servicio", boton: "Ir a Services" },
      { texto: "Revisá repuestos y gastos, fotos y remito." },
      { texto: "“Remito controlado: aprobar para facturar” o “Devolver al técnico” con lo que falta." },
      { texto: "Si es garantía o ya estaba cobrado: “Cerrar (sin facturar)”." },
    ],
  },
  {
    id: "facturar-remito",
    titulo: "Facturar el remito de un service",
    pasos: [
      { texto: "En Services, “Remitos aprobados para facturar”, abrí el service.", href: "/servicio", boton: "Ir a Services" },
      { texto: "Cargá el número de factura de ZEUS y el vencimiento. “Facturada”: queda en Cobranzas." },
    ],
    ojo: "Si la cuenta tiene varias razones sociales, se factura a la del local.",
  },
  {
    id: "garantia",
    titulo: "Seguir un reclamo de garantía a fábrica",
    pasos: [
      { texto: "En el service en garantía, panel de servicio técnico: estado del reclamo (a presentar, presentado, repuesto recibido, cerrado o rechazado) y nota. Guardar." },
      { texto: "Los reclamos abiertos aparecen en Mi día y en Services → “Garantías con fábrica”." },
    ],
  },
  {
    id: "aliados",
    titulo: "Cargar un técnico aliado",
    pasos: [
      { texto: "Services → Aliados → “Nuevo aliado”: nombre, zona, teléfono, email y tarifa.", href: "/servicio/aliados", boton: "Ir a Aliados" },
    ],
  },
  {
    id: "deposito",
    titulo: "Preparar pedidos y recibir mercadería",
    pasos: [
      { texto: "En Mi día, “Preparar hoy en el depósito”: lo que ya está facturado y cobrado, con prioridad y remito.", href: "/hoy", boton: "Ir a Mi día" },
      { texto: "Cuando llega mercadería, en Stock tocá “Llegó” en ese ingreso: los clientes en lista de espera le aparecen a su vendedor.", href: "/stock", boton: "Ir a Stock" },
      { texto: "Los viernes, Mi día muestra los repuestos que están en el mínimo para pedir reposición." },
    ],
  },
  // --- Dirección ---
  {
    id: "aprobar-propuestas",
    titulo: "Aprobar propuestas fuera de lista",
    pasos: [
      { texto: "Entrá a Aprobaciones (o desde Mi día).", href: "/aprobaciones", boton: "Ir a Aprobaciones" },
      { texto: "Cada propuesta muestra el motivo (qué descuento o condición) y el precio de lista al lado." },
      { texto: "“Aprobar” con un toque, o “Rechazar” con el motivo. Al vendedor le llega el aviso." },
    ],
  },
  {
    id: "responder-informes",
    titulo: "Leer y responder los informes de los lunes",
    pasos: [
      { texto: "Entrá a Informes: arriba dice quién no lo mandó.", href: "/informes", boton: "Ir a Informes" },
      { texto: "Cada informe trae los números de la semana, lo que lo frena, las decisiones que pide y su agenda." },
      { texto: "Escribí la respuesta y “Responder”: le llega al vendedor." },
    ],
  },
  {
    id: "tablero",
    titulo: "Mirar el tablero",
    pasos: [
      { texto: "Tablero: vendido, abierto, por vendedor, alertas y la operación (primer contacto, remitos, casos, cobranza, ventas por territorio).", href: "/tablero", boton: "Ir al Tablero" },
      { texto: "Arriba elegís el apartado: Consolidado, Venta de equipos, Consumibles o Repuestos. Todos los números se filtran por ese apartado." },
      { texto: "Control: consultas sin atender y operaciones sin próximo paso, por vendedor. Actividad comercial: intentos de contacto contra conversaciones reales (un “no respondió” es intento, no conversación)." },
      { texto: "Consumibles (ventas, reposiciones para contactar y próximas) y Repuestos (cuántas hay en cada paso y lo cotizado esperando al cliente)." },
      { texto: "Los importes siempre van separados en pesos y en dólares, y una cotización abierta nunca cuenta como venta. Cada número se toca y muestra la lista. Los lunes llega por email." },
    ],
  },
  {
    id: "equipo",
    titulo: "Poner puestos, territorios y reglas",
    pasos: [
      { texto: "Administración → Usuarios: el puesto de cada persona, el territorio de cada vendedor y su teléfono.", href: "/admin", boton: "Ir a Administración" },
      { texto: "Territorios: el responsable de “CABA y AMBA” y de “Mar del Plata, costa e interior”. Vacante = responde dirección general." },
      { texto: "Reglas: días de atraso que frenan un despacho, descuento que un vendedor puede dar sin consultar, plazo de pago a aliados y tarifa de service." },
    ],
    ojo: "El puesto lo cambia solo dirección general. Si alguien entra, sale o cambia de puesto, se cambia acá y el CRM se reacomoda solo.",
  },
  // --- Consumibles ---
  {
    id: "consumibles",
    titulo: "Vender consumibles y seguir la reposición",
    pasos: [
      { texto: "Cada consumible tiene su tiempo de reposición (por ejemplo, cada 45 días). Se carga en Administración → Catálogo, en “repone cada”.", href: "/admin/catalogo", boton: "Ir al Catálogo" },
      { texto: "Venta: Consumibles → “Registrar venta” (o desde la ficha, “+ Nueva operación” → “Venta de consumibles”). Elegí el cliente (o “Cliente nuevo: cargarlo acá”), los productos y la cantidad.", href: "/consumibles/venta", boton: "Registrar venta" },
      { texto: "Cada producto trae su tiempo; si este cliente gasta más rápido o más lento, cambialo ahí. “Contactar antes” son los días de anticipación (10 por defecto). Se ve el próximo contacto." },
      { texto: "Cada compra reinicia el plazo desde la fecha de compra. Si todavía no se sabe cada cuánto repone, poné la fecha de contacto a mano." },
      { texto: "La venta sigue el circuito de siempre: facturar, cobrar, preparar y entregar." },
      { texto: "El día que toca, aparece en Mi día de quien está a cargo y en Consumibles → “A contactar”, agrupado por cliente.", href: "/consumibles", boton: "Ir a Consumibles" },
      { texto: "Desde ahí: “Anotar contacto”, “Registrar venta” (reinicia el plazo), “Cotizar”, “Tiene stock” (volver a contactar más adelante), “Suspender” con el motivo, o el botón de ajuste para cambiar el tiempo de ese cliente." },
    ],
    ojo: "El aviso no le manda nada al cliente ni crea ventas solo: le avisa a quien está a cargo cuándo contactarlo. Hay un solo plan por cliente, sucursal y producto: nunca se duplica.",
  },
  // --- Repuestos ---
  {
    id: "repuestos",
    titulo: "Pedidos de repuestos: validar, cotizar y vender",
    pasos: [
      { texto: "“Nueva solicitud” en Repuestos (si es alguien nuevo, “Cliente nuevo: cargarlo acá”), o desde la ficha (“+ Nueva operación” → “Pedido de repuesto”), un caso o un service (“Pedir repuesto”): el cliente y el equipo ya vienen cargados.", href: "/repuestos/nueva", boton: "Nueva solicitud" },
      { texto: "Qué pieza: del catálogo o con sus palabras, con código o una foto de la pieza o la etiqueta, y la cantidad." },
      { texto: "Si no estás seguro de qué pieza es, “Sí, validarla”: le llega a servicio técnico. Si ya está identificada, “No, ya está identificada”." },
      { texto: "Servicio técnico: en Repuestos → “Para validar”, confirma la pieza (código, disponibilidad, plazo) o anota que no se pudo identificar. Al vendedor le llega el aviso.", href: "/repuestos?ver=validar", boton: "Para validar" },
      { texto: "Vendedor: “Cotizar” con precio, disponibilidad y plazo. Después “Mandar cotización” abre el WhatsApp con el mensaje armado." },
      { texto: "Cuando confirma, “Confirmó”: pasa a Ventas y sigue el circuito de siempre (facturar, cobrar, preparar, entregar). Si no, “No se dio” con el motivo." },
    ],
    ojo: "Cada solicitud tiene su próximo paso: aparece en Mi día del vendedor. Lo que falta validar aparece en Mi día de servicio técnico.",
  },
  // --- Informe y marketing ---
  {
    id: "informe",
    titulo: "Mandar mi informe de los lunes",
    pasos: [
      { texto: "Los lunes antes de las 10: “Mi informe”.", href: "/informe", boton: "Ir a Mi informe" },
      { texto: "Los números de la semana los pone el CRM." },
      { texto: "Completá qué te frena, qué decisiones necesitás de dirección y tu agenda. “Enviar a dirección”." },
      { texto: "Atajo con IA: “Armar borrador con IA” lo completa con tus consultas, propuestas y números. Revisalo, corregí y enviá." },
      { texto: "La respuesta de dirección aparece en la misma pantalla." },
    ],
  },
  {
    id: "pedir-material",
    titulo: "Pedirle material a marketing",
    pasos: [
      { texto: "Más → Pedidos de material → “Pedir material”: qué necesitás, para qué y para cuándo.", href: "/marketing/pedidos", boton: "Pedir material" },
      { texto: "Marketing compromete una fecha y te avisa cuando está listo." },
    ],
  },
  {
    id: "atender-pedidos",
    titulo: "Atender los pedidos de material",
    pasos: [
      { texto: "En Pedidos de material: poné la fecha en que lo entregás y “En curso”.", href: "/marketing/pedidos", boton: "Ir a Pedidos" },
      { texto: "Cuando está listo, “Entregado”: le llega el aviso a quien lo pidió." },
    ],
  },
  {
    id: "videos",
    titulo: "Cargar el video de cada modelo",
    pasos: [
      { texto: "En Videos: pegá el link del video instructivo de cada modelo y Guardar.", href: "/marketing/videos", boton: "Ir a Videos" },
      { texto: "Arriba aparecen los modelos que todavía no tienen video. Administración lo manda con cada despacho." },
    ],
  },
  {
    id: "material",
    titulo: "Material: videos, imágenes y fichas para mandar",
    pasos: [
      { texto: "Material → elegí la marca (JETINNO, GASTROWARE o ZUMEX), la categoría y el producto. O escribí en el buscador (ej: GX18, Versatile Pro): te lleva directo.", href: "/material", boton: "Ir a Material" },
      { texto: "Cada producto tiene VIDEOS (cómo usar, configurar, lavar u otro), IMÁGENES y FICHA. Tocá uno para verlo grande." },
      { texto: "“Compartir” manda el archivo por WhatsApp o mail desde el celular; “Descargar” lo baja. Las imágenes se bajan todas juntas con “Descargar todas”." },
      { texto: "“Material por producto” es la tabla con los videos de cómo usar, configurar y lavar de todos los productos.", href: "/material/por-producto", boton: "Ver la tabla" },
      { texto: "En la página de cada marca está la identidad: catálogo general, logo y tipografías." },
    ],
    ojo: "Lo ve todo el equipo. Marketing y dirección suben, borran y ordenan (en la marca, “Editar categorías y productos”). La ficha de un producto vinculado al Catálogo se anexa sola al PDF de la cotización.",
  },
  {
    id: "material-cargar",
    titulo: "Cargar y ordenar el material (marketing)",
    pasos: [
      { texto: "En la página del producto: “Subir video” (antes elegí si es de cómo usar, configurar, lavar u otro), “Subir imágenes” o “Subir ficha (PDF)”. La ficha nueva reemplaza a la anterior." },
      { texto: "En la tabla “Material por producto”, “+ Agregar” sube el video directo en ese producto y ese tipo." },
      { texto: "En la página de la marca, “Editar categorías y productos”: agregá, renombrá, subí o bajá y borrá categorías y productos, y vinculá cada producto con el del Catálogo." },
    ],
    ojo: "Los archivos se ordenan por nombre (01_, 02_…). Mientras Supabase esté en el plan gratis, el máximo es 50 MB por archivo.",
  },
  {
    id: "contenidos",
    titulo: "Calendario de contenidos: cargar y aprobar",
    pasos: [
      { texto: "Contenidos → “+ Nuevo contenido” (o el “+” de una celda del calendario, que ya trae la fecha y si es historia o feed).", href: "/contenidos", boton: "Ir al calendario" },
      { texto: "Completá nombre, cuenta (GastroWare, ZUMEX o Colaboración), fecha y tipo. Objetivo y copy son opcionales; el copy conserva los renglones." },
      { texto: "Agregá las imágenes y videos: se ordenan solos por nombre (01_portada, 02_producto… 10_cierre). Tocá uno para verlo grande o descargarlo." },
      { texto: "Queda “Pendiente de aprobación” y le llega el aviso a dirección." },
      { texto: "Dirección abre la ficha y elige Aprobado, Re-edición (con la corrección: qué cambiar) o Cancelado. A quien la cargó le llega el aviso." },
      { texto: "Si vuelve con re-edición: corregí la ficha y guardá con “mandarlo a aprobar de nuevo” tildado." },
      { texto: "Vista MES para ver todo el mes (tocá un día para ir a esa semana) y SEMANA para trabajar, con la miniatura de cada contenido. Los filtros de cuenta y estado quedan en el link: se puede compartir la vista filtrada." },
      { texto: "“Fichas de contenido” es el listado: buscar por nombre, ordenar por fecha y filtrar." },
    ],
    ojo: "Cada ficha tiene su propio estado. El borde de color es la cuenta; la pastilla con texto, el estado. Lo ven marketing, dirección y a quien dirección habilite en Administración → Usuarios.",
  },
];

// ---------------------------------------------------------------------------
// Cada puesto
// ---------------------------------------------------------------------------
export const GUIA_PUESTOS: Record<Puesto, GuiaPuesto> = {
  comercial: {
    titulo: "Vendedor de territorio",
    resumen: "Sos dueño de las cuentas de tu territorio: del primer contacto a la postventa.",
    abreEn: { texto: "Embudo", href: "/" },
    cadaDia: [
      "Consultas nuevas: primer contacto dentro de la hora.",
      "Para contactar hoy: seguimientos y propuestas según la cadencia.",
      "Casos de tus clientes: responder en 24 h hábiles (1 h si está parado).",
      "Ventas: completar datos y confirmar entregas.",
      "Postventa del día.",
      "Lunes antes de las 10: tu informe.",
    ],
    tareas: ["repuestos", "consumibles", "material",
      "nueva-consulta",
      "primer-contacto",
      "no-es-mio",
      "calificar",
      "cotizar",
      "cadencia",
      "lista-espera",
      "datos-venta",
      "confirmar-entrega",
      "postventa",
      "abrir-caso",
      "responder-caso",
      "informe",
      "pedir-material",
    ],
  },
  direccion: {
    titulo: "Dirección general",
    resumen: "Aprobás lo que va fuera de lista, respondés los informes y mirás el tablero. Mientras esté vacante, atendés el territorio del interior.",
    abreEn: { texto: "Embudo", href: "/" },
    cadaDia: [
      "Propuestas para aprobar: el mismo día.",
      "Lunes: leer y responder los informes.",
      "Tablero: cómo viene el mes y las alertas.",
      "Las consultas y ventas del territorio que cubrís.",
    ],
    tareas: [
      "aprobar-propuestas",
      "contenidos",
      "responder-informes",
      "tablero",
      "aprobar-condicion",
      "preparar-cotizacion",
      "equipo",
      "asignar-consulta",
      "nueva-consulta",
      "primer-contacto",
      "cotizar",
      "datos-venta",
      "responder-caso",
    ],
  },
  admin: {
    titulo: "Dirección de administración, finanzas y operaciones",
    resumen: "Controlás la operación: remitos, services sin asignar, garantías, cobranza y condiciones. Mientras esté vacante, cubrís servicio técnico.",
    abreEn: { texto: "Mi día", href: "/hoy" },
    cadaDia: [
      "Equipos parados sin técnico en 24 h.",
      "Services para asignar: técnico propio o aliado.",
      "Remitos para controlar.",
      "Garantías con fábrica.",
      "Cobranza vencida y ventas frenadas por atraso.",
    ],
    tareas: ["asignar-service", "controlar-remito", "presupuesto", "garantia", "aliados", "cobranzas", "aprobar-condicion", "tablero", "equipo"],
  },
  administrativa: {
    titulo: "Administrativa y atención comercial",
    resumen: "Cargás y asignás las consultas, facturás, cobrás, preparás y despachás, y recontactás consumibles.",
    abreEn: { texto: "Mi día", href: "/hoy" },
    cadaDia: [
      "Consultas por asignar (web, teléfono, WhatsApp).",
      "Ventas para facturar y cobros por registrar.",
      "Preparar y despachar, con remito y videos del modelo.",
      "Remitos de service para facturar.",
      "Cobranzas: vencidas, vencen hoy y en 48 h.",
      "Recontactos de consumibles.",
    ],
    tareas: ["consumibles", 
      "asignar-consulta",
      "nueva-consulta",
      "facturar-venta",
      "registrar-cobro",
      "despachar",
      "facturar-remito",
      "cobranzas",
      "cargar-factura",
      "recontactos",
      "presupuesto",
      "deposito",
    ],
  },
  servicio: {
    titulo: "Responsable de servicio técnico",
    resumen: "Asignás técnico o aliado, presupuestás fuera de garantía, controlás los remitos y seguís las garantías.",
    abreEn: { texto: "Mi día", href: "/hoy" },
    cadaDia: [
      "Equipos parados sin técnico.",
      "Services para asignar.",
      "Remitos para controlar.",
      "Garantías con fábrica.",
    ],
    tareas: ["repuestos", "asignar-service", "presupuesto", "controlar-remito", "garantia", "aliados", "service-hecho", "cerrar-trabajo"],
  },
  tecnico: {
    titulo: "Técnico de servicio y depósito",
    resumen: "Hacés reparaciones e instalaciones y llevás el depósito. Todo trabajo termina con remito firmado y foto.",
    abreEn: { texto: "Mi día", href: "/hoy" },
    cadaDia: [
      "Remitos devueltos para corregir.",
      "Tus trabajos por prioridad: parado primero.",
      "Trabajos esperando cobro: no salir todavía.",
      "Qué preparar hoy en el depósito.",
      "Viernes: repuestos en el mínimo.",
    ],
    tareas: ["repuestos", "cerrar-trabajo", "service-hecho", "deposito", "abrir-caso"],
  },
  marketing: {
    titulo: "Marketing y contenido",
    resumen: "Contenido, material comercial, videos por modelo y campañas.",
    abreEn: { texto: "Mi día", href: "/hoy" },
    cadaDia: ["Calendario de contenidos: lo de la semana y lo que volvió con re-edición.", "Pedidos de material con fecha.", "Modelos sin video instructivo.", "Consultas del mes por canal."],
    tareas: ["contenidos", "material-cargar", "material", "atender-pedidos", "videos", "nueva-consulta"],
  },
  distribuidor: {
    titulo: "Distribuidor",
    resumen: "Ves y trabajás solo tu cartera.",
    abreEn: { texto: "Embudo", href: "/" },
    cadaDia: ["Tus consultas y seguimientos del día."],
    tareas: ["nueva-consulta", "primer-contacto", "cotizar", "datos-venta"],
  },
};

/** Las reglas del manual que el CRM hace cumplir. */
export const REGLAS_MANUAL: { regla: string; como: string }[] = [
  {
    regla: "Toda consulta se asigna por lugar de entrega y el primer contacto es dentro de la hora.",
    como: "“¿Dónde se entrega?” decide el vendedor; el CRM avisa y mide el tiempo.",
  },
  {
    regla: "Toda propuesta fuera de lista pasa por dirección antes de presentarse.",
    como: "Queda “esperando aprobación” y el PDF no sale hasta que se aprueba.",
  },
  {
    regla: "Nada se despacha sin factura y cobro acreditado (o condición aprobada).",
    como: "La venta no pasa a preparar sin el cobro o la aprobación de dirección.",
  },
  {
    regla: "Ningún trabajo técnico termina sin remito firmado y foto.",
    como: "El CRM no deja cerrar el service sin número de remito, foto firmada y foto del equipo andando.",
  },
  {
    regla: "El CRM es la fuente única: todo se carga el mismo día.",
    como: "Cada paso deja su movimiento en la ficha del contacto.",
  },
  {
    regla: "Un solo jefe directo por persona.",
    como: "Cada puesto ve lo suyo en Mi día; dirección ve todo.",
  },
];

export const tareaPorId = (id: string) => [...BASICOS, ...TAREAS].find((t) => t.id === id) ?? null;

const sinAcentos = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Busca tareas de la guía por palabras (todas deben aparecer, sin importar acentos). */
export function buscarTareas(q: string): Tarea[] {
  const palabras = sinAcentos(q)
    .split(/\s+/)
    .filter((p) => p.length >= 3 && !["como", "que", "hago", "para", "una", "los", "las", "del", "con"].includes(p));
  if (!palabras.length) return [];
  const todas = [...BASICOS, ...TAREAS];
  const texto = (t: Tarea) => sinAcentos([t.titulo, t.ojo ?? "", ...t.pasos.map((p) => p.texto)].join(" "));
  const puntuadas = todas
    .map((t) => ({ t, n: palabras.filter((p) => texto(t).includes(p)).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n);
  return puntuadas.slice(0, 4).map((x) => x.t);
}
