-- 031: Consumibles (v1.4).
-- Cada venta de consumibles actualiza el plan de reposición de ese cliente,
-- sucursal y producto (tabla recurrencias): última compra, cantidad,
-- frecuencia estimada, anticipación, fecha de contacto y responsable. El plan
-- ES el seguimiento: uno solo por cliente/sucursal/producto, sin duplicados.
-- La fecha estimada no genera ventas ni mensajes: solo el aviso para contactar.
-- Arregla que vender un consumible o un repuesto creara un "equipo".
-- Solo agrega columnas, una tabla y funciones; no borra datos.
-- Idempotente: se puede volver a correr.

-- =====================================================================
-- 1. Cantidades por producto en cada operación
-- =====================================================================
create table if not exists oportunidad_items (
  id uuid primary key default gen_random_uuid(),
  oportunidad_id uuid not null references oportunidades(id) on delete cascade,
  producto_id uuid not null references productos(id),
  cantidad numeric not null default 1 check (cantidad > 0),
  unidad text,
  created_at timestamptz not null default now()
);
create index if not exists oportunidad_items_opp_idx on oportunidad_items (oportunidad_id);
alter table oportunidad_items enable row level security;
-- Se ve y se cambia si se ve la operación (la política de oportunidades filtra)
drop policy if exists oportunidad_items_all on oportunidad_items;
create policy oportunidad_items_all on oportunidad_items for all to authenticated
  using (exists (select 1 from oportunidades o where o.id = oportunidad_id))
  with check (exists (select 1 from oportunidades o where o.id = oportunidad_id));

-- =====================================================================
-- 2. Plan de reposición (recurrencias)
--    proxima_alerta = fecha en que hay que contactar al cliente
-- =====================================================================
alter table recurrencias add column if not exists sucursal_id uuid references sucursales(id) on delete set null;
alter table recurrencias add column if not exists anticipacion_dias int not null default 10
  check (anticipacion_dias between 0 and 90);
alter table recurrencias add column if not exists responsable_id uuid references usuarios(id);
alter table recurrencias add column if not exists ultima_cantidad numeric;
alter table recurrencias add column if not exists unidad text;
alter table recurrencias add column if not exists ultima_oportunidad_id uuid references oportunidades(id) on delete set null;
alter table recurrencias add column if not exists motivo_suspension text;
alter table recurrencias add column if not exists suspendida_at timestamptz;
alter table recurrencias add column if not exists created_at timestamptz not null default now();
alter table recurrencias add column if not exists updated_at timestamptz not null default now();
-- Si todavía no se sabe cada cuánto repone, se pone directo la fecha de contacto
alter table recurrencias alter column frecuencia_dias drop not null;

-- Un solo plan activo por cliente, sucursal y producto
create unique index if not exists recurrencias_activa_uq on recurrencias
  (cliente_id, producto_id, coalesce(sucursal_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where activa;
create index if not exists recurrencias_contacto_idx on recurrencias (responsable_id, proxima_alerta) where activa;

-- Quién cambió cada plan (reprogramar, suspender) queda en la auditoría
drop trigger if exists tg_audit_recurrencias on recurrencias;
create trigger tg_audit_recurrencias after insert or update or delete on recurrencias
  for each row execute function fn_audit();

create or replace function fn_recurrencia_touch() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists tg_recurrencia_touch on recurrencias;
create trigger tg_recurrencia_touch before update on recurrencias
  for each row execute function fn_recurrencia_touch();

-- =====================================================================
-- 3. Registrar una compra de un consumible: crea o actualiza el plan
--    (con la sesión del usuario: respeta los permisos)
-- =====================================================================
create or replace function fn_reponer(
  p_cliente_id uuid,
  p_producto_id uuid,
  p_sucursal_id uuid,
  p_fecha date,
  p_cantidad numeric default null,
  p_unidad text default null,
  p_oportunidad_id uuid default null
) returns uuid
language plpgsql set search_path = public as $$
declare
  v_plan recurrencias%rowtype;
  v_frec int;
  v_resp uuid;
  v_id uuid;
begin
  select * into v_plan from recurrencias
   where cliente_id = p_cliente_id and producto_id = p_producto_id and activa
     and coalesce(sucursal_id, '00000000-0000-0000-0000-000000000000'::uuid)
       = coalesce(p_sucursal_id, '00000000-0000-0000-0000-000000000000'::uuid)
   for update;
  if found then
    -- Se reinicia desde la compra; si el plan no tenía tiempo, toma el del producto
    select coalesce(v_plan.frecuencia_dias, frecuencia_recompra_dias) into v_frec from productos where id = p_producto_id;
    update recurrencias
       set frecuencia_dias = v_frec,
           ultima_compra = p_fecha,
           ultima_cantidad = coalesce(p_cantidad, ultima_cantidad),
           unidad = coalesce(p_unidad, unidad),
           ultima_oportunidad_id = coalesce(p_oportunidad_id, ultima_oportunidad_id),
           proxima_alerta = greatest(p_fecha + 1,
             p_fecha + coalesce(v_frec, 30) - anticipacion_dias)
     where id = v_plan.id;
    -- Recompras viejas pendientes de este plan: resueltas por la compra
    update tareas set completada_at = now()
     where recurrencia_id = v_plan.id and completada_at is null and not cancelada;
    return v_plan.id;
  end if;

  select frecuencia_recompra_dias into v_frec from productos where id = p_producto_id;
  -- Responsable: la administrativa (manual 4.2); si no hay, el vendedor del cliente
  select id into v_resp from usuarios where rol = 'administrativa' and activo order by created_at limit 1;
  if v_resp is null then
    select comercial_id into v_resp from clientes where id = p_cliente_id;
  end if;
  insert into recurrencias (cliente_id, producto_id, sucursal_id, frecuencia_dias, anticipacion_dias,
                            ultima_compra, ultima_cantidad, unidad, ultima_oportunidad_id,
                            proxima_alerta, responsable_id, activa)
  values (p_cliente_id, p_producto_id, p_sucursal_id, v_frec, 10,
          p_fecha, p_cantidad, p_unidad, p_oportunidad_id,
          greatest(p_fecha + 1, p_fecha + coalesce(v_frec, 30) - 10), v_resp, true)
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function fn_reponer(uuid, uuid, uuid, date, numeric, text, uuid) from public, anon;
grant execute on function fn_reponer(uuid, uuid, uuid, date, numeric, text, uuid) to authenticated, service_role;

-- =====================================================================
-- 4. Ganar una venta: los consumibles actualizan su plan (no son equipos);
--    los repuestos tampoco crean equipos. Lo demás queda igual que en la 025.
-- =====================================================================
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
  v_item record;
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

  -- Consumibles de la venta (el principal y los extra): cada uno a su plan
  for v_item in
    select p.id, i.cantidad, i.unidad
      from productos p
      left join oportunidad_items i on i.oportunidad_id = p_oportunidad_id and i.producto_id = p.id
     where p.es_consumible
       and (p.id = v_opp.producto_id or coalesce(v_opp.productos_extra, '[]'::jsonb) ? p.id::text)
  loop
    perform fn_reponer(v_opp.cliente_id, v_item.id, v_opp.sucursal_id, v_fecha, v_item.cantidad, v_item.unidad, p_oportunidad_id);
  end loop;

  if v_opp.producto_id is not null then
    select garantia_meses, modelo_id, es_consumible, categoria into v_prod from productos where id = v_opp.producto_id;
    if not coalesce(v_prod.es_consumible, false) and coalesce(v_prod.categoria, '') <> 'repuesto' then
      insert into equipos (cliente_id, producto_id, modelo_id, numero_serie, origen,
                           fecha_venta, garantia_hasta, comercial_id, oportunidad_id)
      values (v_opp.cliente_id, v_opp.producto_id, v_prod.modelo_id,
              nullif(trim(coalesce(p_numero_serie, '')), ''), 'vendido', v_fecha,
              case when v_prod.garantia_meses is not null
                   then (v_fecha + (v_prod.garantia_meses || ' months')::interval)::date
                   else null end,
              v_opp.comercial_id, p_oportunidad_id)
      returning id into v_equipo_id;

      -- El consumible del equipo vendido (ej. pastillas del horno) arranca su plan
      select id into v_consumible from productos where consumible_de = v_opp.producto_id and es_consumible limit 1;
      if v_consumible.id is not null then
        perform fn_reponer(v_opp.cliente_id, v_consumible.id, v_opp.sucursal_id, v_fecha, null, null, null);
      end if;
    end if;
  end if;

  insert into actividades (cliente_id, oportunidad_id, tipo, contenido, created_by)
  values (v_opp.cliente_id, p_oportunidad_id, 'cambio_etapa', 'Venta cerrada', auth.uid());

  return v_equipo_id;
end $$;

-- =====================================================================
-- 5. Las ventas de consumibles que ya estaban cerradas arrancan su plan
-- =====================================================================
do $$
declare r record;
begin
  for r in
    select o.id, o.cliente_id, o.producto_id, o.sucursal_id,
           coalesce(o.closed_at, o.created_at)::date as fecha
      from oportunidades o
      join productos p on p.id = o.producto_id
     where o.etapa = 'ganada' and p.es_consumible and o.deleted_at is null
     order by coalesce(o.closed_at, o.created_at)
  loop
    perform fn_reponer(r.cliente_id, r.producto_id, r.sucursal_id, r.fecha, null, null, r.id);
  end loop;
end $$;
