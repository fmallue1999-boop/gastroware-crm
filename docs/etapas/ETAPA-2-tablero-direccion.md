# Etapa 2 — Tablero de dirección

> Especificación escrita a partir del plan maestro (`docs/PLAN-OS.md`, Etapa 2)
> y del estado real del sistema después de la Etapa 1 y el rediseño "embudo +
> chat". Rama `etapa-2`. Un commit por punto.

## Objetivo (del plan)

Inicio de dirección con pipeline ponderado por moneda, vendido del mes por
vendedor, atrasados por vendedor y alertas. Reportes con filtro por vendedor,
producto y período, comparación contra el período anterior y ciclo por etapa.
Resumen semanal por email a dirección.

**Está terminada cuando** el lunes a la mañana la dirección ve el estado del
negocio sin abrir una planilla ni preguntarle a nadie.

## Decisiones de adaptación

- Franco eligió el **embudo** como pantalla principal. El tablero no lo
  reemplaza: es una pantalla propia, **Tablero** (`/tablero`), segunda en la
  barra lateral para dirección y administración, y dentro de "Más" en el
  celular. `/reportes` redirige al tablero.
- Vocabulario de la interfaz: "atrasados" (no "vencidos"), "intereses" (no
  "pipeline" ni "leads").
- Filtros como desplegables, no chips: período, vendedor y producto.
- El resumen semanal sale del cron diario que ya existe (los lunes), sin sumar
  un cron nuevo: el plan de Vercel limita la cantidad de crons.

## 2.1 Push matutino con el modelo nuevo (arreglo de la Etapa 1)

El cron `/api/cron/resumen` todavía cuenta tareas manuales, que desde la
migración 026 ya no existen para ventas: el push nunca saldría. Pasa a contar,
por vendedor, los intereses abiertos con `proximo_contacto <= hoy` (atrasados y
de hoy) más sus avisos de recompra, y abre `/hoy`.

## 2.2 Consultas web con fecha (migración 027)

`fn_lead_web` crea el interés sin próxima fecha y le agrega una tarea vieja, así
que la consulta web no aparece en Hoy. Pasa a crear el interés con
`proximo_contacto = hoy` y nota "Responder consulta web", sin tarea, y la
notificación apunta a la ficha. Requiere aplicar la migración 027.

## 2.3 Cálculos del tablero (`lib/tablero.ts`)

Funciones puras y probadas, que usan tanto la pantalla como el email:

- **Períodos**: este mes, mes pasado, últimos 3 meses, este año, semana pasada.
  El anterior se compara "al mismo día" cuando el período está en curso.
- **Probabilidad por etapa** (`PROBABILIDAD_ETAPA`): Interesado 10 %, Cotizado
  30 %, En seguimiento 50 %, Lista de espera 70 %. Intereses abiertos
  ponderados = monto cotizado × probabilidad, siempre por moneda.
- **Por vendedor**: contactos atendidos (movimientos propios), intereses
  abiertos, atrasados (y el más viejo), quietos (sin fecha y sin movimiento hace
  más de 7 días), cotizaciones y monto, ventas y monto, contra el período
  anterior. "Sin asignar" es una fila más.
- **Alertas**: vendedor con atrasados; consulta sin responder hace más de 24 h
  (interés nuevo sin ningún movimiento de una persona); cotización caída (se
  venció la vigencia y no hubo movimiento después); hay stock y alguien espera
  ese producto.
- **Reportes del período**: embudo de los intereses creados (cuántos se
  cotizaron, vendieron, no se dieron, siguen abiertos), por producto, por
  origen, motivos de "no se dio", ciclo por etapa (días de interés a
  cotización, de cotización a venta, total; sin contar ventas directas).

## 2.4 Pantalla Tablero

Solo dirección y administración. De arriba a abajo:

1. Filtros: período, vendedor, producto.
2. **Cómo está el negocio**: intereses abiertos (monto y ponderado por moneda,
   cuántos sin cotizar), vendido en el período contra el anterior, atrasados,
   tasa de cierre.
3. **Alertas**, cada una con su lista.
4. **Por vendedor**: tabla en PC, tarjetas en el celular. Cada número abre la
   lista de esos contactos, con la ficha al costado en PC.
5. **Reportes del período**: embudo, ciclo por etapa, por producto, por origen,
   motivos de "no se dio".

## 2.5 Resumen semanal por email

Los lunes, el cron diario manda a cada usuario activo con rol dirección un email
con la semana pasada contra la anterior (vendido, intereses nuevos,
cotizaciones, no se dieron), el estado actual (intereses abiertos, atrasados),
la tabla por vendedor, las alertas y el link al tablero. `?semanal=vista` en el
cron devuelve el HTML sin enviar, para revisarlo.

## Definición de terminado

- [ ] Dirección abre Tablero y ve, sin preguntar a nadie: cuánto hay abierto
      (y ponderado) por moneda, cuánto se vendió en el mes contra el anterior,
      quién tiene atrasados y qué alertas hay.
- [ ] Los filtros de período, vendedor y producto cambian todos los números.
- [ ] Cada número de la tabla por vendedor abre la lista de esos contactos.
- [ ] El lunes a la mañana llega el resumen por email a dirección.
- [ ] El push matutino le llega a un vendedor con intereses para hoy.
- [ ] Una consulta del formulario web aparece en Hoy el mismo día.
