# Cambios de GastroWare OS

La lista para el equipo está en la pantalla Novedades (`lib/novedades.ts`).
Cómo se versiona: `docs/VERSIONES.md`.

## v1.22.0 — 2 de octubre de 2026

Pedido de dirección: "que me permita poner un apartado cuando hay clientes que compraron pero todavía no entregamos" (eligió: reservar el stock) y "que dirección pueda cambiar de estado una venta (se mandó una a preparar por error)" (eligió: permiso por persona). Migración 044_corrige_ventas.sql.

- lib/stock: VentaSinEntregar, unidadesDeVenta, apartadoPorProducto, ventasSinEntregar (etapa ganada, pedido_estado distinto de entregado); InfoStock con apartado y disponible; textoStock sobre lo disponible ("Hay 3 disponibles (2 apartadas)", "Sin disponibles (2 apartadas), …", "llegan 10 el 15 nov (4 ya vendidas)"). Tests en tests/unit/stock.test.ts.
- /stock: Hay · Apartado (desplegable con cliente, unidades y paso) · Disponible (rojo con "faltan N" si es negativo); Llega y Esperan abajo.
- recibirIngresoStock: avisa a la lista de espera solo si stock − apartado > 0 (si no, devuelve el aviso de que cubrió ventas ya hechas).
- Migración 044: usuarios.corrige_ventas (protegido en fn_protege_usuarios como ve_contenidos) y activado para dos usuarios de dirección. Administración → Usuarios: tilde "Puede corregir ventas".
- corregirPasoVenta(id, estado, motivo): exige corrige_ventas y motivo; cualquier paso; a Vendido/Facturado deja la factura sin cobrar (cobro y condición), antes del despacho borra despachado_at, sale de Entregado → devuelve stock, a Entregado → descuenta; movimiento "Venta corregida: de X a Y · Motivo: …". VentaPaso: "Cambiar paso (corrección)" con el efecto de cada destino (tablero de ventas y ficha).

## v1.21.2 — 2 de octubre de 2026

Nueva captura del iPhone de dirección: la caja de notas y la barra de abajo flotando a mitad de pantalla, y la tarjeta del interés todavía en la versión anterior a v1.21 (la app instalada no se había recargado).

- TecladoAbierto: además de la corrección por visualViewport (v1.20.1), cada vez que se cierra el teclado (focusout de un campo, la parte visible crece de golpe >120 px, orientationchange, volver a la app con visibilitychange/pageshow) da un toque de scroll de 1 px y vuelve (en 60, 450 y 900 ms) para que el iPhone recalcule la ventana; antes solo si detectaba desfasaje.
- .fijo-abajo también en lo pegado abajo: caja de notas de la ficha (FichaChat), total de la cotización, caja del asistente IA y pie de la ficha de contenido.
- AvisoVersion + GET /api/version (sin caché): al abrir, cada 5 minutos y al volver a la app compara la versión publicada con la cargada; si cambió muestra "Hay una versión nueva del sistema · Actualizar" (recarga con un toque; no recarga sola para no perder lo escrito).

## v1.21.1 — 2 de octubre de 2026

- InteresFijado (movimientos): hora con hourCycle h23 ("hoy 10:31" en vez de "hoy 10:31 a. m."). Verificado v1.21.0 en prod: tarjeta con movimientos y autor, lápiz y ⋯, columna Para hoy (6 = KPI), ficha a 390 px sin desborde.

## v1.21.0 — 2 de octubre de 2026

Pedido de dirección (con captura y propuesta aprobada): "que en embudo aparezcan los que hay que contactar hoy" y "repensar la parte de cada contacto: que se vean los movimientos, notas y de quién son; lo de productos de abajo quedó de versiones anteriores" (sin migración).

- InteresFijado rehecho: cabecera (nivel, producto, etapa, línea) con lápiz (nivel + productos/texto, antes en "Más opciones") y "⋯" (IA, lista de espera, calculadora, financiación, eliminar); AsignacionInteres solo con lugar de entrega y quién atiende; recuadro del próximo paso coloreado (atrasado/hoy/futuro) con PrimerContacto (nuevo, exportado de AsignacionInteres), CadenciaInteres (children + conNoRespondio) y Reprogramar (PanelReprogramar en línea); cotización vigente; Cotizar/Nueva versión, Me compró, No se dio en grilla de 3; "Movimientos" del interés (MovimientoInteres: autor o "Sistema", hoy/ayer con hora, medio · resultado o tipo, con quién), 5 visibles + "Ver los N".
- FichaChat: arma movimientosDe por interés con nombres de usuarios y personas; abajo de las operaciones "Otros movimientos del cliente" solo con lo que no está en una tarjeta.
- Embudo: columna "hoy" primera (COLUMNAS_EMBUDO), repartirColumnas/tocaHoy puros (tests/unit/embudo-hoy.test.ts): vencidos y "Llegó stock" salen de su etapa; orden atrasados → hoy (sin hora primero, por hora, por nivel) → contactados hoy (nota de usuario hoy, contactado_hoy) al final. Tarjeta con etiqueta de etapa en "Para hoy"; no se puede soltar en "Para hoy"; en PC columnas con auto-cols minmax(200px) y scroll horizontal. KPIs desde todas las tarjetas.

## v1.20.3 — 2 de octubre de 2026

Dirección no pudo anotar en un interés "Llamar hoy": el control de v1.19.1 bloqueaba la nota hasta elegir el próximo paso (y el aviso quedaba abajo, tapado por el teclado).

- RegistrarActividad: la nota se guarda siempre; si el interés vencía hoy o estaba atrasado y no se eligió próximo, después de guardar queda abierto "Próximo paso" con el aviso "✓ Anotado. ¿Cuándo lo volvés a contactar?". "Mantener" sigue siendo solo para fechas futuras.
- anotarContacto: se quitó el rechazo del servidor.

## v1.20.2 — 2 de octubre de 2026

- /pedidos: la etiqueta del paso (`proximoPasoVenta`) era `shrink-0` sin corte y medía 379 px ("Registrar el cobro (o pedir condición a dirección)"): ahora max-w 50%, en dos renglones si hace falta. Verificado a 390 px: Contactos, Mi día, Consumibles, Servicio, Ventas, Tablero y Cobranzas sin desborde.

## v1.20.1 — 2 de octubre de 2026

Reporte de dirección con captura del iPhone: "se rompió algo en mobile, se sube el footer y queda raro" (en Contactos).

- Causa principal: las grillas de listas (`grid gap-2 lg:grid-cols-2`) en el celular tienen una sola columna implícita `auto`, que crece hasta el ancho mínimo del contenido; un texto con `truncate` (nowrap) mide todo su largo, así que un movimiento largo ensanchaba la lista. Medido en producción a 390 px: "Últimos movimientos" de 2.065 px y la página de 2.082 px de ancho (5 veces la pantalla); con el arreglo, 339 px y la página igual a la pantalla.
- Arreglo: `grid-cols-1` (minmax(0, 1fr)) en las 40 grillas de una columna en el celular (app y components); la tarjeta de Contactos con `min-w-0`.
- TecladoAbierto: mide visualViewport y, si al cerrar el teclado el borde de abajo visible queda más abajo que la ventana (iPhone), baja lo fijo de abajo esa diferencia (--ajuste-abajo, clase .fijo-abajo en BottomNav y BotonFlotante) y da un toque al scroll para que se reacomode.

## v1.20.0 — 2 de octubre de 2026

Pedido de dirección: "que en consumibles me permita eliminar una vez suspendido" (sin migración: la política recurrencias_all ya permite borrar a quien ve el cliente; tareas.recurrencia_id es on delete set null).

- Acción eliminarReposicion(ids): solo gestores (esGestor); solo planes suspendidos (activa = false); cancela las tareas abiertas del plan, borra las recurrencias y deja en la ficha una actividad cambio_etapa "Reposición eliminada por dirección: … (estaba suspendida: motivo)".
- GrupoReposicion: botón "Eliminar" con confirmación junto a "Reactivar" cuando el grupo está suspendido y puedeEliminar; /consumibles lo pasa según el puesto del usuario.

## v1.19.1 — 2 de octubre de 2026

Caso reportado por dirección: un interés del plan de octubre (vencía hoy, "cotizar") seguía en "para contactar hoy" después de que el vendedor anotó la visita. Causa: RegistrarActividad consideraba "vigente" un próximo contacto con fecha = hoy y, sin elegir próximo paso, lo mantenía (y anotarContacto no toca la fecha si no viene una nueva); con un interés atrasado pasaba lo mismo.

- RegistrarActividad: "Mantener" solo para fechas futuras; si el interés vence hoy o está atrasado y se anota un contacto (texto o medio) sin próximo paso, abre "Próximo paso" y pide elegir fecha o "Sin próximo" (el botón dice "Elegí el próximo"). Al cerrar el interés no hace falta.
- anotarContacto: mismo control del lado del servidor (opción cierra para el cierre).

## v1.19.0 — 1 de octubre de 2026

Pedido de dirección: "para cargar nueva venta, que te solicite cargar cliente o cargar uno nuevo para poner CUIT" (sin migración).

- PedidoDirectoForm: "¿Quién lo compró?" = ClienteSelector (buscarClientes: nombre, razón social, teléfono, CUIT) o "Cliente nuevo (con CUIT)" = ClienteNuevoRapido pedirCuit (razón social + CUIT obligatorios, validación de dígito verificador en vivo). Si el cliente elegido no tiene razón social o CUIT válido, se piden en la venta. Se quitó el campo de texto libre que creaba un cliente mínimo.
- crearPedidoDirecto: clienteId obligatorio (sin clienteTexto); con fiscal valida y guarda razón social y CUIT (único) en el cliente; sin fiscal exige que el cliente ya los tenga.
- crearClienteRapido: pedirCuit/razonSocial/cuit; el CUIT es único: si ya existe devuelve ese cliente como duplicado por "CUIT" (solo "usar" o "corregir el CUIT", no "cargarlo igual"). PosibleDuplicado y buscarDuplicados traen razón social y CUIT. Nueva /pedidos/nuevo?cliente= pasa razón social y CUIT.

## v1.18.0 — 1 de octubre de 2026

Pedido de dirección: "en ventas, ¿dónde se entrega? no me despliega la sucursal de entrega (ej. Makery); si no tiene, que me deje cargar el lugar" y "con anticipo + saldo, una calculadora: anticipo x% y cómo se paga (20% al día, 10% a 15 y 10% a 30 días), saldo igual (antes de despachar e-cheqs a 30, 45, 60 y 75 días)" (migración 043_plan_de_pagos.sql).

- VentaPaso (informar la venta): "¿Dónde se entrega?" es un select con las sucursales activas del cliente (+ "Retira en el local" y el texto anterior "como estaba"); "Otro lugar de entrega" crea la sucursal inline (crearSucursal) y la elige. Se guardan oportunidades.sucursal_id (lugar) y direccion_entrega (texto "Nombre — dirección, ciudad"). Se quitó el select "Facturar a la razón social de la sucursal" (ninguna sucursal tiene razón social propia; sucursal_id pasa a ser el lugar de entrega, como en la cotización). Tablero de ventas: carga las sucursales de los clientes con ventas por informar. Ficha: sin direccionSugerida.
- Plan de pagos: lib/plan-pago.ts (tipoPlan, planInicial, cambiarAnticipo, repartir, problemaPlan, normalizarPlan, textoPlan; tests/unit/plan-pago.test.ts) + PlanPagoEditor. "Anticipo + saldo" (antes "Anticipo y saldo antes de despachar"; la 043 renombra las ventas existentes) → grupos Anticipo/Saldo (saldo antes de despachar o contra entrega); cheque/e-cheq y cuenta corriente → un grupo "Pagos". Porcentajes sobre el total, montos con monto_estimado (o total cargado en la calculadora). informarVenta valida y guarda oportunidades.plan_pago (jsonb) y lo suma al movimiento; la venta informada/facturada muestra el plan; "Aprobar sin cobro" viene completado con el plan.

## v1.17.2 — 1 de octubre de 2026

- EliminarOperacion: "Eliminar interés (mal cargado)" (antes "mal cargada").

## v1.17.1 — 1 de octubre de 2026

- eliminarOperacion: el registro en la ficha dice "Interés eliminado" (antes "Interés eliminada").

## v1.17.0 — 1 de octubre de 2026

Pedido de dirección: "que a mí me deje eliminar una venta si está mal cargada" (sin migración: oportunidades y equipos ya permiten borrar a dirección por RLS; facturas_write permite a todos).

- Acción eliminarOperacion(oportunidadId, motivo): solo gestores (esGestor), motivo obligatorio. Rechaza si hay una factura vinculada cobrada. Si la venta estaba entregada devuelve el stock (unidadesVendidas). Borra los equipos de la venta salvo los que tienen OT, las facturas y la oportunidad (cascada a cotizaciones, ítems y actividades vinculadas). Deja en la ficha una actividad "Venta/Interés eliminada por dirección: … · Motivo: …".
- Componente EliminarOperacion (confirmación con motivo) en el tablero de ventas, en cada venta de la ficha y en "Más opciones" del interés; solo se muestra a dirección.

## v1.16.0 — 1 de octubre de 2026

Pedido de dirección: "si cargo una venta directa, que me permita añadir más unidades (un cliente que compró 3 Essential)" (migración 042_ventas_con_cantidades.sql).

- PedidoDirectoForm: cada producto elegido con − cantidad + y subtotal; el monto sugerido es precio × unidades. crearPedidoDirecto recibe cantidades, guarda oportunidad_items y oportunidades.cantidad antes de ganar.
- Migración 042: fn_ganar_venta crea un equipo por unidad de cada producto no consumible de la venta (principal y extras, cantidad de oportunidad_items o 1), con garantía y sucursal_id de la venta; antes creaba uno solo y solo del principal (también afectaba a "Me compró" de intereses con varias unidades o productos).
- entregarVenta / corregirPasoVenta: descuentan / devuelven stock de todos los productos × unidades (antes 1 del principal).
- Tablero de ventas: "3 × Producto" con las unidades.

## v1.15.0 — 1 de octubre de 2026

Pedido de dirección: "que marketing pueda cargar las fichas que salen en las cotizaciones" y "no veo dónde aprobar lo que sube marketing en el calendario" (migración 041_fichas_marketing.sql).

- Aprobaciones: sección "Contenidos para aprobar" (estado pendiente, miniatura de la primera imagen firmada, cuenta, tipo, objetivo, copy, quién lo cargó, "Ver completo"). DecidirContenido + acción decidirContenido (solo dirección; reedición exige la corrección; aviso a quien lo cargó). Antes la aprobación solo estaba dentro de la ficha del calendario y los avisos de los 2 pendientes se habían borrado en la puesta a cero.
- Contador de "Aprobaciones" en el menú lateral para dirección (propuestas + contenidos pendientes: Rail paraAprobar, ItemMenu.badgeAprobar); bandeja "Contenidos para aprobar" en Mi día de dirección; aviso arriba del embudo.
- /material/fichas: todos los productos activos por marca con FichasCotizacion (cargar/ver/quitar), estado con/sin ficha (cuenta también la ficha de Material vinculada) y filtro "Sin ficha". Acceso marketing, dirección y administración; tarjeta en /material.
- Migración 041: documentos_delete permite a quien gestiona Material quitar fichas de producto (antes solo gestores o quien la subió).

## v1.14.1 — 1 de octubre de 2026

- Service con sucursal (sin migración: ordenes_trabajo.sucursal_id ya existía y crearOT lo aceptaba, pero el formulario no lo mandaba). OTForm: "¿Dónde es el service?" con las sucursales activas (sucursalesDe), por defecto la del equipo (listarEquiposCliente devuelve sucursalId) o la principal. Ficha de la OT: renglón "Dónde" (nombre, dirección, quién recibe, indicaciones). Lista de inspección: dirección de la sucursal de la OT.

## v1.14.0 — 1 de octubre de 2026

Sucursales y puntos de entrega (migración 040_sucursales_entrega.sql), pedido de dirección: "una razón social puede tener múltiples sucursales o puntos de entrega".

- Migración 040: sucursales.recibe e indicaciones; cotizacion_versiones.sucursal_id (lugar de entrega); clientes con sucursales sin principal → la más vieja pasa a principal; arreglo del último nombre con letra rota ("Ä"+U+0080 → "Ā").
- Acciones: crearSucursal (la primera queda principal; opción principal), actualizarSucursal, hacerPrincipalSucursal, darDeBajaSucursal (baja lógica; si era la principal, pasa la siguiente).
- SucursalesCliente rehecho (tarjetas, editar, hacer principal, dar de baja con confirmación, provincia de lista, quién recibe, horario/indicaciones).
- Cotizar: "Lugar de entrega" en Pago y entrega (sucursales activas, principal primero) + "Otro lugar de entrega" que la crea ahí mismo; registrarCotizacion valida que sea del cliente, la guarda en la versión y en oportunidades.sucursal_id (la venta la trae elegida). PDF: renglón "Lugar de entrega" (nombre, dirección, quién recibe, horario).
- Arreglo: el domicilio del PDF, el chequeo de datos para cotizar, guardar datos desde cotizar, la ficha de service y la inspección ignoraban la baja de sucursales (tomaban una dada de baja).
- Datos (fuera de versión, SQL corrido por dirección): tildes rotas (mojibake) arregladas en nombres, notas y personas; "nan" quitado; emojis de nombres de WhatsApp recuperados; sucursal de Mar del Plata de Esquina 3 dada de baja (vino mal de ZEUS).

## v1.13.0 — 1 de octubre de 2026

Reprogramar (migración 039_proximo_hora.sql), a partir de un caso real del vendedor de territorio (cliente que prefirió la visita la semana siguiente).

- Migración 039: oportunidades.proximo_hora (time) + trigger fn_hora_proximo: si cambia proximo_contacto sin indicar hora nueva, la hora vieja se borra.
- reprogramarInteres(oportunidadId, { fecha, hora, accion, nota }): no cuenta como contacto; actividad tipo 'interes' "Reprogramado: del dd/mm (hh:mm) al dd/mm (hh:mm) · acción · nota". Dos updates (fecha → hora) para que el trigger no pise la hora elegida.
- components/ReprogramarInteres.tsx (PanelReprogramar + botón): Hoy más tarde (hora obligatoria), Mañana, Pasado mañana, El lunes, En una semana, Otra fecha; acción y nota opcionales. En Mi día (PendienteFila, botón de calendario), embudo (tarjeta desplegada) y ficha (InteresFijado).
- textoProximo muestra la hora; Mi día carga proximo_hora y ordena los de hoy por hora (clasificarPendientes); embudo carga proximo_hora y proxima_accion. Guía: "Pasar un contacto para otro día u hora".

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
