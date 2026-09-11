# GastroWare CRM

CRM propio de GastroWare Argentina (Zumex, licuadoras GX, café Jetinno,
hornos Rational y su service). Pensado para un equipo chico con poca
afinidad tecnológica: se usa desde el celular y la computadora, y la regla
es cargar rápido primero y completar después.

El plan de trabajo está en [`docs/PLAN-OS.md`](docs/PLAN-OS.md); cada
etapa tiene su especificación en `docs/etapas/`.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind 4 · Supabase (Postgres, Auth,
Storage, RLS) · Vercel (deploy y crons) · Resend (email) · Anthropic (IA).

## Puesta en marcha

1. Crear un proyecto en [supabase.com](https://supabase.com) y correr, en
   orden, `supabase/schema.sql` y después cada archivo de
   `supabase/migrations/` en el SQL Editor.
2. Copiar `.env.example` a `.env.local` y completar las variables (el
   archivo dice para qué sirve cada una y de dónde sale).
3. `npm install` y `npm run dev` → http://localhost:3000. El primer usuario
   se crea en Supabase → Authentication → Users; el rol se asigna en la
   tabla `usuarios` (o desde Administración → Usuarios una vez logueado
   como dirección).
4. Deploy: importar el repo en Vercel, cargar las mismas variables en
   Settings → Environment Variables y redeployar. Los crons de
   `vercel.json` (recompras y garantías a las 9:00, resumen push a las
   8:30, hora argentina) necesitan `CRON_SECRET` y
   `SUPABASE_SERVICE_ROLE_KEY`.

## Cómo se usa

- **Contactos** es la pantalla de inicio: buscador, quién es cada uno, cómo
  contactarlo, qué le interesa, último movimiento y próxima fecha.
- **Nuevo interés** (botón +): primero qué le interesa, después quién (se
  busca en la base o se carga nuevo con nombre y teléfono). Si no hay
  stock, queda en lista de espera.
- **Ficha del contacto**: caja "¿Qué pasó?" para anotar y elegir cuándo
  volver a contactar; intereses con "Le vendí" / "No se dio"; ventas,
  equipos, services e historial completo.
- **Ventas**: Vendido → Preparar → Facturar → Entregado, un botón por paso.
- **Stock**: qué hay, qué llega y cuándo, quiénes esperan cada equipo.
- **Services**: próximos y hechos; el técnico carga un service hecho en un
  paso y administración lo revisa y cobra.
- **HOTELGA**: seguimiento de los contactos de la feria (estado, quién lo
  contactó, calificación, asignación a vendedor).
- **Movimientos**: todo lo que anotó, vendió y arregló el equipo, por día.

No hay recordatorios automáticos: solo aparece lo que alguien agenda a mano.

## Estructura

- `app/(app)/` — pantallas (una carpeta por ruta); `app/api/` — crons,
  webhooks, exportación, baja de email; `app/{comprobante,cotizacion,inspeccion,propuesta-financiacion}` — hojas imprimibles.
- `components/` — formularios y controles (client components).
- `lib/actions.ts` — todas las server actions; `lib/auth.ts` — rol y
  chequeos de gestor; `lib/dinero.ts` — totales por moneda;
  `lib/stock.ts`, `lib/ventas.ts`, `lib/financiacion.ts`, `lib/format.ts`.
- `lib/core/` — email (Resend), IA (Anthropic), storage (URLs firmadas).
- `supabase/schema.sql` + `supabase/migrations/` — esquema, RLS y funciones.
- `tests/unit/` — tests con Vitest (`npm test`); `npm run lint`,
  `npx tsc --noEmit`. CI en `.github/workflows/ci.yml`.

## Documentación

`docs/PLAN-OS.md` (plan maestro), `docs/etapas/` (especificaciones),
`docs/DATA_MODEL.md`, `docs/PERMISSIONS_MATRIX.md`, `docs/archive/` (planes
anteriores, solo historia).
