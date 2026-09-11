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

-- =====================================================================
-- h) Transacciones en los flujos críticos (punto 0.4): cada flujo es todo
--    o nada. Las funciones corren con los permisos del usuario (security
--    invoker), así que el RLS sigue aplicando igual que desde la app.
-- =====================================================================

-- Teléfono a dígitos, con la misma regla que normalizarTelefono (lib/format.ts):
-- sin 549/54 al inicio, sin 0 inicial.
create or replace function fn_tel_digitos(t text) returns text
language plpgsql immutable as $$
declare d text := regexp_replace(coalesce(t, ''), '\D', '', 'g');
begin
  if d like '549%' then d := substr(d, 4);
  elsif d like '54%' then d := substr(d, 3);
  end if;
  if d like '0%' then d := substr(d, 2); end if;
  return d;
end $$;

-- Ganar una venta: etapa, cierre de seguimientos, cliente activo, equipo con
-- garantía (desde productos.garantia_meses), recurrencia del consumible y
-- actividad. Idempotente: si ya estaba ganada devuelve el equipo existente.
create or replace function fn_ganar_venta(
  p_oportunidad_id uuid,
  p_numero_serie text default null,
  p_fecha_compra date default null
) returns uuid
language plpgsql set search_path = public as $$
declare
  v_opp oportunidades%rowtype;
  v_prod record;
  v_consumible record;
  v_equipo_id uuid;
  v_fecha date := coalesce(p_fecha_compra, (now() at time zone 'America/Argentina/Buenos_Aires')::date);
begin
  select * into v_opp from oportunidades where id = p_oportunidad_id for update;
  if not found then
    raise exception 'Oportunidad no encontrada';
  end if;
  if v_opp.etapa = 'ganada' then
    select id into v_equipo_id from equipos
     where oportunidad_id = p_oportunidad_id and deleted_at is null
     limit 1;
    return v_equipo_id;
  end if;

  update oportunidades
     set etapa = 'ganada', closed_at = now(), pedido_estado = 'comprometido'
   where id = p_oportunidad_id;
  update tareas set cancelada = true
   where oportunidad_id = p_oportunidad_id and completada_at is null;
  update clientes set estado = 'cliente_activo' where id = v_opp.cliente_id;

  if v_opp.producto_id is not null then
    select garantia_meses, modelo_id into v_prod from productos where id = v_opp.producto_id;
    insert into equipos (cliente_id, producto_id, modelo_id, numero_serie, origen,
                         fecha_venta, garantia_hasta, comercial_id, oportunidad_id)
    values (v_opp.cliente_id, v_opp.producto_id, v_prod.modelo_id,
            nullif(trim(coalesce(p_numero_serie, '')), ''), 'vendido', v_fecha,
            case when v_prod.garantia_meses is not null
                 then (v_fecha + (v_prod.garantia_meses || ' months')::interval)::date
                 else null end,
            v_opp.comercial_id, p_oportunidad_id)
    returning id into v_equipo_id;

    select id, frecuencia_recompra_dias into v_consumible
      from productos where consumible_de = v_opp.producto_id limit 1;
    if v_consumible.id is not null and v_consumible.frecuencia_recompra_dias is not null then
      insert into recurrencias (cliente_id, producto_id, frecuencia_dias, ultima_compra, proxima_alerta)
      values (v_opp.cliente_id, v_consumible.id, v_consumible.frecuencia_recompra_dias,
              v_fecha, v_fecha + v_consumible.frecuencia_recompra_dias);
    end if;
  end if;

  insert into actividades (cliente_id, oportunidad_id, tipo, contenido, created_by)
  values (v_opp.cliente_id, p_oportunidad_id, 'cambio_etapa', 'Venta cerrada', auth.uid());

  return v_equipo_id;
end $$;

-- Lead de feria en un solo paso: contacto (o el existente por teléfono/email,
-- completando lo que falte), oportunidad, seguimiento de feria y actividad.
-- Recibe un jsonb con nombre, apellido, empresa, email, telefono, lineas[],
-- rubro, provincia y nota. Devuelve {cliente_id, oportunidad_id, existente}.
create or replace function fn_crear_lead_feria(p jsonb) returns jsonb
language plpgsql set search_path = public as $$
declare
  v_nombre text := trim(coalesce(p->>'nombre', '') || ' ' || coalesce(p->>'apellido', ''));
  v_empresa text := trim(coalesce(p->>'empresa', ''));
  v_email text := lower(trim(coalesce(p->>'email', '')));
  v_tel text := fn_tel_digitos(coalesce(p->>'telefono', ''));
  v_nota text := nullif(trim(coalesce(p->>'nota', '')), '');
  v_rubro text := nullif(trim(coalesce(p->>'rubro', '')), '');
  v_provincia text := nullif(trim(coalesce(p->>'provincia', '')), '');
  v_lineas text[] := array(select jsonb_array_elements_text(coalesce(p->'lineas', '[]'::jsonb)));
  v_interes text;
  v_uid uuid := auth.uid();
  v_cliente_id uuid;
  v_existente boolean := false;
  v_opp_id uuid;
begin
  if v_nombre = '' and v_empresa = '' then
    raise exception 'Cargá al menos el nombre o la empresa';
  end if;
  if v_tel = '' and v_email = '' then
    raise exception 'Cargá teléfono o email (sino después no lo podemos contactar)';
  end if;
  v_interes := case when coalesce(array_length(v_lineas, 1), 0) > 0
                    then 'Interés: ' || array_to_string(v_lineas, ', ') end;

  -- Dedup: primero por teléfono, después por email
  if length(v_tel) >= 8 then
    select id into v_cliente_id from clientes
     where telefono = v_tel and deleted_at is null limit 1;
  end if;
  if v_cliente_id is null and v_email <> '' then
    select id into v_cliente_id from clientes
     where lower(email) = v_email and deleted_at is null limit 1;
  end if;

  if v_cliente_id is not null then
    v_existente := true;
    -- Completar datos que falten, sin pisar los existentes
    update clientes
       set email = coalesce(email, nullif(v_email, '')),
           telefono = coalesce(telefono, nullif(v_tel, ''))
     where id = v_cliente_id;
  else
    insert into clientes (nombre_comercial, rubro, telefono, email, estado, comercial_id, notas)
    values (coalesce(nullif(v_empresa, ''), v_nombre), coalesce(v_rubro, 'Otro'),
            nullif(v_tel, ''), nullif(v_email, ''), 'prospecto', v_uid,
            nullif(array_to_string(array_remove(array[
              case when v_empresa <> '' and v_nombre <> '' then 'Contacto: ' || v_nombre end,
              v_interes, 'Origen: HOTELGA 2026', v_nota], null), ' | '), ''))
    returning id into v_cliente_id;
    if v_provincia is not null then
      insert into sucursales (cliente_id, nombre, provincia, es_principal)
      values (v_cliente_id, 'Principal', v_provincia, true);
    end if;
  end if;

  insert into oportunidades (cliente_id, comercial_id, origen, pedido, temperatura, mensaje_inicial)
  values (v_cliente_id, v_uid, 'HOTELGA 2026', 'info', 'tibio', nullif(concat_ws(' — ', v_interes, v_nota), ''))
  returning id into v_opp_id;

  insert into feria_leads (cliente_id, feria, nombre, empresa, telefono, email, observaciones, asignado_a)
  values (v_cliente_id, 'HOTELGA 2026', nullif(v_nombre, ''), nullif(v_empresa, ''),
          nullif(v_tel, ''), nullif(v_email, ''), nullif(concat_ws(' — ', v_interes, v_nota), ''), v_uid);

  insert into actividades (cliente_id, oportunidad_id, tipo, contenido, created_by)
  values (v_cliente_id, v_opp_id, 'feria',
          'Cargado en el stand de HOTELGA 2026' || coalesce(' — ' || v_interes, ''), v_uid);

  return jsonb_build_object('cliente_id', v_cliente_id, 'oportunidad_id', v_opp_id, 'existente', v_existente);
end $$;
