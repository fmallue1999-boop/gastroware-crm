# Auditoría del estado actual — GastroWare CRM

> Fecha: 2026-08-03 · Auditor: Claude (autor del 100% del código, auditoría de conocimiento directo)
> Commit auditado: `f8a5e88` (main, working tree limpio, 8 commits)

## Resumen ejecutivo

El sistema está EN PRODUCCIÓN (https://gastroware-crm.vercel.app) y en uso real.
Cubre ventas (CRM con cadencias), equipos con números de serie y garantías, y
servicio técnico con circuito administrativo de facturación. Todo lo listado como
"funciona" fue verificado end-to-end en producción o local — no hay botones simulados.

La brecha principal contra la especificación objetivo no es funcional sino de
solidez: la seguridad por roles es solo visual (RLS permisiva), no hay auditoría
de cambios, el storage es público y no hay tests. El plan de transformación
(docs/archive/IMPLEMENTATION_PLAN.md) ataca eso primero.

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16.2.10 (App Router, Turbopack, `proxy.ts` para auth) |
| UI | React 19, Tailwind v4 (tokens en `app/globals.css`), lucide-react |
| Datos | Supabase Postgres (proyecto `ozbzyuwnvrqufmvrwtpe`, São Paulo, plan free) |
| Auth | Supabase Auth (email/password), sesión vía cookies (@supabase/ssr) |
| Storage | Supabase Storage — buckets `cotizaciones` y `servicio` (PÚBLICOS) |
| Jobs | Vercel Cron (`/api/cron/recurrencias`, `/api/cron/resumen`) |
| Push | web-push (VAPID), service worker `public/sw.js` |
| Deploy | Vercel, auto-deploy desde GitHub `fmallue1999-boop/gastroware-crm` |
| PWA | manifest + share_target (alta de lead desde "Compartir" de Android) |

Acceso a datos: supabase-js directo desde Server Components y Server Actions.
Toda la lógica de negocio vive en `lib/actions.ts` (~900 líneas). Sin ORM.

## Inventario funcional (verificado)

### Ventas
- Alta rápida con deduplicación por teléfono normalizado; share target Android.
- Pipeline kanban (clic, sin drag), etapas fijas: nueva→diagnóstico→cotizada→seguimiento→negociación→ganada/perdida.
- Cadencia automática D+2/5/10/20 al cotizar; regla de oro (sin próxima acción no hay lead abierto); motivo de pérdida obligatorio; reactivación a 45 días.
- Diagnóstico guiado por producto; calculadora de recupero Zumex (3 escenarios, resumen para WhatsApp).
- Plantillas de mensajes con variables; biblioteca de materiales por producto.
- Reportes: embudo, canal, rubro, motivos, vencidos por vendedor; export CSV.

### Equipos
- Alta propio (catálogo) o ajeno (marca/modelo libre), número de serie (SIN unique en DB), garantía automática por producto (Zumex 60m, licuadoras 12m) o manual, badge vigente/vencida, búsqueda global por serie.
- Recurrencias de consumibles (pastillas Rational cada 45 días) con tarea automática vía cron.

### Servicio técnico
- OT numeradas con 6 estados fijos (abierta→en_proceso→cerrada_tecnico→facturable→facturada, +anulada).
- Panel móvil del técnico: trabajo realizado, horas (número, sin start/stop), refacciones de catálogo o texto libre, gastos con foto de ticket, fotos, firma en canvas (PNG a storage).
- Circuito admin: aprobar → total calculado (tarifa única × horas + refacturables; $0 mano de obra si garantía) → nro factura ZEUS → facturada. Devolver = "reabrir" genérico (sin observación estructurada).
- Comprobante imprimible con firma. Tabla desktop con edición en línea (técnico/fecha).

### Transversal
- Roles admin/vendedor/tecnico: navegación y vistas diferenciadas (SOLO en UI).
- UI v3: sidebar desktop, tablas ordenables, KPIs en Inicio, tema corporativo.
- Export CSV: clientes, servicio, oportunidades.

## Incompleto o dormido

| Ítem | Estado |
|---|---|
| Push matutino + cron recompras | Código completo, MUERTO en prod (faltan 4 env vars en Vercel) |
| Tarifa de servicio | $0 (sin configurar) |
| Biblioteca comercial | Sin contenido cargado |
| Usuarios | Solo Franco (admin); vendedores/técnicos sin crear |
| `equipos.proximo_service` | Columna sin UI |
| Admin de productos/plantillas | Solo por SQL, sin UI |

## Brechas críticas vs. especificación

1. **RLS permisiva**: política `autenticados todo` en TODAS las tablas. Cualquier usuario autenticado lee/escribe todo por API. La separación por rol es cosmética.
2. **Sin auditoría**: no existe audit_log; `actividades` es un timeline parcial manual.
3. **Sin soft delete**: deletes físicos con cascada.
4. **Storage público**: firmas, tickets y cotizaciones accesibles por URL directa.
5. **Sin tests, sin CI, sin rate limiting, sin sanitización de archivos.**
6. **Modelo por debajo del spec**: sin CUIT/condición fiscal, sucursales, consentimientos, QR, checklists, time-tracking, versiones de cotización, distribuidores, notificaciones, aprobaciones; serie sin UNIQUE; estados OT fijos.
7. **`lib/actions.ts` monolítico** (~900 líneas): riesgo de mantenibilidad.

## Riesgos operativos

- Supabase free SE PAUSA por inactividad (ocurrió 2 veces durante el desarrollo). Mitigación: plan Pro USD 25/mes o keep-alive.
- Migraciones manuales por SQL Editor (sin CLI): aceptable al tamaño actual, documentado en cada archivo de `supabase/migrations/`.
- Contraseña inicial del usuario admin quedó expuesta en la conversación de desarrollo → debe rotarse.

## Datos actuales

Confirmado por dirección (2026-08-03): TODOS los datos cargados hasta hoy son de
prueba y descartables. La migración 004 arranca con base limpia.
