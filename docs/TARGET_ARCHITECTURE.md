# Arquitectura objetivo — GastroWare OS

## Principio

Monolito modular sobre el stack existente (Next.js 16 + Supabase + Vercel).
Sin microservicios: hasta 10 usuarios, un solo despliegue, módulos bien separados.
Lo que cambia respecto del estado actual es la solidez (seguridad, auditoría,
tests), no la tecnología.

## Estructura de código

```
app/
  (app)/                 rutas autenticadas por módulo
    hoy/  pipeline/  clientes/  equipos/  servicio/  reportes/
    admin/               usuarios, catálogo, plantillas, tarifas, auditoría
  api/cron/*             jobs Vercel Cron
  api/export/            CSV
  api/webhooks/*         (Etapa 4) formularios, email, WhatsApp
  comprobante/[id]/      informes imprimibles
  e/[serie]/             destino del QR de equipos
lib/
  core/
    supabase/            clientes server/browser (existente)
    permisos.ts          getSesion(), can(), requiere()
    resultado.ts         tipo Resultado<T> = { ok } | { error } para actions
    storage.ts           subida validada + URLs firmadas
    format.ts            fechas AR, dinero ARS/USD (existente, movido)
  modules/
    clientes/  equipos/  servicio/  ventas/  admin/  marketing/  ia/
      actions.ts         server actions del módulo (validación zod)
      queries.ts         lecturas compartidas
  actions.ts             barrel de re-exports (compatibilidad de imports)
supabase/migrations/     SQL numerado e idempotente, aplicado vía SQL Editor
docs/                    esta documentación
tests/
  unit/                  Vitest (lógica pura: format, cálculos, máquinas de estado)
  e2e/                   Playwright (flujo crítico de OT)
```

## Seguridad (dos capas)

1. **RLS real en Postgres** (la capa que manda):
   - `fn_rol()` y `fn_distribuidor()`: funciones `security definer` que leen el rol
     del usuario autenticado desde `usuarios` (evitan recursión de políticas).
   - Políticas por tabla según PERMISSIONS_MATRIX.md. Ejemplos:
     - `oportunidades`: dirección/admin todo; comercial las propias o sin dueño;
       técnico/marketing sin acceso de escritura (técnico sin lectura).
     - `ordenes_trabajo`: dirección/admin todo; técnico solo `tecnico_id = auth.uid()`;
       comercial lectura de las de sus clientes.
     - `clientes`: distribuidor solo `distribuidor_id = fn_distribuidor()`.
   - Escrituras sensibles (aprobar facturación, cambiar roles) restringidas por
     política a dirección/admin.
2. **Helpers `can()` en el servidor** para UX (ocultar botones y rutas). La
   seguridad nunca depende de esta capa.

Regla: el service role key SOLO se usa en cron jobs y en el alta de usuarios de
/admin (API de administración de Auth). Nunca en requests de usuario final.

## Auditoría

- Tabla `audit_log(id, tabla, registro_id, accion, usuario_id, diff jsonb, creado)`.
- Poblada por TRIGGERS `AFTER INSERT/UPDATE/DELETE` en todas las tablas de negocio
  (generic trigger `fn_audit()` que calcula el diff con `to_jsonb`).
- Inmutable: sin políticas de UPDATE/DELETE para nadie (solo INSERT vía trigger y
  SELECT para dirección/admin).
- UI: /admin/auditoria (filtros por tabla/usuario/fecha) y "Historial de cambios"
  en cada ficha.
- `status_history` específica para transiciones de OT (además del audit_log).

## Soft delete

`deleted_at timestamptz` en entidades principales (clientes, equipos, OTs,
oportunidades, contactos, sucursales, repuestos). Las políticas RLS de SELECT
filtran `deleted_at is null` para roles no administrativos; dirección/admin pueden
ver y restaurar. El delete físico queda reservado a mantenimiento por SQL.

## Storage

- Buckets PRIVADOS: `documentos` (facturas, remitos, manuales, adjuntos) y
  `servicio` pasa a privado (fotos, firmas, tickets).
- En DB se guarda el `path`, nunca la URL.
- Lectura: `lib/core/storage.ts` genera URLs firmadas (1 h) en server components.
- Subida: server action valida tipo (imagen/pdf) y tamaño (≤10 MB) y sube con el
  cliente de sesión (política de INSERT por bucket + dueño).

## Máquina de estados de OT

- `ot_estados(codigo, nombre, orden, es_final, requiere_rol)` — seed con los 16
  estados del spec.
- `ot_transiciones(desde, hacia, requiere_rol)` — transiciones válidas.
- Trigger valida cada cambio de estado contra la tabla y escribe `status_history`
  (estado anterior, nuevo, usuario, observación). La UI lee las transiciones
  disponibles para el rol y estado actual — nada hardcodeado.

## Jobs y envíos

- Vercel Cron (existente) + tabla `outbox(id, tipo, payload, clave_idempotencia,
  intentos, estado, error)` para push/emails/campañas: los crons drenan el outbox
  con reintentos exponenciales; la clave de idempotencia evita duplicados.

## Observabilidad y calidad

- Logs estructurados en actions (console.error con contexto; Vercel los captura).
- Tests: Vitest (unidad) + Playwright (e2e del circuito OT). `npm test` en CI.
- Rate limiting simple en webhooks públicos (Etapa 4) por IP+clave.
- Backups: Supabase free hace backups diarios básicos; el plan Pro los extiende
  (recomendado al pasar a uso pleno).

## Localización

Todo en es-AR: `America/Argentina/Buenos_Aires`, `Intl` es-AR, ARS/USD por registro.
Centralizado en `lib/core/format.ts`.

## Decisiones descartadas (y por qué)

- Microservicios / NestJS aparte: sobredimensionado para ≤10 usuarios.
- ORM (Prisma/Drizzle): el acceso directo supabase-js + RLS es más simple y las
  políticas viven en la DB; se re-evalúa si el equipo crece.
- Offline-first para técnicos: descartado por dirección (señal casi siempre
  disponible); online con reintentos.
- Scraping de WhatsApp Web: prohibido por spec (solo API oficial).
