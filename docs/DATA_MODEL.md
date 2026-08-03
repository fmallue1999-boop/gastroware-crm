# Modelo de datos — GastroWare OS

> Migración `004_os_fundacion.sql` parte de base limpia (datos previos descartables,
> confirmado por dirección). Convención: tablas y columnas en español, snake_case,
> UUID pk, `creado`/`deleted_at` timestamptz, FKs con índices.

## Núcleo

- **usuarios** (id = auth.users.id): nombre, rol `direccion|admin|comercial|marketing|tecnico|distribuidor`, distribuidor_id?, activo.
- **distribuidores**: nombre, cuit?, contacto, activo. (Acceso de usuarios distribuidor se activa en etapa posterior; el aislamiento ya queda modelado.)
- **clientes**: razon_social?, nombre_comercial, cuit? (UNIQUE parcial where not null), condicion_fiscal? (`RI|Monotributo|Exento|CF`), rubro, telefono (normalizado), email?, instagram_web?, estado, potencial?, comercial_id→usuarios, distribuidor_id?, notas, deleted_at.
- **sucursales**: cliente_id, nombre, direccion, ciudad, provincia, telefono?, es_principal.
- **contactos**: cliente_id, sucursal_id?, nombre, cargo?, telefono?, email?, es_decisor, consentimiento_email bool, consentimiento_whatsapp bool, baja_at?.
- **etiquetas** + **cliente_etiquetas** (M2M).
- **documentos** (polimórfico): entidad `cliente|equipo|orden|oportunidad|repuesto`, entidad_id, tipo `factura|remito|manual|contrato|otro`, nombre, path (storage privado), subido_por, creado.
- **notificaciones**: usuario_id, tipo, titulo, cuerpo, url, leida_at.
- **aprobaciones**: tipo (`excepcion_cierre_ot|unificacion_clientes|...`), entidad, entidad_id, solicitante, aprobador?, estado `pendiente|aprobada|rechazada`, detalle jsonb.
- **audit_log**: tabla, registro_id, accion `INSERT|UPDATE|DELETE`, usuario_id, diff jsonb, creado. Sin update/delete (inmutable). Poblada por trigger genérico.
- **config** (existente): clave/valor.
- **outbox**: tipo, payload jsonb, clave_idempotencia UNIQUE, intentos, estado, ultimo_error, creado, procesado_at.

## Equipos y repuestos

- **modelos**: marca, nombre, categoria, garantia_meses?, checklist_plantilla_id?. (Separa el catálogo técnico del comercial `productos`; un producto puede referenciar un modelo.)
- **equipos** (ex equipos_instalados): cliente_id, sucursal_id?, modelo_id? | marca_modelo_libre?, numero_serie (UNIQUE parcial where not null), origen `vendido|externo`, estado `activo|en_reparacion|baja`, fecha_venta?, fecha_instalacion?, garantia_hasta?, comercial_id?, distribuidor_id?, config jsonb, observaciones, oportunidad_id?, deleted_at.
- **equipo_fotos**: equipo_id, path, creado.
- **repuestos**: codigo_interno UNIQUE, codigo_fabricante?, descripcion, marca?, costo?, precio?, moneda, stock? (nullable = sin control), ubicacion?, garantia_meses?, activo.
- **repuesto_modelos** (M2M compatibilidad).
- **recurrencias** (existente, FK a productos consumibles).

## Servicio técnico

- **ot_estados**: codigo, nombre, orden, es_final, grupo (`tecnico|admin`). Seed (16):
  `solicitud_recibida, pendiente_revision, pendiente_asignacion, programado, asignado,
  en_camino, en_proceso, esperando_repuesto, esperando_cliente, finalizado_tecnico,
  revision_admin, devuelto_tecnico, aprobado_facturar, facturado, cerrado, cancelado`.
- **ot_transiciones**: desde, hacia, requiere_rol (`tecnico|admin|direccion|cualquiera`).
- **ordenes_trabajo**: numero identity, cliente_id, sucursal_id?, equipo_id?, tecnico_id?, creado_por, estado→ot_estados, prioridad `baja|normal|alta|urgente`, tipo `correctivo|preventivo|instalacion|garantia`, tipo_problema?, es_garantia, cobertura `garantia|contrato|facturable`, fecha_solicitada?, fecha_programada?, problema, diagnostico?, trabajo_realizado?, firma_path?, firmante?, total?, nro_factura?, facturada_at?, admin_id?, observacion_admin?, deleted_at, creado, cerrada_tecnico_at?, cerrada_admin_at?.
- **status_history**: ot_id, desde, hacia, usuario_id, observacion?, creado.
- **ot_tiempos**: ot_id, tecnico_id, inicio, fin?, minutos (calculado o manual), manual bool, justificacion? (obligatoria si manual).
- **ot_items**: ot_id, tipo `refaccion|gasto`, repuesto_id?, descripcion, cantidad, costo_unit?, precio_unit, estado `facturable|garantia|cortesia|pendiente`, comprobante_path?, aprobado_admin bool.
- **ot_fotos**: ot_id, momento `antes|despues|otro`, path.
- **ot_comentarios**: ot_id, usuario_id, texto, creado.
- **checklist_plantillas**: nombre, modelo_id?, items jsonb [{texto, obligatorio}].
- **ot_checklists**: ot_id, plantilla_id, respuestas jsonb.

## Ventas (evoluciona lo existente)

- **oportunidades**: + comercial_id (renombra vendedor_id), sucursal_id?, deleted_at.
- **cotizaciones**: oportunidad_id, numero, estado `borrador|enviada|aceptada|rechazada`.
- **cotizacion_versiones**: cotizacion_id, version, vigencia?, condiciones?, total, moneda, creado_por.
- **cotizacion_items**: version_id, producto_id?, descripcion, cantidad, precio_unit, descuento_pct.
- **tareas, actividades, plantillas, productos, materiales**: se conservan con ajustes de FK.

## Marketing (Etapa 5) e Integraciones (Etapa 4)

- **segmentos** (definicion jsonb), **campanias**, **campania_destinatarios** (estado envío/apertura/click/baja).
- **conversaciones** (canal `whatsapp|email|web`, cliente_id?, contacto_id?, externo_id), **mensajes** (direccion in/out, cuerpo, meta jsonb), **webhooks_log**.

## IA (Etapa 6)

- **ia_recomendaciones**: entidad, entidad_id, tipo, contenido, fuentes jsonb, estado `propuesta|aceptada|descartada`, usuario_decision?.
- **documentos_conocimiento**: nombre, path, tipo, embeddings (pgvector) — al activar API.

## Reglas de integridad clave

- Serie única: `UNIQUE (numero_serie) WHERE numero_serie IS NOT NULL AND deleted_at IS NULL`.
- CUIT único igual (parcial). Teléfono normalizado por trigger.
- Transiciones de OT validadas por trigger contra `ot_transiciones` + rol.
- Cierre técnico bloqueado sin: diagnóstico, trabajo_realizado, ≥1 tiempo, firma —
  salvo `aprobaciones` de excepción aprobada (auditada).
- `ot_items.aprobado_admin` requerido para computar en total facturable.
- Todos los triggers de auditoría activos antes de abrir el sistema al equipo.
