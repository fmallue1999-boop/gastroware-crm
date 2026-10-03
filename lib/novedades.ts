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
    version: "1.26.1",
    fecha: "2026-10-02",
    titulo: "Aviso al cambiar quién atiende un cliente",
    cambios: [
      "Cuando dirección cambia “Lo atiende” en la ficha, al vendedor nuevo le llega el aviso “Te asignaron un cliente” a la campana y al celular (antes no le llegaba nada).",
    ],
  },
  {
    version: "1.26.0",
    fecha: "2026-10-02",
    titulo: "Conversación del equipo en cada interés",
    cambios: [
      "La conversación ahora es del interés (antes colgaba de la cotización): cada interés tiene su “Conversación del equipo” desde la consulta hasta la postventa, esté cotizado o no. Lo que ya estaba escrito pasó a su interés.",
      "Está una sola vez donde trabajás: en el embudo (abrí la tarjeta → “Conversación del equipo”; si hay mensajes, la tarjeta muestra cuántos y en naranja los nuevos), en la tarjeta del interés y en la venta dentro de la ficha, y en Aprobaciones. Se sacó de la pestaña Cotizaciones, donde estaba repetida.",
      "Cerrada muestra el último mensaje (“Emilia: ¿le hacemos 5%?”) y cuántos son nuevos para vos. Los avisos y el embudo llevan a la conversación en pantalla propia, con el resumen del interés y su cotización.",
      "Mi día suma “Conversaciones con mensajes nuevos”: las de tus intereses y las que ya abriste o donde escribiste.",
      "Para no mezclar: lo que hablaste con el cliente va en “¿Qué pasó?” (queda en los movimientos); la conversación del equipo es interna, para hablar entre ustedes con @.",
    ],
  },
  {
    version: "1.25.1",
    fecha: "2026-10-02",
    titulo: "Arreglo de fechas",
    cambios: ["Lo que pasa a la noche (de 21 a 24 h) aparecía con la fecha del día siguiente (por ejemplo “3 oct” cuando todavía era 2). Ahora todas las fechas cortas van en hora de Argentina."],
  },
  {
    version: "1.25.0",
    fecha: "2026-10-02",
    titulo: "Viáticos: cargar, rendir, aprobar y reintegrar",
    cambios: [
      "Nueva sección Viáticos (en el celular, desde Más): “Cargar gasto” → sacale foto al ticket o subí el PDF y la IA completa la fecha, el importe, el comercio, el CUIT, el comprobante y de qué es (combustible, peaje, comida, hotel…). Se revisa y se guarda; también se puede cargar a mano.",
      "Cada gasto dice cómo se pagó: “Lo pagué yo” (se devuelve), “Tarjeta de la empresa” o “Con un adelanto” (no se devuelven). Si fue por una visita, se elige el cliente.",
      "Cuando quieras, tildás los gastos y tocás “Rendir”: le llega a dirección, que aprueba o rechaza cada gasto (con el motivo) viendo la foto del comprobante. Está en Aprobaciones, en Mi día y en el número del menú.",
      "Con todo revisado, a quien rindió le llega qué se aprobó, y a administración lo que hay que devolver. Administración marca “Reintegrado” con la fecha y la persona recibe el aviso.",
      "“Resumen del mes”: cuánto se gastó, se aprobó y falta revisar, por persona y por tipo de gasto, y “Excel del mes” con todos los gastos (CUIT, comprobante, IVA) para la contabilidad. Cada uno ve lo suyo; dirección y administración, todo.",
    ],
  },
  {
    version: "1.24.0",
    fecha: "2026-10-02",
    titulo: "Conversación en cada cotización y Servicio técnico en el celular",
    cambios: [
      "Cada cotización tiene su conversación: un chat interno del equipo para anotar cosas o conversar sobre la cotización (no sale en el PDF). Está en el interés, debajo de la cotización, en la pestaña Cotizaciones y en Aprobaciones, para hablar de una propuesta antes de aprobarla.",
      "Con @ le avisás a alguien: escribí @ y elegí a la persona (o tocá el botón @). Le llega “te mencionó” a la campana y al celular. Al vendedor, a quien armó la cotización y a los que ya escribieron también les llega el aviso de que hay un mensaje nuevo.",
      "El botón “Conversación” muestra cuántos mensajes hay y cuántos son nuevos para vos; adentro, la raya “Nuevos” marca desde dónde no leíste. Los mensajes nuevos aparecen solos mientras está abierta, y cada uno puede borrar los suyos.",
      "En el celular, “Más” ahora muestra todas las secciones de tu menú que no entran en la barra de abajo (por ejemplo Servicio técnico, Consumibles y Repuestos para dirección, o Campañas y Contactos para marketing). “Services” pasa a llamarse “Servicio técnico”.",
    ],
  },
  {
    version: "1.23.0",
    fecha: "2026-10-02",
    titulo: "Espacios en Material y pedidos a marketing con aprobación",
    cambios: [
      "Material: marketing crea espacios para subir contenido de cualquier tipo (presentaciones, redes, banners, manuales…): generales en el inicio de Material, de una marca o de un producto. Se les cambia el nombre o se borran, y cualquier archivo se puede mover de un espacio a otro con “Mover”.",
      "Pedidos a marketing: se pide → marketing lo toma, lo hace y sube lo que hizo → lo manda a aprobar → dirección aprueba o pide cambios (con qué corregir) → aprobado, queda solo en Material (en el espacio que elija marketing o en “Pedidos aprobados”) y marketing lo acomoda donde quiera.",
      "Dirección ve lo que espera aprobación en Aprobaciones (con el contador del menú), en Mi día y en el menú “Pedidos a marketing”. Cada pedido tiene su página con lo que se pidió, los archivos, la corrección y dónde quedó.",
    ],
  },
  {
    version: "1.22.0",
    fecha: "2026-10-02",
    titulo: "Stock apartado y corregir el paso de una venta",
    cambios: [
      "Lo vendido que todavía no se entregó queda apartado para ese cliente. En Stock se ve Hay · Apartado (y para quién) · Disponible. Al cotizar o cargar una consulta, “Hay” muestra lo disponible (ej: “Hay 3 disponibles (2 apartadas)” o “Sin stock, llegan 10 el 15 nov (4 ya vendidas)”).",
      "Cuando llega mercadería, a la lista de espera se le avisa solo si sobra algo después de cubrir lo ya vendido.",
      "Quien tiene “Puede corregir ventas” (se tilda en Administración → Usuarios) puede cambiar una venta de paso con “Cambiar paso (corrección)”, con el motivo. Si vuelve a Facturado, la factura queda sin cobrar; si sale de Entregado, vuelve el stock.",
    ],
  },
  {
    version: "1.21.2",
    fecha: "2026-10-02",
    titulo: "Celular: la barra de abajo y aviso de versión nueva",
    cambios: [
      "En el iPhone, al cerrar el teclado la barra de abajo, el botón + y la caja de notas vuelven a su lugar (también al volver a la app).",
      "Cuando se publica una versión nueva, arriba aparece “Hay una versión nueva del sistema · Actualizar”: un toque y queda al día, sin cerrar la app.",
    ],
  },
  {
    version: "1.21.1",
    fecha: "2026-10-02",
    titulo: "Arreglo de texto",
    cambios: ["En los movimientos de cada interés la hora va en formato 24 h (10:31 en vez de 10:31 a. m.)."],
  },
  {
    version: "1.21.0",
    fecha: "2026-10-02",
    titulo: "Tarjeta del interés renovada y “Para hoy” en el embudo",
    cambios: [
      "Cada interés en la ficha muestra sus movimientos (notas, llamadas, WhatsApp, cotizaciones, reprogramaciones) con quién los hizo y cuándo; los últimos 5 y “Ver los N movimientos”.",
      "Arriba, el recuadro del próximo paso con los botones rápidos: primer contacto (“Ya lo contacté por…”), No respondió y Reprogramar. Después Cotizar, Me compró y No se dio en una fila.",
      "Con el lápiz se cambian el producto y cuánto le interesa (antes estaba abajo, en “Más opciones”). Lo que se usa poco (mensaje con IA, lista de espera, financiación, calculadora, eliminar) quedó en “⋯”.",
      "El embudo tiene primero la columna “Para hoy”: lo que hay que contactar hoy y lo atrasado, con su etapa. Cuando lo reprogramás vuelve a su columna. Si ya lo contactaste hoy pero falta el próximo paso, queda al final con “✓ Contactado hoy”.",
    ],
  },
  {
    version: "1.20.3",
    fecha: "2026-10-02",
    titulo: "Las notas se guardan siempre",
    cambios: [
      "Anotar algo en un contacto que estaba para hoy ya no te frena: la nota se guarda y después te sugiere elegir el próximo contacto (un toque y enviar).",
    ],
  },
  {
    version: "1.20.2",
    fecha: "2026-10-02",
    titulo: "Ventas en el celular",
    cambios: ["En el tablero de ventas, la etiqueta del próximo paso (ej: “Registrar el cobro…”) se acomoda en dos renglones y ya no hace la pantalla más ancha en el celular."],
  },
  {
    version: "1.20.1",
    fecha: "2026-10-02",
    titulo: "Arreglo en el celular: la barra de abajo",
    cambios: [
      "En el celular, las listas (Contactos, Consumibles, Servicio, Cobranzas, Tablero y otras) ya no quedan más anchas que la pantalla: los textos largos se cortan con “…”. Eso hacía que la barra de abajo se subiera y la pantalla quedara corrida.",
      "En el iPhone, si al cerrar el teclado la barra de abajo o el botón + quedan más arriba, vuelven solos a su lugar.",
    ],
  },
  {
    version: "1.20.0",
    fecha: "2026-10-02",
    titulo: "Eliminar una reposición suspendida",
    cambios: [
      "En Consumibles, una reposición suspendida tiene “Eliminar” (solo dirección), además de “Reactivar”. Se borra el plan con sus avisos pendientes y deja de figurar. En la ficha del cliente queda anotado qué se eliminó.",
      "Una reposición activa primero se suspende y después se puede eliminar.",
    ],
  },
  {
    version: "1.19.1",
    fecha: "2026-10-02",
    titulo: "Un contacto hecho ya no queda “para hoy”",
    cambios: [
      "Si un interés estaba para hoy (o atrasado) y anotás que lo contactaste, el sistema te pide el próximo paso: cuándo lo volvés a contactar o “Sin próximo”. Antes quedaba con la fecha de hoy y seguía apareciendo para contactar.",
    ],
  },
  {
    version: "1.19.0",
    fecha: "2026-10-01",
    titulo: "Nueva venta con cliente y CUIT",
    cambios: [
      "En Nueva venta, “¿Quién lo compró?” busca el cliente en la base (nombre, razón social, teléfono o CUIT) o carga uno nuevo con razón social y CUIT. Ya no se crean clientes sueltos con solo un nombre.",
      "El CUIT se controla al cargarlo. Si ya está en la base, te muestra ese cliente para usarlo en vez de duplicarlo.",
      "Si el cliente elegido no tiene razón social o CUIT, la venta los pide ahí mismo y quedan guardados en su ficha.",
    ],
  },
  {
    version: "1.18.0",
    fecha: "2026-10-01",
    titulo: "Lugar de entrega y plan de pagos en la venta",
    cambios: [
      "Al completar los datos de la venta, “¿Dónde se entrega?” muestra las sucursales del cliente para elegir. Si el lugar no está, “Otro lugar de entrega” lo carga ahí mismo y queda en la ficha. También está “Retira en el local”.",
      "Con “Anticipo + saldo” aparece la calculadora: ponés el % del anticipo y cada parte se divide en pagos (% del total, a cuántos días y con qué medio: transferencia, e-cheq…), con el monto de cada uno. El saldo puede ser antes de despachar o contra entrega. “Repartir en pagos iguales” arma, por ejemplo, 4 e-cheqs a 30, 45, 60 y 75 días.",
      "Con cheque/e-cheq o cuenta corriente también se carga el plan de pagos. Administración lo ve en la venta y en la aprobación de la condición.",
    ],
  },
  {
    version: "1.17.2",
    fecha: "2026-10-01",
    titulo: "Arreglo de texto",
    cambios: ["El botón del interés dice “Eliminar interés (mal cargado)”."],
  },
  {
    version: "1.17.1",
    fecha: "2026-10-01",
    titulo: "Arreglo de texto",
    cambios: ["Al eliminar un interés, en la ficha queda “Interés eliminado” (decía “eliminada”)."],
  },
  {
    version: "1.17.0",
    fecha: "2026-10-01",
    titulo: "Eliminar una venta o un interés mal cargado",
    cambios: [
      "Dirección puede eliminar una venta mal cargada (cargada dos veces, cliente equivocado…) desde el tablero de ventas o la ficha del cliente: “Eliminar venta (mal cargada)”, con el motivo.",
      "Se borra con sus cotizaciones, los equipos que cargó (los que ya tienen un service quedan) y la factura sin cobro; si ya se había entregado, vuelve el stock. Una venta con la factura cobrada no se puede eliminar.",
      "Los intereses también se pueden eliminar, desde “Más opciones”. En la ficha del cliente queda anotado qué se eliminó y por qué.",
    ],
  },
  {
    version: "1.16.0",
    fecha: "2026-10-01",
    titulo: "Ventas con varias unidades",
    cambios: [
      "En Nueva venta, cada equipo tiene cuántas unidades (− 1 +): por ejemplo, 3 Essential. El monto se calcula solo con la lista.",
      "Al cerrar una venta quedan cargados todos los equipos vendidos en la ficha del cliente (uno por unidad, cada uno con su garantía y en la sucursal de la venta). Antes quedaba solo el primero.",
      "Al entregar se descuenta del stock la cantidad vendida de cada producto, y el tablero de ventas muestra “3 × Zumex Essential Basic”.",
    ],
  },
  {
    version: "1.15.0",
    fecha: "2026-10-01",
    titulo: "Aprobar contenidos a la vista y fichas para marketing",
    cambios: [
      "Los contenidos del calendario que carga marketing ahora aparecen en Aprobaciones (con la primera imagen) para aprobar, pedir cambios o cancelar de un toque. El menú muestra cuántos esperan, y también aparecen en Mi día y arriba del embudo.",
      "Marketing carga las fichas que salen en las cotizaciones desde Material → “Fichas para cotizar”, con todos los productos y el filtro “Sin ficha”.",
    ],
  },
  {
    version: "1.14.1",
    fecha: "2026-10-01",
    titulo: "Sucursales también en el service",
    cambios: [
      "Al abrir una orden de service se elige en qué sucursal es; por defecto, donde está instalado el equipo.",
      "La orden muestra dónde es, quién recibe y las indicaciones, y la lista de inspección sale con la dirección de esa sucursal.",
    ],
  },
  {
    version: "1.14.0",
    fecha: "2026-10-01",
    titulo: "Sucursales y puntos de entrega",
    cambios: [
      "En la ficha (pestaña Datos), cada razón social puede tener varias sucursales o puntos de entrega: se agregan, se editan, se elige cuál es la principal y se dan de baja.",
      "Cada sucursal suma quién recibe y el horario o las indicaciones para entregar.",
      "Al cotizar se elige el lugar de entrega (o se carga uno nuevo ahí mismo) y sale en el PDF.",
      "Se terminaron de arreglar los nombres con letras rotas de importaciones viejas (tildes, “nan” y emojis).",
    ],
  },
  {
    version: "1.13.0",
    fecha: "2026-10-01",
    titulo: "Reprogramar en un toque",
    cambios: [
      "Nuevo botón “Reprogramar” (el del calendario) en Mi día, en la tarjeta del embudo y en la ficha: pasás el contacto para más tarde hoy (con hora), mañana, el lunes, la semana que viene u otra fecha, sin tener que anotar un contacto.",
      "Al reprogramar podés cambiar qué vas a hacer (llamar, visitar, cotizar…) y dejar una nota. Queda en el historial de dónde a dónde se movió.",
      "El próximo contacto puede tener hora: Mi día ordena los de hoy por hora y la muestra.",
    ],
  },
  {
    version: "1.12.4",
    fecha: "2026-09-30",
    titulo: "Contactos: todos a la vista",
    cambios: [
      "Contactos muestra a todos de la A a la Z, de a 60 por página (antes solo los que tenían movimientos recientes y, con el arranque en cero, salía vacío). Arriba siguen apareciendo los que tuvieron movimiento hace poco.",
    ],
  },
  {
    version: "1.12.3",
    fecha: "2026-09-30",
    titulo: "Sin nombres propios",
    cambios: [
      "Si algo falla, el aviso ahora dice “avisale a dirección”.",
    ],
  },
  {
    version: "1.12.2",
    fecha: "2026-09-30",
    titulo: "Mejor en el celular",
    cambios: [
      "En el iPhone, tocar un campo para escribir ya no agranda la pantalla (quedaba todo chico y corrido al cerrar el teclado). Vale para toda la app: buscador del embudo, ventas, repuestos, tareas, stock y cotizar.",
      "El botón verde + ya no tapa “Guardar y armar PDF” al cotizar, ni los botones de las pantallas de carga y del asistente.",
    ],
  },
  {
    version: "1.12.1",
    fecha: "2026-09-30",
    titulo: "Más rápido",
    cambios: [
      "Las pantallas con muchos contactos (Contactos, Embudo, Mi día) cargan bastante más rápido: los permisos de quién ve qué ahora se calculan una vez por pantalla y no una vez por cada contacto. Cada uno sigue viendo exactamente lo mismo que antes.",
    ],
  },
  {
    version: "1.12.0",
    fecha: "2026-09-30",
    titulo: "Más simple y más rápido para vender",
    cambios: [
      "Todo anda más rápido: el sistema ahora trabaja en San Pablo, al lado de la base de datos (antes en Estados Unidos).",
      "Nueva consulta: cuántos de cada producto (ej. 2 licuadoras), el vendedor sale solo por la zona pero se puede elegir otro, y ya no pide “volver a contactar”: el primer contacto queda para hoy.",
      "Primer contacto: botones “Ya lo contacté por WhatsApp / Llamada / Email” en la tarjeta, y ahora cuenta aunque lo anote otra persona.",
      "Cotizar: en dólares (lo define dirección), a precio de catálogo, con el IVA de cada producto, y forma de pago, plazo y condición de entrega con desplegables. Un solo “pedido especial” (descuento, plazo o financiación) que aprueba dirección.",
      "En el celular, mientras escribís se esconden las barras de abajo para que el teclado no tape nada.",
      "Al guardar la cotización: el seguimiento queda agendado para mañana y podés volver al embudo o a Mi día.",
      "Embudo: la tarjeta desplegada quedó con WhatsApp, Abrir ficha, Cotizar, Me compró y No se dio. Las ventas marcadas a la noche del último día del mes ya aparecen en Vendidos.",
      "La tarjeta del interés en la ficha quedó más simple (sin calificación, objeción ni diagnóstico).",
    ],
  },
  {
    version: "1.11.1",
    fecha: "2026-09-30",
    titulo: "Material por producto: primero los productos",
    cambios: ["En la tabla “Material por producto”, cada marca muestra primero sus productos y después los accesorios."],
  },
  {
    version: "1.11.0",
    fecha: "2026-09-30",
    titulo: "Material: la biblioteca comercial",
    cambios: [
      "Nueva sección Material: JETINNO, GASTROWARE y ZUMEX, cada una con su identidad (catálogo general, logo, tipografías), sus productos por categoría y sus accesorios.",
      "Cada producto tiene VIDEOS (cómo usar, configurar, lavar u otro), IMÁGENES y FICHA: verlos en grande, descargarlos y compartirlos por WhatsApp desde el celular.",
      "Buscador: escribís GX18, Versatile Pro o cafeteras (sin importar tildes ni mayúsculas) y te lleva directo.",
      "“Material por producto”: la tabla con los videos de cómo usar, configurar y lavar de todos los productos. Si falta uno, marketing lo agrega desde ahí.",
      "Marketing y dirección agregan, renombran y ordenan categorías y productos desde la pantalla, sin tocar nada técnico.",
      "La ficha de un producto vinculado al Catálogo se anexa sola al PDF de la cotización: se carga una sola vez.",
      "La Biblioteca vieja quedó reemplazada por Material.",
    ],
  },
  {
    version: "1.10.2",
    fecha: "2026-09-30",
    titulo: "Calendario: la columna HISTORIAS / FEED queda fija",
    cambios: ["Al desplazar el mes hacia los costados, la columna de HISTORIAS y FEED queda siempre a la vista."],
  },
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
