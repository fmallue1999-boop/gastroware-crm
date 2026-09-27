# Modelo operativo desde octubre 2026 — el CRM por puestos

> Fuente: "Manual e instructivo por áreas" y "Hojas de responsabilidades",
> versión 2 del 25 de septiembre de 2026 (Dirección). Este documento traduce
> esas definiciones a lo que el CRM tiene que hacer. No usa nombres de
> personas: todo se define por **puesto**. Cada usuario del CRM tiene un puesto
> y, si vende, un territorio. Cuando alguien entra, sale o cambia de puesto, se
> cambia en Administración y el CRM se reacomoda solo.

## 1. Diagnóstico: por qué hoy no funciona

El CRM se construyó alrededor de "contactos y seguimientos" para un equipo sin
puestos definidos. El manual define otra cosa: **cadenas** donde cada paso
tiene un dueño (el contacto lo carga y asigna la administrativa, lo trabaja el
vendedor del territorio, lo factura y cobra la administrativa, lo prepara el
técnico, lo controla la dirección de administración). Hoy el CRM:

- no sabe qué puesto tiene cada persona (hay una administrativa cargada como
  "dirección", y no existen la dirección de administración ni el responsable de
  servicio técnico como puestos);
- no asigna por territorio ni mide el primer contacto dentro de la hora;
- deja enviar cualquier cotización, sin la aprobación de dirección fuera de lista;
- ordena la venta como vendido → preparar → facturar → entregado, cuando la regla
  es **facturar y cobrar antes de preparar y despachar**;
- no tiene casos de postventa (reclamos) con plazo de respuesta y cierre;
- no obliga a que cada trabajo técnico termine con remito firmado y foto, ni
  tiene el control del remito antes de facturar;
- no tiene cobranzas, ni recontacto de consumibles a cargo de la administrativa;
- muestra a todos el mismo inicio.

## 2. Reglas que aplican a todos (y cómo las hace cumplir el CRM)

| Regla del manual | Qué hace el CRM |
|---|---|
| Todo contacto entra por la administrativa y se asigna por lugar de entrega. Primer contacto dentro de la hora. | El alta pide "¿dónde se entrega?", asigna al responsable del territorio, le avisa y cuenta el tiempo hasta su primer movimiento. |
| Toda cotización fuera de lista pasa por dirección antes de presentarse. | Si hay descuento sobre lista o condición especial, la cotización queda "esperando aprobación": no se puede imprimir ni mandar hasta que dirección la aprueba en el CRM. |
| Nada se despacha sin factura y cobro acreditado (o condición aprobada). | La venta no pasa a "preparar" sin factura cargada y cobro registrado o condición aprobada por dirección de administración. |
| Ningún trabajo técnico termina sin remito firmado y foto. | El técnico no puede cerrar un trabajo sin foto del remito firmado y foto del equipo funcionando. |
| El CRM es la fuente única: contactos, propuestas, movimientos, casos y remitos, el mismo día. | Todo lo anterior deja movimiento en la ficha del contacto. |
| Un solo jefe directo por persona. | Cada puesto tiene su inicio con lo suyo; dirección ve todo. |

## 3. Los puestos en el CRM

| Puesto | En el CRM | Qué ve al abrir ("mi día") |
|---|---|---|
| Dirección general | `direccion` | Aprobaciones fuera de lista (el mismo día), informes comerciales de los lunes, tablero; y, mientras la venta del interior esté vacante, el día del vendedor de ese territorio. |
| Dirección de administración, finanzas y operaciones | `admin` | Remitos por controlar, equipos parados sin técnico, casos fuera de zona para asignar aliado, garantías con fábrica, cobranza vencida y promesas, cruce de remitos contra facturas, tablero mensual. |
| Administrativa y atención comercial | `administrativa` (nuevo) | Consultas por cargar y asignar, ventas para facturar, cobros por registrar, pedidos para preparar (con prioridad) y despachar, remitos para facturar, cobranzas del día (vencidos, hoy, 48 h), recontactos de consumibles, lista de espera. |
| Vendedor de territorio (gerencia comercial CABA y AMBA; vendedor Mar del Plata, costa e interior) | `comercial` + territorio | Consultas sin primer contacto, casos de postventa, seguimientos de propuestas (1-3-7), postventa del día (días 2, 10 y 30), cuentas sin contacto este mes, actividad de la semana contra la meta. |
| Técnico de servicio y depósito | `tecnico` | Trabajos por prioridad (parado, anda mal, a pedido) con plazo de 5 días hábiles, instalaciones (no sale sin relevamiento), remitos devueltos, trabajos esperando cobro, qué preparar hoy en depósito, repuestos bajo mínimo. Un botón: "Cargar trabajo hecho". |
| Responsable de servicio técnico (vacante) | `servicio` (nuevo) | Lo técnico del inicio de dirección de administración. Mientras esté vacante, lo ve dirección de administración. |
| Marketing y contenido | `marketing` | Pedidos de material de comercial, modelos sin video instructivo, consultas por canal del mes. |
| Técnicos aliados (terceros) | Sin usuario: ficha con zona, contacto y tarifa | Se asignan a trabajos fuera de Mar del Plata. |

**Territorios**: "CABA y AMBA" y "Mar del Plata, costa e interior". Cada uno
tiene un responsable (un usuario). Si el puesto está vacante, el responsable
es dirección general. El lugar de entrega decide el territorio.

## 4. Cadenas y pantallas

### 4.1 Venta de equipos (12 pasos)

1–2. **Consulta** → la administrativa (o el vendedor, si le entra directo) la
carga con "¿dónde se entrega?"; el CRM asigna al responsable del territorio, le
avisa y deja la fecha de hoy. Lead de otro territorio: "No es de mi territorio"
la reasigna.
3. **Trabajar la venta**: calificar (rubro, lugar de entrega, equipo, cantidad,
plazo, quién decide), ver stock, lista de espera si no hay, propuesta con
plantilla. Fuera de lista → pide aprobación. Seguimiento 1-3-7 días; sin
respuesta a los 14, recontacto a 30 y 60. Lead sin respuesta: dos reintentos
en 48 h y pasa a "en espera" con fecha.
4. **Informar la venta**: "Vendido" pide forma de pago, dirección de entrega,
datos de facturación y si lleva instalación (con el relevamiento del lugar).
Avisa a la administrativa.
5–10. **Circuito administrativo**: facturar (número, fecha, vencimiento,
monto) → registrar cobro o condición aprobada → preparar (remito, prioridad del
día; aparece en el depósito del técnico) → despachar (transporte, seguimiento,
videos del modelo) → entregado.
11–12. **Postventa**: el CRM agenda día 10 (toda venta) y días 2 y 30 (con
instalación) al vendedor; después, contacto mensual por cuenta.

### 4.2 Consumibles y repuestos (recompra)

Al facturar un consumible se agenda el recontacto a los días definidos para
ese producto, a cargo de la administrativa, con el mensaje tipo. Cuenta para
el vendedor dueño de la cuenta.

### 4.3 Postventa y servicio técnico

- **Caso** (reclamo): lo carga quien lo recibe; responsable, el vendedor dueño
  de la cuenta. Prioridad parado / anda mal / consulta. Primera respuesta en 24
  h hábiles (1 h si está parado). Primer nivel a distancia; si excede,
  **derivar a servicio técnico** (crea el trabajo técnico). Cierre en 5 días
  hábiles con causa y solución. Parado sin técnico en 24 h → alerta a
  dirección de administración.
- **Zona**: Mar del Plata y zona, el técnico; fuera, dirección de
  administración asigna un aliado.
- **Fuera de garantía**: presupuesto → aprobación del cliente → factura y
  cobro **antes** de ir o despachar el repuesto (el técnico ve "esperando
  cobro").
- **Remito**: todo trabajo termina con remito (cliente, local/razón social,
  equipo y serie, qué se hizo, repuestos, tiempo, se cobra o garantía, número
  de remito en papel) + foto del remito firmado + foto del equipo andando.
- **Control**: dirección de administración aprueba el remito ("para
  facturar") o lo devuelve con observación. La administrativa lo factura al
  día siguiente, a la razón social del local si la cuenta tiene varias.
- **Garantía**: no se factura al cliente; el reclamo a fábrica se sigue hasta
  el cierre.
- **Instalación**: no se programa sin el relevamiento del lugar; se cierra
  con acta (persona capacitada, fecha de inicio de garantía, foto) y la
  garantía del equipo empieza ese día.
- **Repuestos críticos**: cada repuesto tiene mínimo; los viernes el técnico ve
  los que están en el mínimo y pide reposición.

### 4.4 Administración

- **Cobranzas**: facturas del CRM (ventas y service) con vencimiento; vencidas,
  vencen hoy, vencen en 48 h; estado pagó / prometió (fecha) / sin respuesta.
  Cliente con atraso mayor al definido → la venta nueva no se despacha.
- Pagos, caja, flujo de fondos, contabilidad, nómina: siguen fuera del CRM
  (sistema de gestión y estudio), como dice el plan maestro.

### 4.5 Dirección

- **Aprobaciones fuera de lista**: bandeja con un toque para aprobar o
  rechazar, con nota.
- **Informe comercial semanal**: cada vendedor lo envía los lunes antes de las
  10; el CRM completa los números (intereses por etapa, cierres, casos abiertos,
  actividad) y el vendedor agrega bloqueos, decisiones requeridas y agenda.
  Dirección responde las decisiones.
- **Tablero** (Etapa 2) + ventas por marca y territorio, remitos hechos contra
  facturados, consultas por canal y primer contacto.

### 4.6 Marketing

- **Pedidos de material**: comercial y dirección piden; marketing los ve con
  fecha y los marca entregados.
- **Videos por modelo**: cada producto tiene su link de video instructivo; la
  administrativa lo manda con el despacho.

## 5. Lo que el manual deja "a definir" (el CRM lo tiene como ajuste)

Administración → Reglas, editable por dirección: días de atraso que frenan un
despacho, descuento que puede dar un vendedor sin consultar (0 % hasta que se
defina la matriz), días de recontacto por consumible (en cada producto), plazo
de pago a aliados (informativo). Seguimiento de venta 10 días para todas y 2 y
30 con instalación: se aplica lo propuesto.

## 6. Arranque "desde cero" en octubre

Los contactos y el historial se conservan. Lo que se pone en cero es el
trabajo abierto que no refleja la realidad (intereses viejos sin movimiento,
usuarios de prueba) y la asignación: cada usuario recibe su puesto y cada
territorio su responsable. Eso se hace con confirmación de dirección, no solo.

## 7. Cómo quedó en el CRM (rama `octubre`)

| Regla o cadena | Dónde está |
|---|---|
| Puestos, territorios, reglas | Administración → Equipo (puesto, territorio, teléfono), Territorios, Reglas. `lib/puestos.ts`, `lib/territorios.ts` |
| Consulta por lugar de entrega y primer contacto | Nueva consulta ("¿Dónde se entrega?"), ficha (asignar / no es de mi territorio / sin primer contacto), trigger `fn_toca_interes` (028) |
| Cadencia 1-3-7-14-30-60 y "no respondió" | Tarjeta del interés en la ficha. `lib/cadencia.ts` |
| Fuera de lista pasa por dirección | Cotizador marca "esperando aprobación"; no se imprime; `/aprobaciones`. `lib/propuestas.ts` |
| Informar la venta, facturar, cobrar, preparar, despachar, entregar | Ficha y `/pedidos` (un botón por paso según el puesto). `lib/ventas.ts`, `lib/actions/ventas.ts`, `lib/servidor/ventas.ts` |
| Nada se despacha sin cobro o condición; el atraso frena | `liberarVenta` + regla "días de atraso"; condición en Cobranzas o en la venta |
| Postventa 2-10-30 | Al confirmar la entrega (tareas de postventa en Mi día del vendedor) |
| Cobranzas | `/cobranzas`. `lib/cobranzas.ts` |
| Casos de postventa | `/casos`, ficha. `lib/casos.ts` |
| Remito obligatorio, control, facturar remito, aliados, cobro previo, garantía, acta | Service (`/servicio/[id]`): panel de servicio técnico y remito; "Cargar service hecho" |
| Informe comercial de los lunes | `/informe` (vendedor), `/informes` (dirección) |
| Pedidos a marketing, videos por modelo | `/marketing/pedidos`, `/marketing/videos` |
| Mi día por puesto | `/hoy`. `lib/servidor/midia.ts` |
| Tablero con la operación | `/tablero` (primer contacto, remitos, casos, cobranza, ventas por territorio) |

Uso por puesto: `docs/GUIA-POR-PUESTO.md`. Arranque: `docs/ARRANQUE-OCTUBRE.md`.
