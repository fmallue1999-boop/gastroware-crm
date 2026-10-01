# Cambios de GastroWare OS

La lista para el equipo está en la pantalla Novedades (`lib/novedades.ts`).
Cómo se versiona: `docs/VERSIONES.md`.

## v1.12.4 — 30 de septiembre de 2026

- Contactos (/clientes): la lista por defecto salía solo de las últimas actividades; tras la puesta a cero (sin actividades) quedaba vacía aunque decía "5.608 en total". Ahora: "Últimos movimientos" (hasta 20, solo en la página 1) y debajo todos de la A a la Z paginados de a 60 (?pagina=N, con Anteriores/Siguientes). El vendedor sigue viendo solo los suyos; dirección y administración, todos.

## v1.12.3 — 30 de septiembre de 2026

- El mensaje de error (app/(app)/error.tsx) decía el nombre de una persona: ahora "avisale a dirección". Docs y comentarios sin nombres propios, solo puestos (las migraciones ya aplicadas no se tocan).

## v1.12.2 — 30 de septiembre de 2026

Celular (sin migración), probado en producción a 390 px de ancho.

- globals.css: en pantallas táctiles o de menos de 1024 px, input/select/textarea van con 16 px como mínimo (había decenas de campos con text-[15px]; Safari de iPhone hace zoom al enfocar un campo de menos de 16 px). Los text-base (17 px) y más grandes no se tocan.
- BotonFlotante oculto en /cotizar/*, /asistente, /consumibles/venta, /repuestos/nueva y /tareas/nueva (tapaba "Guardar y armar PDF" y el enviar del asistente).

## v1.12.1 — 30 de septiembre de 2026

Velocidad (migración 038_velocidad_rls.sql).

- Las políticas RLS llamaban a fn_rol(), fn_ve_todo(), fn_es_gestor(), auth.uid()... por cada fila (Contactos: ~5.600 clientes y ~1.100 actividades por pantalla). La 038 reescribe todas las políticas de public envolviendo las funciones sin argumentos en (select ...) (initPlan: una vez por consulta) y fn_puede_ver_cliente(x) como ((select fn_ve_todo()) or fn_puede_ver_cliente(x)), que es equivalente porque la función ya empieza por fn_ve_todo().
- Autoverificación: antes y después cuenta, como un usuario de cada puesto activo, las filas visibles de cada tabla tocada; si algo difiere corta con error y no aplica nada. Deja la medición en config.velocidad_038.

## v1.12.0 — 30 de septiembre de 2026

Experiencia del vendedor (migración 037_cotizar_simple.sql), a partir de la prueba de dirección en el celular.

- Velocidad: vercel.json regions ["gru1"] (las funciones corrían en iad1 y la base está en São Paulo: cada consulta cruzaba el continente). Layout con los conteos en paralelo; la ficha ya no carga plantillas ni material viejo.
- Migración 037: productos.iva_pct (10,5 equipos; 21 consumibles/repuestos) y cotizacion_items.iva_pct; config cotizacion_moneda (USD) y listas cotizacion_formas_pago / plazos_entrega / condiciones_entrega; fn_toca_interes marca el primer contacto con cualquier nota/cotización (antes solo si la anotaba el comercial_id); fn_linea_oportunidad también al cambiar el producto (equipos ↔ consumibles).
- Nueva consulta: cantidades por producto (oportunidad_items + cantidad), "¿Quién lo atiende?" con el automático por zona (elegirResponsable puro en ruteo.ts), sin "volver a contactar" (primer contacto hoy; la nota de alta va como tipo 'consulta').
- registrarCotizacion: moneda fija y precios de catálogo para vendedores (líneas libres solo dirección/administración), IVA por línea, pedido especial único (pedidoEspecial) y seguimiento día 1 agendado. calcularTotales con IVA por alícuota; el PDF muestra un renglón por alícuota.
- CotizacionForm: datos del cliente resumidos si están completos, cantidades con − +, precio fijo, desplegables, pedido especial único, inputs de 16 px (sin zoom en iPhone), salida a embudo / Mi día. TecladoAbierto + .ocultar-con-teclado.
- Embudo: rangoMes en hora argentina; tarjeta desplegada con WhatsApp / Abrir ficha / Cotizar / Me compró / No se dio (sin Anotar ni Pasar a…). AvisoVersion apilado en el celular. InteresFijado "Más opciones" reducido; AsignacionInteres con "Ya lo contacté por…".
- Admin: moneda y listas en Marca → Cotización; IVA por producto en el Catálogo.

## v1.11.1 — 30 de septiembre de 2026

- Material por producto: orden marca → productos → accesorios (antes las categorías con el mismo orden se ordenaban por nombre y ACCESORIOS quedaba primero).
- Probado en producción: buscador, marca con tres columnas, subir imagen y ficha, PDF embebido, .zip de imágenes, tabla por producto y borrar (sin rastros en la base ni en el almacenamiento).

## v1.11.0 — 30 de septiembre de 2026

Material, la biblioteca comercial (migración 036_material.sql).

- Migración 036: material_marcas, material_categorias (sección productos/accesorios), material_productos (slug único, producto_id → Catálogo) y material_archivos (dueño marca|producto; espacios catalogo/logo/tipografias y videos con tipo usar/configurar/lavar/otro, imagenes, ficha), trigger que borra las filas de archivos al borrar marca o producto, auditoría, fn_gestiona_material (marketing, dirección, administración), RLS (todo el equipo ve), bucket privado "material" (500 MB), datos iniciales de las 3 marcas vinculados al Catálogo por nombre.
- lib/material.ts (espacios, tipos de video, buscador sin tildes, slugs, validación), lib/servidor/material.ts, lib/actions/centro-material.ts (archivos, ficha única que reemplaza, estructura con orden).
- /material (buscador + marcas + acceso a la tabla), /material/[marca] (columnas identidad / productos / accesorios; ?editar=1), /material/[marca]/[producto] (videos, imágenes con .zip, ficha con PDF embebido), /material/por-producto (Cómo usar / configurar / lavar, + Agregar). /biblioteca redirige a /material.
- VisorMedios compartido (Calendario y Material), AccionesArchivo (descargar con &download= y compartir el archivo).
- PDF de cotización: anexa también la ficha de Material de los productos vinculados (sin repetir si es la misma).

## v1.10.2 — 30 de septiembre de 2026

- Calendario: la grilla pasa a w-max (antes medía el ancho de la caja y la columna fija se iba con ella al desplazar más allá de ese ancho).

## v1.10.1 — 30 de septiembre de 2026

- IrAHoy: el mes se desplaza hasta la columna de hoy (data-hoy). nombreMes con mayúscula inicial en vez de la clase capitalize (que ponía "Del" y "Al").
- Probado en producción: crear ficha con imagen, copy con renglones, mover de fecha, aprobar, verla en mes, semana (miniatura) y listado, filtros combinados y borrar (sin rastros en la base ni en el almacenamiento).

## v1.10.0 — 30 de septiembre de 2026

Calendario de contenidos (migración 035_contenidos.sql).

- Migración 035: tablas contenidos (una ficha = un registro con su estado; fecha como date) y contenido_archivos (cascade), bucket privado "contenidos" (imágenes y videos, 500 MB por archivo; el plan puede limitar menos), usuarios.ve_contenidos (lo cambia solo un gestor), fn_ve_contenidos / fn_carga_contenidos, trigger fn_contenido_guardia (updated_at/by; solo dirección general aprueba, pide re-edición, cancela o escribe la corrección) y auditoría.
- lib/contenidos.ts (cuentas, tipos, estados y sus colores; rangos de mes y semana desde el lunes; orden natural de archivos y dentro de la celda), tokens de color en globals.css, lib/servidor/contenidos.ts, lib/actions/contenidos.ts (guardar, borrar con sus archivos del almacenamiento, avisos a dirección y a quien cargó).
- /contenidos (MES | SEMANA, doble entrada días × HISTORIAS/FEED con columna y encabezado fijos, filtros en el link) y /contenidos/fichas (listado). La ficha se abre al costado (?ficha= / ?nueva=1&fecha=&tipo=) sin perder la vista.
- lib/subir.ts: subida directa o por partes (tus-js-client, 6 MB) con avance. lib/core/storage.ts: firmarLote.
- Menú "Contenidos" para marketing y dirección, y para quien tenga ve_contenidos (tilde en Administración → Usuarios).

## v1.9.1 — 28 de septiembre de 2026

- ConPanel: el sticky pasa al aside (antes el div interno no podía quedar fijo porque medía lo mismo que su contenedor).
- Pestaña "Equipos" (antes "Equipos y services", se cortaba en el panel).

## v1.9.0 — 28 de septiembre de 2026

Ficha del cliente por pestañas y cotizar en pantalla propia (sin migraciones).

- FichaChat: cabecera corta + FichaTabs (Operaciones, Historial, Cotizaciones, Equipos y services, Personas, Datos; IrAPestana para saltar). En el panel del costado todo desplaza junto (antes la cabecera dejaba ~70 px para el contenido) y hay botón para abrir la ficha completa; ConPanel más ancho (440/500 px). ?tab= abre una pestaña.
- NuevaOperacion: interés en equipos (InteresAgregar con abiertoInicial/onCerrar), venta de consumibles, pedido de repuesto, tarea. Se sacaron los accesos fijos de consumibles/repuestos de la cabecera.
- InteresFijado: cotización vigente a la vista (Cotizar / Ver PDF / Compartir / Nueva versión), Me compró / No se dio, "Más opciones" en grupos.
- /cotizar/[id]: CotizacionForm en 5 secciones con total fijo abajo; arranca con los productos del interés o con la última versión. Datos fiscales obligatorios (lib/datos-cotizar.ts: cuitValido con dígito verificador, faltanParaCotizar, datosFiscalesDe, cuitProlijo); guardarDatosParaCotizar los guarda en el cliente y la sucursal principal (CUIT único con aviso); registrarCotizacion los exige.
- crearClienteRapido + ClienteNuevoRapido (con aviso de duplicados) en la venta de consumibles; botón visible de cliente nuevo en el pedido de repuesto. El PDF muestra el CUIT del cliente con guiones.

## v1.8.0 — 28 de septiembre de 2026

Cotización en PDF (migración 034_cotizacion_pdf.sql).

- Migración 034: datos de la empresa y de la cotización en config (empresa_*, cotizacion_punto_venta, cotizacion_leyenda_usd); productos.codigo y detalle_tecnico; cotizacion_items.codigo y detalle; cotizacion_versiones.iva_pct, plazo_entrega, condicion_entrega y tipo_cambio (el total sigue siendo el neto sin IVA); documentos acepta entidad 'producto' y tipo 'ficha' (visibles para todo el equipo); fn_proximo_numero_cotizacion (solo gestores) para fijar desde qué número siguen.
- PDF con @react-pdf/renderer (lib/pdf/CotizacionPdf.tsx: Manrope desde lib/pdf/fuentes, logo en vectores) y fichas anexadas con pdf-lib (lib/servidor/cotizacion-pdf.tsx). Ruta /cotizacion/[id]/pdf (?v=, ?descargar=1) con la sesión del usuario; la página /cotizacion/[id] redirige al PDF o explica la aprobación pendiente.
- lib/cotizacion-pdf.ts: numeroComprobante, calcularTotales (neto, IVA, total), diasEnLetras, leyendaDolar, nombreArchivo, tipoAnexo.
- CotizacionForm: IVA, plazo y condición de entrega, tipo de cambio; al guardar ofrece Ver PDF y Compartir (Web Share API con el archivo). registrarCotizacion guarda código y detalle del catálogo y devuelve la versión.
- Catálogo: código, detalle técnico y "Cargar PDF" por producto (FichasCotizacion). Administración → Marca: DatosCotizacion (membrete, punto de venta, nota de dólares, numeración).

## v1.7.0 — 28 de septiembre de 2026

Reportes comerciales por apartado (sin migraciones).

- Tablero: filtro por apartado (OppFila.linea; Filtro.linea en aplicarFiltro) sobre todos los números existentes.
- lib/reportes.ts (resumirActividad: intentos vs conversaciones por medio y vendedor; resumirControl: sin atender y sin próximo paso) y lib/servidor/reportes.ts (actividad, control, agenda, consumibles, repuestos por período y vendedor).
- components/tablero/PanelesComerciales.tsx. Asistente: numeros_del_periodo con apartado y los paneles nuevos.

## v1.6.0 — 28 de septiembre de 2026

Pesos y dólares, catálogo por apartado y cotización con forma de pago y descuento especial. Migración 033.

- productos.precio_ars / precio_usd (backfill desde precio_referencia; trigger mantiene precio_referencia = precio en la moneda principal); lib/precios.ts (precioEn, lineaDeProducto, productosDeLinea).
- Cotizador: moneda elegida (reprecia al cambiar), forma de pago (FORMAS_PAGO_VENTA + detalle), descuento especial % + motivo (cotizacion_versiones.subtotal/descuento_pct/descuento_motivo; aprobación si supera descuento_libre_pct); evaluarFueraDeLista contra el precio en la moneda de la cotización.
- Venta directa con moneda (antes siempre ARS) y solo equipos; crearInteres toma la moneda del producto; backfill de moneda en consultas sin monto.
- Pickers por apartado: /alta, /clientes/nuevo, ficha (+ interés, cambiar producto, cotizador) e IA leer consulta solo equipos; consumibles y repuestos con su catálogo y precio de lista.
- Catálogo: precio en pesos, en dólares y moneda principal.

## v1.5.1 — 28 de septiembre de 2026

- Repuestos: la cotización por WhatsApp saluda a la persona principal del cliente (contactos), no a la empresa.

## v1.5.0 — 28 de septiembre de 2026

Repuestos (tercera etapa de la organización por apartados). Migración 032.

- solicitudes_repuesto (1:1 con la operación de linea repuestos): equipo o modelo, serie, pieza del catálogo o descripta, código, foto (bucket servicio), cantidad, validación técnica (validador, resultado, nota), disponibilidad, plazo, precio, moneda, caso/service de origen. RLS: quien ve la operación y quien valida.
- /repuestos (en curso por estado, para validar, ganadas, perdidas) y /repuestos/nueva (desde ficha, caso o service); acciones validar, pedir/saltear validación, cotizar (WhatsApp armado), esperando, confirmar (fn_ganar_venta → circuito de la venta), perder.
- Mi día: repuestos para validar (validador) y para cotizar (vendedor). Embudo: solo linea equipos. Asistente: herramienta repuestos.

## v1.4.0 — 28 de septiembre de 2026

Consumibles (segunda etapa de la organización por apartados). Migración 031.

- oportunidad_items (cantidad y unidad por producto); recurrencias como plan de reposición (sucursal, anticipación, responsable, última cantidad, suspensión con motivo; índice único de plan activo por cliente/sucursal/producto; auditoría).
- fn_reponer: una compra reinicia el plan (toma el tiempo del producto si el plan no tenía); fn_ganar_venta: consumibles → plan, repuestos y consumibles ya no crean equipos; backfill de planes para ventas de consumibles ya cerradas.
- /consumibles (a contactar agrupado, calendario, todos), /consumibles/venta; acciones: contacto, reprogramar, suspender, reactivar, ajustar, cotizar.
- Catálogo: "repone cada N días" en los consumibles. Mi día: bandeja de reposiciones del responsable. Cron: ya no crea tareas de recompra.
- Ficha: plan de consumibles, accesos rápidos (venta de consumibles, tarea precargada con link a la ficha). Asistente: herramienta consumibles.

## v1.3.0 — 28 de septiembre de 2026

Seguimiento comercial (primera etapa de la organización por apartados). Migración 030.

- oportunidades.linea (equipos/consumibles/repuestos, por producto; trigger en altas) y oportunidades.proxima_accion.
- actividades.medio / resultado / ocurrio_at / contacto_id; lib/actividad.ts (intento vs conversación, sugerencias por resultado).
- RegistrarActividad (ficha y Mi día): actividad + mantener/cambiar próximo paso + motivo de reprogramación (queda la fecha anterior) + cerrar como perdida, en un guardado.
- Personas: contactos en uso (pestaña Personas, alta crea la persona, backfill de "Contacto: X" de las notas); buscarDuplicados por teléfono/email de clientes y personas: aviso, sin fusión automática.
- Mi día: "Sin próximo paso", acción y apartado en cada fila, responsable para dirección.

## v1.2.0 — 28 de septiembre de 2026

Tareas y agenda del equipo. Migración 029 (tablas nuevas `agenda` y `agenda_personas`, columna `notificaciones.push_at`).

- /tareas (lista, calendario del mes, "Lo que asigné", equipo para dirección), /tareas/nueva, /tareas/[id] (detalle, cambiar, borrar, .ics).
- Tipos: tarea, reunión, capacitación, pago (monto y moneda), otro. Varias personas, links, lugar o videollamada, repetición semanal/quincenal/mensual (una fila por fecha, misma serie), aviso 0/1/3/7 días antes.
- Permisos (RLS): ve quien la creó, quienes la tienen y dirección; cambia quien la creó, dirección o la única persona asignada; cada uno marca la suya.
- Mi día: "Tu agenda de hoy" arriba para todos los puestos; el número de Mi día suma la agenda.
- Avisos: `avisar()` manda también push al celular (lib/servidor/push.ts, una sola vez por aviso con push_at); cron 8:30 deja en la campana los avisos del día y los anticipados (avisado_el) y los suma al push de la mañana.
- Asistente IA: herramienta `mi_agenda`.

## v1.1.0 — 27 de septiembre de 2026

Funciones de IA para el trabajo diario (sin migraciones).

- Asistente IA (/asistente) con herramientas de solo lectura sobre los datos que el puesto ya ve (RLS): Mi día, contactos, ficha, intereses, catálogo, ventas, casos, services, cobranzas, números del período y la guía.
- Nueva consulta: cargar desde un mensaje o captura (texto o imagen → formulario).
- Borrador del informe de los lunes con IA.
- Ayuda IA en casos de postventa (preguntas, pruebas seguras, WhatsApp, derivar o no).
- Botones de IA en ficha, Mi día, tablero y cobranzas.
- Administración → IA: selector de modelo (config `ia_modelo`) y uso del mes en tokens.
- Guía: asistente y atajos con IA.

## v1.0.0 — 27 de septiembre de 2026

Primera versión numerada: la empresa trabaja por puestos (manual por áreas v2).

- Marca GastroWare OS (logo, colores, ícono) configurable en Administración → Marca.
- Puestos, territorios y Mi día por puesto.
- Consultas por territorio, primer contacto medido, cadencia de propuesta.
- Aprobación de dirección para propuestas fuera de lista.
- Circuito de venta: informar, facturar, cobrar, preparar, despachar, entregar; postventa 2/10/30.
- Cobranzas, casos de postventa, servicio técnico con remito obligatorio, aliados, garantías.
- Informe comercial de los lunes, pedidos de material, videos por modelo.
- Tablero con la operación y guía de uso dentro del sistema.
- Migraciones 027 y 028.
