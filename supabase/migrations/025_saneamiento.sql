-- 025: saneamiento (Etapa 0, punto 0.1). Sin funcionalidad nueva.
-- Cierra accesos que estaban abiertos de más, protege facturación y
-- aprobación en la base (además del chequeo en el servidor), agrega índices
-- que faltaban y evita que un borrado físico de clientes arrastre historial.
-- Cada bloque es idempotente: se puede volver a correr sin romper nada.

-- =====================================================================
-- a) Tipos de tarea: el cron de recurrencias ya inserta 'garantia' y el
--    check viejo lo rechazaba (por eso no aparecían tareas de garantía).
--    'preventivo' y 'reclamo_cobranza' se usan en la Etapa 1.
-- =====================================================================
do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'tareas'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) like '%tipo%';
  if c is not null then
    execute format('alter table tareas drop constraint %I', c);
  end if;
end $$;
alter table tareas add constraint tareas_tipo_check
  check (tipo in ('seguimiento','reactivacion','recompra','postventa','garantia','preventivo','reclamo_cobranza','otro'));

-- =====================================================================
-- b) Prioridad de la tarea (se usa en la Etapa 1; hoy queda en 'normal').
-- =====================================================================
alter table tareas add column if not exists prioridad text not null default 'normal'
  check (prioridad in ('alta','normal','baja'));

-- =====================================================================
-- c) Webhook de WhatsApp: la función deja de ser ejecutable con la anon
--    key o con una sesión de usuario. Solo service_role (implícito), que
--    es lo que usa app/api/webhooks/whatsapp/route.ts desde esta migración.
-- =====================================================================
revoke execute on function fn_webhook_wa(jsonb) from anon;
revoke execute on function fn_webhook_wa(jsonb) from authenticated;

-- =====================================================================
-- d) Storage: cada usuario lee solo los archivos de lo que puede ver.
--    Antes cualquier usuario logueado podía listar/leer todo 'servicio' y
--    'documentos', y 'cotizaciones' no tenía política de lectura.
--    Paths reales (lib/core/storage.ts y las acciones que suben):
--      documentos:   <entidad>/<id>/<archivo>  → documentos.path
--                    feria/<oportunidad>.jpg   → documentos.path
--                    equipos/<equipo>/<archivo> → equipo_fotos.path
--      servicio:     fotos/<ot>/…   → ot_fotos.path
--                    tickets/<ot>/… → ot_items.comprobante_path
--                    firmas/<ot>-…  → ordenes_trabajo.firma_path
--      cotizaciones: cotizaciones/<oportunidad>/… → cotizacion_versiones.archivo_path
--    Las subconsultas corren con el RLS de cada tabla, así que "está
--    registrado" equivale a "puede ver la entidad dueña".
-- =====================================================================
drop policy if exists "storage_select_auth" on storage.objects;
drop policy if exists "storage_select_gestor" on storage.objects;
drop policy if exists "storage_select_propio" on storage.objects;

create policy "storage_select_gestor" on storage.objects for select to authenticated
  using (bucket_id in ('servicio','documentos','cotizaciones') and fn_es_gestor());

create policy "storage_select_propio" on storage.objects for select to authenticated
  using (
    (bucket_id = 'documentos' and (
         exists (select 1 from documentos d where d.path = storage.objects.name)
      or exists (select 1 from equipo_fotos f where f.path = storage.objects.name)))
    or (bucket_id = 'servicio' and (
         exists (select 1 from ot_fotos f where f.path = storage.objects.name)
      or exists (select 1 from ot_items i where i.comprobante_path = storage.objects.name)
      or exists (select 1 from ordenes_trabajo o where o.firma_path = storage.objects.name)))
    or (bucket_id = 'cotizaciones' and
         exists (select 1 from cotizacion_versiones v where v.archivo_path = storage.objects.name))
  );

-- =====================================================================
-- e) Facturación y aprobación solo para gestores, también en la base
--    (el chequeo del servidor del punto 0.2 es la primera capa).
-- =====================================================================
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

-- =====================================================================
-- f) Índices que faltaban (consultas de ficha, cron, movimientos, dedup).
-- =====================================================================
create index if not exists opps_cliente_idx on oportunidades (cliente_id);
create index if not exists tareas_recurrencia_idx on tareas (recurrencia_id);
create index if not exists tareas_equipo_idx on tareas (equipo_id);
create index if not exists actividades_created_idx on actividades (created_at desc);
create index if not exists clientes_email_idx on clientes (lower(email));

-- =====================================================================
-- g) Cascadas peligrosas: el borrado de clientes es lógico (deleted_at).
--    Un delete físico desde el dashboard no debe arrastrar órdenes ni
--    ventas: pasa a 'restrict'. Los nombres de constraint se buscan por
--    definición para no depender del nombre autogenerado.
-- =====================================================================
do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'ordenes_trabajo'::regclass and contype = 'f'
     and pg_get_constraintdef(oid) like 'FOREIGN KEY (cliente_id) REFERENCES clientes(id)%';
  if c is not null then
    execute format('alter table ordenes_trabajo drop constraint %I', c);
  end if;
  execute 'alter table ordenes_trabajo add constraint ordenes_trabajo_cliente_id_fkey
    foreign key (cliente_id) references clientes(id) on delete restrict';

  select conname into c from pg_constraint
   where conrelid = 'oportunidades'::regclass and contype = 'f'
     and pg_get_constraintdef(oid) like 'FOREIGN KEY (cliente_id) REFERENCES clientes(id)%';
  if c is not null then
    execute format('alter table oportunidades drop constraint %I', c);
  end if;
  execute 'alter table oportunidades add constraint oportunidades_cliente_id_fkey
    foreign key (cliente_id) references clientes(id) on delete restrict';
end $$;
