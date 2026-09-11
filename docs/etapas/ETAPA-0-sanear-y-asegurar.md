# Etapa 0 — Sanear y asegurar

> Especificación para ejecutar en Claude Code sobre el repositorio `gastroware-crm`.
> Contexto: este documento, más `docs/PLAN-OS.md` (plan maestro). Trabajar en una rama `etapa-0`.
> Regla general: un commit por punto. No agregar ninguna funcionalidad nueva en esta etapa.
> Antes de escribir código, leer `AGENTS.md` (la versión de Next.js tiene cambios) y los archivos citados en cada punto.

## Objetivo

Dejar el sistema seguro y con cifras confiables antes de construir encima. Al terminar: el cron de garantías crea tareas, el push matutino llega, ningún usuario puede hacer lo que su rol no permite, y los números de Reportes y Pipeline coinciden.

---

## 0.1 Migración `025_saneamiento.sql`

Crear `supabase/migrations/025_saneamiento.sql` con todo lo siguiente, en este orden, con comentario de cabecera que explique cada bloque (mismo estilo que las migraciones anteriores).

### a) Tipos de tarea

```sql
alter table tareas drop constraint if exists tareas_tipo_check;
alter table tareas add constraint tareas_tipo_check
  check (tipo in ('seguimiento','reactivacion','recompra','postventa','garantia','preventivo','reclamo_cobranza','otro'));
```

### b) Prioridad de tarea (se usa en Etapa 1)

```sql
alter table tareas add column if not exists prioridad text not null default 'normal'
  check (prioridad in ('alta','normal','baja'));
```

### c) Webhook de WhatsApp: cerrar el acceso anónimo

```sql
revoke execute on function fn_webhook_wa(jsonb) from anon;
revoke execute on function fn_webhook_wa(jsonb) from authenticated;
-- Queda ejecutable solo por service_role (implícito).
```

En `app/api/webhooks/whatsapp/route.ts`, después de validar la firma, llamar al RPC con un cliente creado con `SUPABASE_SERVICE_ROLE_KEY` (mismo patrón que `app/api/cron/recurrencias/route.ts`), no con la anon key.

### d) Storage: leer solo lo propio

Reemplazar la política `storage_select_auth` (definida en `004_os_fundacion.sql:965-966`) por políticas por bucket que verifiquen la entidad dueña del archivo. Convención de paths existente: revisar `lib/core/storage.ts` para confirmar cómo se arma el path de cada bucket y ajustar las expresiones.

```sql
drop policy if exists "storage_select_auth" on storage.objects;

-- Gestores (direccion/admin) leen todo.
create policy "storage_select_gestor" on storage.objects for select to authenticated
  using (bucket_id in ('servicio','documentos','cotizaciones') and fn_es_gestor());

-- Resto: solo archivos de entidades que puede ver bajo RLS.
-- Path esperado: <entidad>/<id_entidad>/<archivo>. Ajustar si lib/core/storage.ts usa otro formato.
create policy "storage_select_propio" on storage.objects for select to authenticated
  using (
    bucket_id in ('servicio','documentos','cotizaciones')
    and exists (
      select 1 from documentos d
      where d.storage_path = storage.objects.name
    )
  );
```

Si la tabla `documentos` no registra todos los archivos (fotos de OT, firmas), agregar en la misma migración el registro faltante o una segunda condición con `ot_fotos`. Verificar leyendo `lib/core/storage.ts` y las acciones que suben archivos (`agregarFotoOT`, `crearSubidaBiblioteca`, firma de OT).

Además: el bucket `cotizaciones` no tiene política `select`; queda cubierto por las dos políticas anteriores.

### e) Facturación y aprobación solo para gestores (capa de base)

```sql
create or replace function fn_protege_facturacion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.nro_factura is distinct from old.nro_factura) and not fn_es_gestor() then
    raise exception 'Solo dirección o administración pueden cargar el número de factura';
  end if;
  return new;
end $$;
drop trigger if exists trg_protege_facturacion on oportunidades;
create trigger trg_protege_facturacion before update on oportunidades
  for each row execute function fn_protege_facturacion();

create or replace function fn_protege_ot_items() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if fn_rol() = 'tecnico' and (
       new.aprobado_admin is distinct from old.aprobado_admin
    or new.precio_unit is distinct from old.precio_unit
  ) then
    raise exception 'El técnico no puede aprobar ítems ni cambiar precios';
  end if;
  return new;
end $$;
drop trigger if exists trg_protege_ot_items on ot_items;
create trigger trg_protege_ot_items before update on ot_items
  for each row execute function fn_protege_ot_items();
```

Verificar los nombres reales de columnas (`aprobado_admin`, `precio_unit`, `nro_factura`) en `004_os_fundacion.sql` y `015_factura_venta.sql` antes de aplicar.

### f) Índices faltantes

```sql
create index if not exists opps_cliente_idx on oportunidades (cliente_id);
create index if not exists tareas_recurrencia_idx on tareas (recurrencia_id);
create index if not exists tareas_equipo_idx on tareas (equipo_id);
create index if not exists actividades_created_idx on actividades (created_at desc);
create index if not exists clientes_email_idx on clientes (lower(email));
```

### g) Cascadas peligrosas

Cambiar `on delete cascade` por `on delete restrict` en `ordenes_trabajo.cliente_id` y en `oportunidades.cliente_id`. El borrado de clientes ya es soft delete (`eliminarCliente`); esto evita que un delete físico desde el dashboard de Supabase arrastre facturación e historial.

```sql
alter table ordenes_trabajo drop constraint ordenes_trabajo_cliente_id_fkey;
alter table ordenes_trabajo add constraint ordenes_trabajo_cliente_id_fkey
  foreign key (cliente_id) references clientes(id) on delete restrict;
alter table oportunidades drop constraint oportunidades_cliente_id_fkey;
alter table oportunidades add constraint oportunidades_cliente_id_fkey
  foreign key (cliente_id) references clientes(id) on delete restrict;
```

Confirmar los nombres de constraint con `\d` o con el dashboard antes de aplicar.

---

## 0.2 Chequeos de rol en servidor (`lib/actions.ts`)

Agregar `await exigirGestor()` (o el helper equivalente que ya existe; buscar `exigirGestor` o `rolActual`) al inicio de:

- `facturarPedido` (~línea 704)
- `revisarItemOT` (~línea 1374)
- `guardarStock`, `recibirIngresoStock` (verificar que ya lo tengan)

Si el helper no existe, crearlo en `lib/auth.ts`:

```ts
export async function exigirGestor() {
  const rol = await rolActual();
  if (rol !== "direccion" && rol !== "admin") {
    throw new Error("Acción reservada a dirección o administración");
  }
}
```

---

## 0.3 Errores que no se leen

Crear en `lib/supabase/must.ts`:

```ts
export function must<T>(res: { data: T | null; error: { message: string } | null }, contexto: string): T {
  if (res.error) throw new Error(`${contexto}: ${res.error.message}`);
  return res.data as T;
}
```

Aplicarlo en todas las escrituras de estas funciones de `lib/actions.ts`, de modo que ningún insert/update quede sin verificar:

- `cambiarEtapa` (rama `ganada`: inserts en `equipos` y `recurrencias`)
- `crearLeadFeria` (inserts en `clientes`, `oportunidades`, `feria_leads`)
- `crearTarea`
- `agregarFotoOT`
- `cargarServiceHecho` (resultado de `transicionarOT`)
- `app/api/cron/recurrencias/route.ts` (insert de tareas `garantia` y `recompra`: contar solo si el insert no dio error)

Cada acción que falle devuelve `{ error: string }` y el componente que la llama muestra el mensaje (revisar que todos los formularios rendericen `error` como ya lo hacen `InteresNuevoForm` y `CotizacionForm`).

## 0.4 Transacciones en los flujos críticos

Crear funciones plpgsql en la migración 025 y llamarlas por RPC desde las acciones, para que cada flujo sea todo o nada:

- `fn_ganar_venta(oportunidad_id uuid, numero_serie text, fecha_compra date)` → actualiza etapa, crea equipo con garantía calculada desde `productos.garantia_meses`, crea recurrencias de consumibles, registra actividad. Reemplaza el cuerpo de la rama `ganada` de `cambiarEtapa`.
- `fn_crear_lead_feria(...)` → cliente (o busca existente por teléfono normalizado), oportunidad, feria_lead, actividad. Reemplaza `crearLeadFeria`.

Idempotencia: `fn_ganar_venta` no hace nada si la oportunidad ya está en `ganada` (devuelve el equipo existente). `cambiarEtapa` en general: si `etapa` actual es igual a la pedida, retornar sin escribir.

`registrarCotizacion`: no llamar a `cambiarEtapa("cotizada")` si la etapa actual es `ganada` o `perdida`; solo crear la versión.

## 0.5 Cifras con moneda

En `app/(app)/reportes/page.tsx` (líneas ~63-64) y `app/(app)/pipeline/page.tsx` (~63): calcular totales por moneda y mostrarlos separados:

```
Pipeline abierto: USD 48.200 · ARS 12.400.000
```

Crear `lib/dinero.ts` con `sumarPorMoneda(items: {monto: number|null, moneda: string}[]): Record<string, number>` y un componente `<Montos por={...}/>` que renderice una línea por moneda. Nunca sumar monedas distintas en ningún lugar del código; buscar todos los `reduce` sobre `monto_estimado` y `total` y aplicar el helper.

## 0.6 Entorno y despliegue

1. Crear `.env.example` en la raíz con todas las variables que usa el código (buscar `process.env.` en todo el repo) y una línea de comentario por variable diciendo para qué sirve y dónde se obtiene. Agregar `!.env.example` en `.gitignore` debajo de `.env*`.
2. `proxy.ts`: si faltan `NEXT_PUBLIC_SUPABASE_URL` o `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `process.env.VERCEL_ENV === "production"`, responder `503` con texto "Configuración incompleta" en lugar de dejar pasar.
3. `app/api/cron/resumen/route.ts:26`: reemplazar el email hardcodeado por `process.env.VAPID_SUBJECT` (o `CONTACTO_ADMIN_EMAIL`).
4. `lib/actions.ts` `urlBaja` (~1901): usar `BAJA_SECRET` propio en lugar de `CRON_SECRET`. Agregar la variable a `.env.example`.
5. `app/api/baja/route.ts:33`: comparar tokens con `crypto.timingSafeEqual`.
6. `app/api/export/route.ts`: anteponer `'` a celdas que empiecen con `=`, `+`, `-`, `@`. Restringir la exportación de `clientes` a gestores.
7. Reemplazar `xlsx@0.18.5`: `npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` (o migrar `ImportadorClientes.tsx` a `exceljs`).
8. Crear `.github/workflows/ci.yml` que corra `npm ci`, `npx tsc --noEmit`, `npm run lint`, `npm test` en cada push y PR.
9. **Manual, fuera del código:** en Vercel → Settings → Environment Variables confirmar que existen y tienen valor: `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `RESEND_API_KEY`, `ANTHROPIC_API_KEY`, `WHATSAPP_APP_SECRET`, `NEXT_PUBLIC_APP_URL`, `BAJA_SECRET`. Redeploy después de cargarlas.

## 0.7 Limpieza mínima

- Borrar `components/FilaOT.tsx` (no se importa) y `public/{file,globe,next,vercel,window}.svg`.
- `app/manifest.ts`: `start_url: "/"`.
- Mover `PLAN.md`, `PLAN-V2.md` y `docs/IMPLEMENTATION_PLAN.md` a `docs/archive/`. Guardar el plan maestro como `docs/PLAN-OS.md` y actualizar `README.md` para que apunte a él y describa la estructura real (sin cadencias D+2/5/10/20 ni `/hoy` como centro).

---

## Definición de terminado

- [ ] Migración 025 aplicada en Supabase sin errores; `select tipo from tareas` acepta `garantia`.
- [ ] Ejecutar el cron de recurrencias a mano (`curl` con `CRON_SECRET`) y verificar que crea una tarea `garantia` para un equipo con garantía que vence en menos de 60 días.
- [ ] Con el token de un usuario `tecnico`: `rpc('fn_webhook_wa')` devuelve error de permiso; `storage.from('documentos').list()` devuelve solo lo propio; `update oportunidades set nro_factura` falla.
- [ ] Con un usuario `comercial`: `facturarPedido` devuelve error.
- [ ] Reportes y Pipeline muestran los mismos totales, separados por moneda.
- [ ] El push matutino llega a un usuario con notificaciones activadas.
- [ ] `npx tsc --noEmit`, `npm run lint` y `npm test` pasan en CI.
- [ ] `.env.example` existe y Vercel tiene todas las variables cargadas.
