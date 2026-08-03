# Plan v2 — De CRM de ventas a sistema operativo GastroWare

> Ampliación definida con Franco (20 jul 2026). Se suma a lo ya construido
> (ventas, cartera, recompras, marketing básico de plantillas).

## Decisiones tomadas (respuestas de Franco)

| Tema | Decisión |
|---|---|
| Equipos ajenos | Sí, muchos: el alta de equipo es libre (marca/modelo/serie), con o sin venta asociada |
| Facturación | En ZEUS ERP. El CRM arma el detalle y el estado "facturable"; admin factura en ZEUS y registra el número |
| Técnicos | 2-3, con rol propio y app mobile. Órdenes las crea admin o el propio técnico |
| Cierre de OT | Horas + refacciones + fotos + gastos con ticket (refacturables) + firma del cliente en pantalla |
| Tarifa | Única por hora, configurable |
| Refacciones | Catálogo con precio para elegir rápido + línea de texto libre con precio manual |
| Garantías | Por producto, en años: Zumex 5, licuadoras 1, resto configurable |
| Preventivos | Todavía no está armado — se deja el campo "próximo service" por equipo, sin forzar |
| Volumen | ~20 services/semana → agenda por técnico y por día |
| Email masivo | Remitente info@gastroware.com.ar (verificar dominio en el proveedor de envío) |
| Cliente dormido | 6 meses sin actividad (configurable) |

## Módulos y orden de construcción

### Módulo 1 — Equipos con número de serie (EN CURSO)
- `equipos_instalados` gana: `numero_serie`, `marca_modelo` (texto libre para
  equipos ajenos), `origen` (vendido/externo), `garantia_hasta`.
- `productos` gana `garantia_meses` (Zumex 60, licuadoras 12). Al cargar o
  ganar una venta, la garantía se calcula sola desde la fecha de compra.
- Buscador global también encuentra por número de serie.
- Ficha de cliente muestra serie y estado de garantía (vigente/vencida).

### Módulo 2 — Servicio técnico (órdenes de trabajo)
- Tablas: `ordenes_trabajo` (numeradas OT-1, OT-2…), `ot_items`
  (refacciones y gastos, con comprobante_url para la foto del ticket),
  `ot_fotos`, `config` (tarifa_hora).
- Estados: abierta → en_proceso → cerrada_tecnico → facturable → facturada
  (+ anulada). `es_garantia` marca los services sin cargo.
- Rol nuevo `tecnico`: ve su agenda del día, sus OTs; puede crearse una OT.
- App del técnico (mobile): ver agenda → abrir OT → cargar trabajo realizado,
  horas, refacciones (de catálogo o texto libre), fotos, gastos con foto del
  ticket → firma del cliente en canvas → cerrar.
- Comprobante de service: página imprimible/PDF con el detalle y la firma.
- Agenda: vista por día y por técnico (admin asigna, ~20 OTs/semana).

### Módulo 3 — Circuito administrativo
- Bandeja "Para revisar" (cerradas por técnico) → admin ajusta si hace falta →
  "Facturable" con total calculado (tarifa × horas + refacciones + gastos
  refacturables; $0 si es garantía) → factura en ZEUS → carga nro de factura →
  "Facturada". Nada se pierde: contadores en la home de admin.

### Módulo 4 — Marketing
- Segmentos guardados: por rubro, equipo/marca, zona, dormidos (>6 meses sin
  actividad), garantía por vencer (60 días antes).
- Campañas WhatsApp: elegís segmento + plantilla → lista de "para contactar
  hoy" uno por uno con el mensaje listo (mismo patrón que Hoy).
- Email masivo con Resend + dominio gastroware.com.ar verificado
  (requiere agregar registros DNS — paso de Franco).
- Automáticos: reactivación de dormidos y aviso de garantía por vencer
  entran al cron diario existente.

## Roles finales

| Rol | Ve |
|---|---|
| admin | Todo + bandeja de facturación + configuración |
| vendedor | Hoy propio, sus clientes/oportunidades, biblioteca, calculadora |
| tecnico | Su agenda de OTs, equipos, y alta de OT |

## Notas técnicas
- Migración `003_servicio.sql`: todo el DDL de módulos 1-3 junto (una sola
  pasada por el SQL Editor).
- Bucket `servicio` en Storage para fotos, firmas y tickets.
- La firma se captura en un `<canvas>` y se sube como PNG.
- ZEUS queda como sistema de facturación: el CRM nunca emite comprobantes
  fiscales, solo prepara el detalle y guarda el número de factura.
