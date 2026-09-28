# Cambios de GastroWare OS

La lista para el equipo está en la pantalla Novedades (`lib/novedades.ts`).
Cómo se versiona: `docs/VERSIONES.md`.

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
