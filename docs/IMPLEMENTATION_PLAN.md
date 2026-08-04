# Plan de implementación por etapas — GastroWare OS

> Complejidad relativa: S (horas) · M (1-2 días) · L (varios días).
> Cada etapa termina con build+tests verdes, verificación en producción y commit.

> Estado (2026-08-03): Etapas 0 a 3 COMPLETADAS y en producción.
> Pendiente de Etapa 1: pegar las 4 env vars en Vercel (service key, CRON_SECRET,
> VAPID x2) y crear los usuarios reales del equipo. Etapas 4-6 bloqueadas por
> decisiones externas (número WhatsApp, DNS email, API key).

## Etapa 0 — Documentación y calidad (S) ✅
- docs/ completo (estos 7 documentos), .env.example documentado.
- Vitest configurado con tests de `lib/format` y cálculos; Playwright configurado
  (browsers con `npx playwright install`); `npm test` como gate.
- Aceptación: docs presentes, `npm run build && npm test` verdes.

## Etapa 1 — Fundamentos seguros (L) ✅
- Migración `004_os_fundacion.sql`: modelo núcleo (DATA_MODEL.md), RLS real
  (PERMISSIONS_MATRIX.md), auditoría por triggers, estados de OT configurables,
  soft delete, outbox. Base limpia.
- `lib/core/` (permisos, resultado, storage firmado) + refactor de `lib/actions.ts`
  a `lib/modules/*` con barrel de compatibilidad.
- Storage privado + URLs firmadas en cotizaciones, fotos, tickets y firmas.
- UI: /admin (usuarios con alta+rol, catálogo productos/modelos, repuestos,
  plantillas, tarifas, auditoría), ficha cliente 360 (fiscal, sucursales,
  documentos, timeline), centro de notificaciones, detector de duplicados.
- Aceptación: casos de prueba de PERMISSIONS_MATRIX verificados con tokens reales;
  auditoría visible; alta de usuario sin tocar Supabase; deploy verificado.

## Etapa 2 — Servicio técnico + equipos EXCELENTE (L) ✅ — la entrega prioritaria
- Equipos: serie única, fotos, documentos, sucursal/ubicación, estado, QR
  (`/e/{serie}` + etiqueta imprimible), timeline inalterable, ticket precargado
  desde el equipo.
- OT: 16 estados con transiciones por rol auditadas, prioridad, tipo de problema,
  cronómetro + carga manual justificada, checklists por modelo, repuestos de
  catálogo con estado (facturable/garantía/cortesía), bloqueo de cierre con campos
  obligatorios + excepción aprobada, comentarios, segunda visita / espera de
  repuesto.
- Admin: bandeja de revisión con devolución + observación, aprobación ítem por
  ítem de refacturables, precios administrativos, informe técnico PDF profesional,
  vistas de pendientes de facturación/refacturación.
- Aceptación: los 20 criterios de PRODUCT_REQUIREMENTS.md, uno a uno, con
  Playwright + prueba manual desde teléfono real.

## Etapa 3 — CRM y ventas pro (M) ✅
- Cotizaciones con versiones y comparación (delta % y versión vigente); relación
  venta→equipo→instalación (al ganar se crea el equipo y la oportunidad avisa
  si falta serie/instalación); resumen comercial heurístico en ficha ("Situación");
  pipeline marca oportunidades sin próxima acción o con seguimiento vencido.
- Nota: el embudo configurable se pospuso a propósito — las etapas fijas
  funcionan y configurarlas hoy es complejidad sin retorno.

## Etapa 4 — Integraciones (M + decisiones externas) ✅ lo construible / ⏸ lo bloqueado
- ✅ Formulario web → lead: `/api/lead-web` (honeypot + rate limit 20/hora en DB
  vía `fn_lead_web` security definer, dedup por teléfono, tarea que vence hoy,
  notificación a gestores). Código para el sitio en docs/FORMULARIO_WEB.md.
- ✅ Webhook WhatsApp Business oficial (`/api/webhooks/whatsapp`): verificación
  de Meta + firma HMAC + `fn_webhook_wa` (conversaciones/mensajes con dedup,
  vínculo por teléfono, aviso si el número es desconocido). DORMIDO hasta
  configurar WHATSAPP_VERIFY_TOKEN y WHATSAPP_APP_SECRET (decisión: número y
  verificación Meta Business). Sin scraping; no lee histórico.
- ✅ Adaptador de email (Resend) en lib/core/email.ts: se activa con
  RESEND_API_KEY + dominio verificado (DNS de gastroware.com.ar). Hasta
  entonces devuelve error claro; nada simula enviarse.
- ⏸ UI de conversaciones: se hace cuando el canal de WhatsApp esté activo y
  haya datos reales (regla: sin pantallas vacías simuladas).

## Etapa 5 — Marketing (M) ✅ (adaptada a WhatsApp manual)
- Campañas WhatsApp ASISTIDAS (decisión de Franco: sin API, sin scraping): el
  segmento se arma con filtros dinámicos (estado, rubro, marca de equipo,
  dormidos según config, garantía por vencer 60d, consumibles, ciudad) con
  preview de alcance; el mensaje con {nombre} se manda cliente por cliente
  desde el WhatsApp del operario (cola con progreso, enviado/salteado,
  actividad registrada, cierre automático). Migración 009.
- Exclusión y baja: clientes.no_contactar (toggle en la ficha) excluye de todo
  segmento, siempre.
- Automáticas: garantía por vencer (30 días) crea tarea única por equipo
  (tareas.equipo_id) en el cron diario; recompra de consumibles ya existía;
  posventa ya existía (check-ins al ganar).
- Canal email: modelado en el esquema, se activa cuando exista RESEND_API_KEY
  + DNS (sin UI hasta entonces — regla de no simular).

## Etapa 6 — IA (M + API key)
- Base de conocimiento (pgvector), asistente con permisos previos a la
  recuperación, citas de fuente obligatorias, acciones con vista previa y
  aprobación, límites de costo y registro. BLOQUEANTE: API key de Anthropic
  (decisión de dirección: "todavía no").
- Desde Etapa 1 ya funciona la "inteligencia sin API": duplicados, calidad de
  datos y próxima acción por reglas, con la misma UI de recomendaciones.

## Dependencias externas pendientes (dueño: dirección)
1. 4 env vars en Vercel (service key, CRON_SECRET, VAPID ×2) — habilitan crons,
   push y parte del alta de usuarios/URLs firmadas en prod.
2. Supabase Pro (USD 25/mes) recomendado al uso diario (free se pausa).
3. Emails del equipo para crear usuarios reales.
4. Rotar la contraseña inicial de Franco.
5. (Etapa 4) Número de WhatsApp + Meta Business. (Etapa 4) DNS para email.
6. (Etapa 6) API key de Anthropic + presupuesto mensual.
