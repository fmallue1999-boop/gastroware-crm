-- 024: seguimiento de los contactos escaneados en la feria (HOTELGA) y
-- visibilidad por vendedor.
-- Franco: "llevar todos los contactos de HOTELGA: si los contactaron, quién,
-- asignarles vendedor y que solo lo vea ese vendedor, calificación y estados".

create table if not exists feria_leads (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  feria text not null default 'HOTELGA 2026',
  numero text,
  nombre text,
  empresa text,
  cargo text,
  telefono text,
  email text,
  observaciones text,
  calificacion int check (calificacion between 1 and 5),
  estado text not null default 'inicial'
    check (estado in ('inicial','contactado','cerrado','descartado')),
  asignado_a uuid references usuarios(id),
  contactado_por uuid references usuarios(id),
  contactado_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists feria_leads_numero_idx on feria_leads (feria, numero) where numero is not null;
create index if not exists feria_leads_estado_idx on feria_leads (feria, estado, asignado_a);

alter table feria_leads enable row level security;
drop policy if exists feria_select on feria_leads;
create policy feria_select on feria_leads for select to authenticated
  using (fn_es_gestor() or fn_rol() = 'marketing' or asignado_a is null or asignado_a = auth.uid());
drop policy if exists feria_insert on feria_leads;
create policy feria_insert on feria_leads for insert to authenticated
  with check (fn_es_gestor() or fn_rol() in ('comercial','marketing'));
drop policy if exists feria_update on feria_leads;
create policy feria_update on feria_leads for update to authenticated
  using (fn_es_gestor() or asignado_a is null or asignado_a = auth.uid());
drop policy if exists feria_delete on feria_leads;
create policy feria_delete on feria_leads for delete to authenticated
  using (fn_es_gestor());

-- Visibilidad: un contacto asignado a un comercial es privado de ese
-- comercial (y de dirección/administración). Sin asignar, o asignado a
-- alguien de dirección/administración, lo ve todo el equipo.
create or replace function fn_comercial_ve_cliente(cid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from clientes c
    left join usuarios u on u.id = c.comercial_id
    where c.id = cid
      and (c.comercial_id is null or c.comercial_id = auth.uid()
           or u.rol in ('direccion','admin'))
  )
$$;

create or replace function fn_puede_ver_cliente(cid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select fn_es_gestor()
    or fn_rol() in ('marketing','tecnico')
    or (fn_rol() = 'comercial' and fn_comercial_ve_cliente(cid))
    or (fn_rol() = 'distribuidor' and exists (
          select 1 from clientes c where c.id = cid
            and c.distribuidor_id = fn_distribuidor()))
$$;

drop policy if exists clientes_select on clientes;
create policy clientes_select on clientes for select to authenticated
  using (
    (deleted_at is null or fn_es_gestor()) and (
      fn_es_gestor() or fn_rol() in ('marketing','tecnico')
      or (fn_rol() = 'comercial' and fn_comercial_ve_cliente(id))
      or (fn_rol() = 'distribuidor' and distribuidor_id = fn_distribuidor())
    ));

drop policy if exists clientes_update on clientes;
create policy clientes_update on clientes for update to authenticated
  using (
    fn_es_gestor() or fn_rol() = 'tecnico'
    or (fn_rol() = 'comercial' and fn_comercial_ve_cliente(id))
    or (fn_rol() = 'distribuidor' and distribuidor_id = fn_distribuidor())
  );

drop policy if exists opps_select on oportunidades;
create policy opps_select on oportunidades for select to authenticated
  using (
    (deleted_at is null or fn_es_gestor()) and (
      fn_es_gestor()
      or (fn_rol() = 'comercial' and fn_comercial_ve_cliente(cliente_id))
      or (fn_rol() = 'distribuidor' and exists (
            select 1 from clientes c where c.id = cliente_id and c.distribuidor_id = fn_distribuidor()))
    ));

drop policy if exists opps_update on oportunidades;
create policy opps_update on oportunidades for update to authenticated
  using (fn_es_gestor() or (fn_rol() = 'comercial' and fn_comercial_ve_cliente(cliente_id)));
