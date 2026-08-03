# IA e integraciones — GastroWare OS

## Estado de decisiones (2026-08-03)

- IA generativa: SIN API key por ahora (decisión de dirección). Se construye todo
  el andamiaje y la "inteligencia por reglas"; el modelo se enchufa después.
- WhatsApp: SOLO API oficial de Meta (WhatsApp Business Platform). Prohibido el
  scraping de WhatsApp Web. Sin promesas de leer histórico (la API no lo da).
- Email: adaptador independiente del proveedor; Resend recomendado (requiere
  verificar DNS de gastroware.com.ar; remitente info@gastroware.com.ar).
- Formularios web: endpoint propio firmado.

## Arquitectura de integraciones (adaptadores)

```
app/api/webhooks/
  formulario/route.ts    POST firmado (clave compartida) desde el sitio web
  email/route.ts         webhook del proveedor de email (adaptador)
  whatsapp/route.ts      webhook de Meta (verificación + eventos)
lib/modules/integraciones/
  adaptadores/email.ts   interfaz EnviarEmail → implementación Resend (canjeable)
  adaptadores/whatsapp.ts
  normalizacion.ts       teléfono/email/nombre normalizados + dedup
```

Reglas comunes a todo webhook:
- Verificación de origen (firma/clave), rate limiting por IP, log en `webhooks_log`.
- Payload crudo guardado para trazabilidad; procesamiento idempotente por id externo.
- Normalización y deduplicación ANTES de crear registros; nunca fusión automática.
- Resultado: conversación/mensaje vinculado a cliente/contacto + tarea sugerida +
  notificación al responsable.

### WhatsApp Business (Etapa 4)
- Requisitos externos: Meta Business verificado, número dedicado o migrado (decisión
  pendiente de dirección), costos por conversación de Meta, opcionalmente un BSP.
- Alcance realista v1: recepción de mensajes y estados por webhook, envío de
  plantillas aprobadas, vínculo con clientes por teléfono normalizado, bandeja de
  conversaciones. La respuesta libre 1:1 puede seguir en la app de WhatsApp del
  vendedor hasta decidir migración completa.

### Email (Etapa 4)
- Envío transaccional y de campañas vía adaptador (outbox con reintentos e
  idempotencia). Minimización: se guarda lo necesario para trazabilidad, no el
  buzón completo.

### Formularios web (Etapa 4)
- POST firmado con clave compartida + honeypot + rate limit. Valida y crea lead
  (o vincula a cliente existente), asigna responsable por regla, crea tarea de
  seguimiento y notificación.

## Asistente de IA (Etapa 6)

### Principios obligatorios (del spec, no negociables)
1. Permisos ANTES de recuperar: toda búsqueda corre con el contexto del usuario
   (las consultas van por RLS con su sesión; jamás con service role).
2. Citas de fuente en toda respuesta basada en documentos (enlace al registro o
   documento usado). Si no hay evidencia suficiente: decirlo.
3. Prohibido inventar números de serie, precios, diagnósticos o datos técnicos.
4. Salidas estructuradas validadas por esquema (zod) antes de usarse.
5. Acciones: siempre vista previa de qué va a cambiar + confirmación. Comunicaciones
   externas: flujo de aprobación. Automáticas de bajo riesgo: configurables y OFF
   por defecto.
6. Registro completo en `ia_recomendaciones` + audit: acción, usuario, fecha,
   resultado, aprobación. Límites de uso y costo por usuario/día.

### Base de conocimiento
- `documentos_conocimiento` + pgvector (extensión disponible en Supabase).
- Ingesta: manuales, fichas técnicas, catálogos, listas de precios, informes,
  procedimientos. Chunking + embeddings al cargar; recuperación selectiva top-k
  filtrada por permisos del usuario ANTES de armar el contexto.
- Nunca se envía "toda la base" al modelo: solo los chunks recuperados + los
  registros puntuales citados.

### Inteligencia por reglas (disponible desde Etapa 1, sin API)
Misma UI de "recomendaciones" (tarjetas con explicación + fuentes + aceptar/descartar):
- Duplicados: match por teléfono normalizado, CUIT y nombre (trigram) → propuesta
  de unificación manual con vista previa de qué se fusiona.
- Calidad de datos: clientes sin rubro/teléfono/CUIT, equipos sin serie, OTs sin
  diagnóstico, oportunidades sin próxima acción.
- Próxima acción: heurística sobre cadencias vencidas, garantías por vencer (60
  días), equipos sin service > N meses, dormidos > 6 meses.

Cuando llegue la API key, estas tarjetas ganan resúmenes y borradores generativos
sin cambiar la interfaz ni las reglas de aprobación.
