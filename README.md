# GastroWare CRM

Cockpit de ventas mobile-first para GastroWare / Zumex. Seguimiento comercial,
venta guiada y cartera de clientes con recompra de consumibles.

El plan técnico completo está en [PLAN.md](./PLAN.md).

## Puesta en marcha (una sola vez, ~15 minutos)

### 1. Crear el proyecto de Supabase

1. Entrar a [supabase.com](https://supabase.com) y crear una cuenta gratuita.
2. **New project** → nombre `gastroware-crm`, región *South America (São Paulo)*,
   elegir una contraseña de base de datos (guardarla).
3. Esperar 1-2 minutos a que el proyecto se cree.

### 2. Cargar el esquema de la base

1. En el dashboard de Supabase: **SQL Editor** → **New query**.
2. Copiar TODO el contenido de [`supabase/schema.sql`](./supabase/schema.sql), pegarlo y **Run**.
3. Debería terminar sin errores (crea tablas, seguridad, productos y plantillas).

### 3. Crear los usuarios

1. **Authentication** → **Users** → **Add user** → **Create new user**.
2. Cargar email y contraseña de cada vendedor (y el tuyo).
3. (Opcional) Para marcarte como admin: **SQL Editor** →
   `update usuarios set rol = 'admin' where id = (select id from auth.users where email = 'TU_EMAIL');`

### 4. Configurar las variables de entorno

1. Copiar `.env.example` a `.env.local`.
2. En Supabase: **Settings** → **API** → copiar:
   - *Project URL* → `NEXT_PUBLIC_SUPABASE_URL`
   - *anon public* key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - *service_role* key → `SUPABASE_SERVICE_ROLE_KEY` (solo para el cron)
3. Inventar un texto largo para `CRON_SECRET`.

### 5. Correr en local

```bash
npm install
npm run dev
```

Abrir http://localhost:3000 y entrar con el usuario creado en el paso 3.

### 6. Deploy en Vercel (igual que zumex.com.ar)

1. Subir el repo a GitHub.
2. En [vercel.com](https://vercel.com): **Add New Project** → importar el repo.
3. En **Environment Variables** cargar las cuatro variables de `.env.local`.
4. Deploy. El cron de recompras (`vercel.json`) queda activo solo: corre todos
   los días a las 9:00 (hora argentina) y genera las tareas de recompra vencidas.

## Cómo se usa (flujo del vendedor)

1. **Entra una consulta** → botón ➕ **Nuevo**: teléfono (detecta duplicados),
   nombre, rubro, producto, origen. 30 segundos.
2. **Diagnóstico** → en la oportunidad, completar las preguntas del producto.
   Para Zumex la cuenta de recupero se calcula sola.
3. **Cotizar** → registrar monto y adjuntar el PDF. Al guardar se generan solas
   las tareas de seguimiento D+2, D+5, D+10 y D+20.
4. **Hoy** → cada mañana muestra qué seguimientos tocan, con el mensaje listo
   para copiar o mandar directo por WhatsApp.
5. **Cierre** → Ganada registra el equipo instalado y activa postventa y
   recurrencias de consumibles. Perdida exige el motivo.
6. **Recompra** → cuando vence el ciclo de un consumible (ej. pastillas
   Rational cada 45 días) aparece la tarea en Hoy automáticamente.

## Estructura

- `app/(app)/hoy` — centro de tareas del día
- `app/(app)/alta` — alta rápida de lead
- `app/(app)/pipeline` — kanban por etapa
- `app/(app)/clientes` — cartera filtrable por rubro
- `app/(app)/oportunidades/[id]` — ficha con diagnóstico, cotización y plantillas
- `lib/actions.ts` — toda la lógica de negocio (cadencias, regla de oro, recurrencias)
- `supabase/schema.sql` — esquema + seeds (productos y plantillas de mensajes)
