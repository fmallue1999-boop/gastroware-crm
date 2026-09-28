# GastroWare OS — plan maestro

> Plataforma de gestión interna · Comercial, servicio técnico y administración ·
> ZEUS como sistema fiscal, integrado por Excel · Redactado el 11 sep 2026.
> Versión publicada: https://claude.ai/artifact/Chw54gD1dJPaq5kwoMWPoh
>
> Las especificaciones ejecutables de cada etapa viven en `docs/etapas/`. Los
> planes anteriores (PLAN.md, PLAN-V2.md, IMPLEMENTATION_PLAN.md) quedaron en
> `docs/archive/` como historia. Al final de este documento están las
> decisiones que la dirección tomó después y que cambian partes del plan.

## Qué se construye

Una sola plataforma donde cada persona de GastroWare abre la app a la mañana y
ve exactamente qué tiene que hacer, y donde la dirección ve el negocio completo
en una pantalla: cuánto hay en juego, qué se enfría, qué falta cobrar, qué
técnico está saturado. Se construye sobre lo que ya existe (base de datos,
roles, equipos con garantía, circuito de service), corrigiendo el núcleo antes
de agregar nada.

## Qué no se construye

No se reemplaza ZEUS: la facturación, las cuentas corrientes y el IVA siguen
ahí. La plataforma lee ZEUS por sus exportaciones a Excel y arma encima la capa
operativa que ZEUS no tiene. No se construye para vender a terceros: cada
decisión se toma para el equipo de GastroWare, con poca afinidad con la
tecnología, en celular y en PC.

## Principios que gobiernan cada decisión

- **El núcleo antes que la periferia.** Nada nuevo se agrega hasta que la etapa anterior está terminada y en uso. "Terminada" tiene una definición escrita en cada etapa.
- **Cada rol tiene un solo inicio.** Un vendedor, un técnico, administración y dirección ven pantallas de arranque distintas, y cada una responde "qué hago ahora".
- **Asistido, no automático ruidoso.** El sistema propone y el usuario confirma con un toque. Posponer siempre está a un toque.
- **Nada abierto sin fecha.** Ningún interés, cotización, orden de trabajo ni factura vencida existe sin un responsable y una próxima fecha. Si no la tiene, se marca y sube al tope.
- **ZEUS es la verdad fiscal.** Lo que ZEUS emite manda. La plataforma nunca inventa un saldo: lo lee del último Excel importado y muestra la fecha de esa lectura.
- **Cifras confiables o ninguna.** Todo importe se muestra con su moneda y nunca se suman monedas distintas. Un número que no se puede defender no se muestra.

## Qué ve cada persona al abrir la app

| Rol | Bloques, por urgencia |
|---|---|
| Vendedor | Atrasados míos · Hoy (seguimientos y recompras) · Leads sin responder asignados a mí · Cotizaciones por vencer · Intereses sin fecha · botón + Interés siempre visible |
| Técnico | Mi agenda de hoy (hora, dirección, cliente, equipo) · Mañana plegado · Pendientes de cerrar (sin firma o sin fotos) · Gastos por rendir · botón "Cargar service hecho" |
| Administración | Para facturar en ZEUS (detalle listo para copiar) · Facturas vencidas según ZEUS · Services para revisar · Gastos de técnicos por aprobar · Última importación de ZEUS |
| Dirección | Pipeline abierto por moneda, ponderado por etapa · Vendido del mes vs mes anterior, por vendedor · Cobranza por antigüedad · Service: OTs por estado, pendiente de facturar, horas por técnico · Alertas (vendedor con atrasados, lead web sin responder +24 h, cotización caída) |

## Módulo comercial

Vocabulario fijo: *contacto* (persona o empresa), *interés* (algo que quiere
comprar), *venta* (un interés ganado, con su circuito de entrega). Desaparecen
de la interfaz "oportunidad", "consulta" y "lead".

- **Una sola ficha**: las herramientas de venta (guiones, diagnóstico Zumex, calculadora, IA, cotizador) viven dentro del interés, en la ficha del contacto.
- **Cotización viva**: página web de la cotización con link firmado para el cliente, registro de apertura, envío por WhatsApp. Recotizar nunca retrocede una venta ganada.
- **Asignación**: cada contacto e interés tiene vendedor responsable visible y editable. Dirección reasigna cartera en bloque desde la lista.
- **Lista de espera**: se conserva; el stock real se lee de ZEUS (Etapa 4).

## Módulo de servicio técnico

- **Agenda** semanal con una columna por técnico y franjas horarias; `fecha_programada` con hora y duración; reprogramar arrastrando.
- **Preventivos**: cada modelo define su intervalo de service; se calcula `proximo_service` y el cron propone la OT 15 días antes.
- **Garantía cruzada**: OT sobre equipo en garantía preselecciona "garantía"; al vencer, propone plan de mantenimiento.
- **Tarifa y repuestos** con valor obligatorio.
- **Cierre y cobro**: OT aprobada aparece en "para facturar"; con el Excel de ZEUS pasa sola a facturada y cobrada.
- **Gastos del técnico**: rendición semanal que aprueba administración.

## Módulo de administración

- **Bandeja "para facturar"**: ventas entregadas y services aprobados sin número de factura, con el detalle en el formato de ZEUS y botón copiar. Se limpia sola con la importación (cruce por CUIT, fecha e importe).
- **Cobranzas**: desde el Excel de ZEUS, facturas abiertas, días de atraso y antigüedad por cliente; reclamo asignado al vendedor con el WhatsApp listo; dirección ve el vencido por antigüedad.
- **Comisiones**: regla por vendedor y línea, sobre cobrado; reporte mensual exportable.
- **Gastos**: rendiciones y gastos de instalación con aprobación y exportación a Excel.
- **Fuera de alcance**: caja, bancos, IVA, libros, cuentas corrientes contables y comprobantes electrónicos. Todo eso es ZEUS.

## El puente con ZEUS

Integración de una sola dirección por Excel: pantalla "Importar de ZEUS" que
reconoce columnas, muestra qué va a cambiar y aplica.

| Exportación de ZEUS | Frecuencia | Cruce | Qué habilita |
|---|---|---|---|
| Clientes | Semanal o al alta | CUIT; si no hay, razón social normalizada | Datos fiscales correctos; sugerir el cliente de ZEUS al dar de alta |
| Facturas emitidas | Diaria | CUIT + número; a la venta: CUIT + fecha ± 3 días + importe | "Para facturar" se limpia solo; base de cobranzas |
| Cobros y saldos | Diaria | CUIT + número de factura | Vencidas, antigüedad, reclamos, comisiones, alerta al cotizar a un deudor |
| Stock por artículo | Semanal | Código ZEUS ↔ producto (tabla de equivalencias) | Stock real; reemplaza el manual |
| Artículos y precios | Cuando cambia | Código de artículo | Precios del cotizador actualizados |

Reglas del importador: idempotente (subir dos veces no duplica), transparente
(vista previa de nuevos, modificados y sin cruce; registro de quién y cuándo;
"según ZEUS al dd/mm hh:mm" en cada cifra), tolerante (columnas por nombre,
bandeja de "vincular a mano") y automatizable más adelante leyendo una carpeta
compartida.

## Modelo de datos: qué cambia

| Cambio | Para qué |
|---|---|
| `tareas.tipo` admite garantía, reclamo de cobranza, preventivo, reactivación, postventa; `tareas.prioridad` | Nuevos disparadores sin ruido (hecho en Etapa 0) |
| `cotizaciones.token_publico`, `abierta_el`, `enviada_por` | Cotización viva |
| `ordenes_trabajo.hora_programada`, `duracion_min` | Agenda por técnico |
| `productos.intervalo_service_meses`, `codigo_zeus` | Preventivos y cruce con ZEUS |
| `clientes.cuit` obligatorio para clientes activos; `codigo_zeus` | Puente con ZEUS |
| `zeus_facturas`, `zeus_cobros`, `zeus_importaciones` | Espejo de lo importado, nunca se edita a mano |
| `comisiones_reglas`, `comisiones_liquidaciones`, `rendiciones` | Administración |
| Probabilidad por etapa; importes siempre con moneda | Pipeline ponderado sin cifras mezcladas |

## Orden de construcción

Cada etapa se cierra con su definición de terminado, no con la fecha, y no se
abre la siguiente hasta que se cumple con uso real del equipo.

| Etapa | Qué | Está terminada cuando |
|---|---|---|
| 0 · Sanear y asegurar (3-4 días) | Seguridad, roles, transacciones, monedas, entorno | El cron de garantías crea tareas, el push matutino llega, y Reportes y Pipeline coinciden |
| 1 · Núcleo comercial (2 semanas) | Inicio del vendedor, seguimiento, cotización, ficha única, asignación | Un vendedor abre la app y no necesita pensar a quién llamar; ningún interés abierto sin fecha |
| 2 · Tablero de dirección (1 semana) | Inicio de dirección con pipeline ponderado por moneda, vendido del mes por vendedor, atrasados por vendedor, alertas. Reportes con filtro por vendedor, producto y período, comparación contra el período anterior, ciclo por etapa. Resumen semanal por email a dirección | El lunes a la mañana la dirección ve el estado del negocio sin abrir una planilla ni preguntarle a nadie |
| 3 · Service planificado (2 semanas) | Agenda por técnico, inicio del técnico, preventivos, garantía cruzada, tarifa obligatoria, rendición de gastos, bloque de service en dirección | Las OTs semanales se asignan en la agenda sin coordinar por WhatsApp; ningún equipo pasa su fecha de service sin propuesta de OT |
| 4 · Administración y ZEUS (3 semanas) | Importador, "para facturar", cobranzas, comisiones, inicio de administración, cobranza en dirección, fin del stock manual | Administración factura sin retipear; toda factura vencida tiene responsable; la comisión se calcula sola |
| 5 · Lo que suma (a definir) | Métricas de marketing, WhatsApp bidireccional, lectura automática de ZEUS, importaciones | Cada uno con su definición de terminado |

## Qué se poda

Nada se borra de la base; se saca del camino. HOTELGA, financiación,
calculadora, catálogo, biblioteca, etiquetas e inspecciones pasan a "Más". El
kanban de instalaciones separado sale de la interfaz (la instalación es una OT).

## Riesgos y cómo se cubren

- **Volver a amputar**: el equipo se queja del ruido y se apagan los avisos. Cobertura: una sola próxima fecha por interés, posponer a un toque, medir dos semanas antes de cambiar reglas.
- **Importación que nadie hace**: fecha de la última importación visible en todos los inicios y alerta a dirección a los 3 días.
- **Cruce sin CUIT**: CUIT obligatorio al pasar a cliente y bandeja de sin cruce.
- **Supabase gratuito**: se pausa por inactividad. Plan Pro (USD 25/mes) antes de la Etapa 4.
- **Todo en un archivo**: `lib/actions.ts` se partió por módulo en la Etapa 1.

## Cómo se ejecuta con Claude Code

Cada etapa se convierte en una especificación propia (pantallas, reglas, datos,
definición de terminado) en `docs/etapas/`. Se trabaja una etapa por vez, en
una rama `etapa-N`, con un commit por punto.

## Decisiones registradas después del plan

- **Etapa 1 simplificada (11 sept 2026):** la dirección reemplazó la versión "que empuja" por "núcleo comercial simple": no hay motor de tareas para ventas; cada interés tiene una sola próxima fecha y los pendientes se calculan desde ahí (migración 026). Especificación en `docs/etapas/ETAPA-1-nucleo-comercial.md`.
- **Stock (Etapa 4):** el stock pasa a leerse del Excel de ZEUS y la pantalla `/stock` deja de editarse a mano. Hasta entonces la mantiene administración: cantidades, ingresos previstos y el botón "Llegó", que es la única automatización del módulo comercial (los intereses en lista de espera de ese producto pasan a "Hoy" con la nota "Llegó stock").
- **Descuento de stock:** al pasar una venta a Entregado se descuenta 1 del producto (RPC `fn_ajustar_stock`, migración 026); si se vuelve atrás, se suma. Los ajustes manuales siguen siendo de gestores.
- **Rediseño de pantallas (20 sept 2026):** Franco rechazó la interfaz de la Etapa 1 tal como estaba escrita ("pestañas y demás") y aprobó una propuesta nueva: el embudo como pantalla principal con información desplegable, PC completa (barra lateral, resumen, embudo y ficha al costado), color por etapa, ficha como un chat y alta en una sola pantalla. El modelo de datos y las reglas de la Etapa 1 se mantienen. Propuesta aprobada: https://claude.ai/artifact/3M2iiB5wxC1dgf8rRxwfDh.
- **Inicio de dirección (Etapa 2):** como Franco eligió el embudo como pantalla principal, el tablero de dirección no lo reemplaza: es una pantalla propia ("Tablero"), segunda en la barra, y llega por email los lunes.
- **Modelo operativo por puestos (27 sept 2026, arranca en octubre):** con el "Manual e instructivo por áreas" y las "Hojas de responsabilidades" v2, la dirección pidió rehacer el CRM para que la empresa funcione así desde octubre. Se implementó en la rama `octubre` (migración 028 y bloques O.2 a O.13): puestos en vez de roles genéricos (se agregan administrativa y responsable de servicio), territorios con responsable y ruteo por lugar de entrega, primer contacto medido, cadencia de propuesta 1-3-7-14-30-60, aprobación de dirección para todo lo fuera de lista, circuito de venta con factura y cobro antes de preparar, cobranzas, casos de postventa con plazos, remito obligatorio y control del remito, técnicos aliados, cobro previo fuera de garantía, acta de instalación, informe comercial de los lunes, pedidos a marketing, videos por modelo y "Mi día" por puesto. Reemplaza la regla de "cero recordatorios automáticos" solo donde el manual la pide (postventa 2-10-30 al entregar y recontacto de consumibles a la administrativa). Detalle en `docs/MODELO-OPERATIVO.md`; uso por puesto en `docs/GUIA-POR-PUESTO.md`; arranque en `docs/ARRANQUE-OCTUBRE.md`.
