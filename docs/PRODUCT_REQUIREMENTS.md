# Requerimientos de producto — GastroWare OS

> Fuente: especificación de dirección (2026-08-03) + decisiones tomadas.
> Este documento resume QUÉ debe hacer el sistema. El CÓMO está en TARGET_ARCHITECTURE.md.

## Visión

Plataforma interna única ("sistema operativo de GastroWare") que integra clientes,
ventas, marketing, equipos instalados con números de serie, servicio técnico,
administración e inteligencia artificial. Hasta 10 usuarios iniciales, preparada
para crecer. Español, fechas argentinas, zona horaria America/Argentina/Buenos_Aires,
ARS y USD.

## Prioridad

**Primera entrega excelente: SERVICIO TÉCNICO + EQUIPOS + NÚMEROS DE SERIE.**
CRM/marketing/integraciones/IA se diseñan desde el inicio, se implementan por etapas.

## Roles y acceso

| Rol | Acceso |
|---|---|
| Dirección | Ve y modifica todo |
| Administración | Operación completa, facturación, configuración; sin gestión de roles de dirección |
| Comercial | Solo sus clientes y oportunidades asignados (o sin dueño), salvo autorización |
| Marketing | Segmentos, campañas, plantillas; lectura de clientes sin datos comerciales sensibles |
| Técnico | Solo servicios y equipos asignados, y los clientes vinculados a ellos |
| Distribuidor | Solo su propia cartera, equipos y operaciones (modelado ya, acceso se activa después) |

Toda operación sensible queda en auditoría inmutable (quién, qué, cuándo, diff).

## Módulos (resumen de alcance)

### Clientes 360
Razón social, nombre comercial, CUIT, condición fiscal, contactos, sucursales,
responsable comercial, segmento/etiquetas, distribuidor, historial de comunicaciones,
formularios web, oportunidades y cotizaciones, equipos, servicios, documentos,
tareas, campañas recibidas, consentimientos, línea de tiempo unificada.
Resumen ejecutivo con riesgos/oportunidades/próxima acción (por reglas hasta tener
API de IA; ver AI_AND_INTEGRATIONS.md). Detección de duplicados con unificación
PROPUESTA, nunca automática.

### Equipos y números de serie
Marca, modelo, serie ÚNICA validada, cliente, sucursal y ubicación, fechas de venta
e instalación, estado, garantía con vencimiento, comercial, distribuidor, fotos,
documentos (facturas/remitos/manuales), configuración técnica, accesorios, repuestos
usados, historial completo de servicios, observaciones, QR único que abre la ficha
desde el teléfono (con autenticación y permisos). Desde el equipo: crear ticket
precargado. Línea de tiempo inalterable.

### Servicio técnico
16 estados configurables y auditados (solicitud_recibida → … → cerrado / cancelado;
lista completa en DATA_MODEL.md). Ticket con número único, cliente y sucursal,
equipo/serie, tipo de problema, descripción, prioridad, técnico, fechas, cobertura
(garantía/contrato/facturable), archivos, comentarios, repuestos, gastos, horas,
datos de facturación, responsable administrativo, historial de cambios.

Técnico (móvil, online-first — offline descartado por decisión): agenda ordenable,
ficha de cliente/equipo, escaneo de QR, cronómetro iniciar/pausar/finalizar + carga
manual justificada, diagnóstico, trabajo realizado, checklists por modelo, fotos
antes/después, repuestos con estado (facturable/garantía/sin cargo), gastos con
comprobante, kilometraje/viáticos si se habilita, pedir repuesto o segunda visita,
firma y conformidad del cliente, informe técnico profesional. No se puede finalizar
con campos obligatorios vacíos salvo excepción autorizada y auditada.

Administración: bandeja de revisión, ver todo lo cargado, devolver al técnico CON
observación, aprobar para facturar, marcar refacturables ítem por ítem, precios
administrativos, nro de factura, informe final descargable, cierre administrativo
(distinto del cierre técnico), pendientes de facturación y de refacturación.

### Repuestos
Catálogo con código interno, código de fabricante, descripción, marca, modelos
compatibles, costo, precio, moneda, stock (modular, apagado por defecto), ubicación,
fotos, trazabilidad de dónde se usó, garantía del repuesto, estados.

### CRM y ventas
Lo existente + cotizaciones con versiones y comparación, embudo configurable,
relación venta→equipo→serie→instalación, próxima acción obligatoria (ya existe).

### Integraciones (adaptadores, sin acople a proveedor)
Formularios web (endpoint seguro + antispam → lead + tarea), email corporativo
(adaptador; Resend recomendado), WhatsApp Business exclusivamente por API oficial
de Meta (webhooks; sin scraping; sin promesa de histórico). Detalle y límites en
AI_AND_INTEGRATIONS.md.

### Marketing
Segmentación dinámica (equipos por marca, garantías por vencer, sin contacto en X
meses, sin mantenimiento, perdidas recuperables, por distribuidor…), plantillas,
campañas con calendario, automáticas de posventa/mantenimiento/garantía, métricas,
consentimiento y baja con exclusión automática.

### Asistente IA
Con permisos aplicados ANTES de recuperar información, citas de fuente, sin invento
de series/precios/diagnósticos, salidas validadas por esquema, acciones siempre con
vista previa y aprobación, límites de uso y costo, registro completo. Base de
conocimiento (manuales, fichas, precios, informes, procedimientos) con recuperación
selectiva. Bloqueado hasta contar con API key (decisión de dirección).

## Experiencia de usuario

Dashboards por rol que respondan: qué requiere mi atención, qué está demorado, qué
hago hoy, qué necesita aprobación, qué es riesgo, cuál es el siguiente paso.
Buscador global, filtros persistentes, tablas rápidas, vistas 360, centro de
notificaciones, bandeja de aprobaciones, estados de carga/vacío/error, validación
clara, confirmaciones en acciones sensibles, responsive, accesibilidad básica,
excelente en teléfono para técnicos, export PDF/Excel donde aplique. Sin dashboards
decorativos.

## Criterios de aceptación de la primera entrega (20)

1. Crear cliente con sucursal y contactos. 2. Registrar equipo con serie única,
fotos, garantía y documentación. 3. Generar y escanear su QR. 4. Crear ticket desde
cliente o equipo. 5. Asignarlo a un técnico. 6. Verlo bien desde un teléfono.
7. Registrar tiempo trabajado. 8. Cargar diagnóstico, trabajo, fotos, repuestos y
gastos. 9. Firma del cliente. 10. Finalizar técnicamente. 11. Revisar desde
administración. 12. Devolver al técnico si falta información. 13. Aprobar para
facturar. 14. Identificar refacturables. 15. Informe profesional. 16. Historial
completo desde la ficha del equipo. 17. Ver quién hizo cada modificación. 18. Un
usuario sin permisos NO accede al registro. 19. Tests, lint y build verdes.
20. Sin errores visibles ni botones simulados.
