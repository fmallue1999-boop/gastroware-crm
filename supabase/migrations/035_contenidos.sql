-- 035: Calendario de contenidos (v1.10).
-- Una ficha = un contenido para redes (cuenta, fecha, tipo, copy, archivos)
-- con su propio estado. El calendario y el listado son vistas de las fichas.
-- Marketing (y dirección) cargan; solo dirección general aprueba, pide
-- re-edición o cancela. Lo ven marketing, dirección y a quien se habilite.
-- Solo agrega tablas, una columna, funciones, políticas y un bucket. Idempotente.

-- =====================================================================
-- 1. Quién ve el calendario: marketing y dirección siempre; el resto si se
--    lo habilita dirección en Administración → Usuarios.
-- =====================================================================
alter table usuarios add column if not exists ve_contenidos boolean not null default false;

-- Solo los gestores cambian quién ve el calendario (nadie se habilita solo)
create or replace function fn_protege_usuarios() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.rol is distinct from old.rol then
    if fn_rol() <> 'direccion' then
      raise exception 'Solo dirección puede cambiar puestos';
    end if;
    if old.id = auth.uid() then
      raise exception 'No podés cambiar tu propio puesto';
    end if;
  end if;
  if (new.distribuidor_id is distinct from old.distribuidor_id
      or new.activo is distinct from old.activo
      or new.territorio is distinct from old.territorio
      or new.ve_contenidos is distinct from old.ve_contenidos)
     and not fn_es_gestor() then
    raise exception 'Sin permiso para modificar territorio, distribuidor, estado o permisos del usuario';
  end if;
  return new;
end $$;

create or replace function fn_ve_contenidos() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from usuarios u
    where u.id = auth.uid() and u.activo
      and (u.rol in ('marketing', 'direccion', 'admin') or u.ve_contenidos)
  );
$$;

create or replace function fn_carga_contenidos() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from usuarios u
    where u.id = auth.uid() and u.activo and u.rol in ('marketing', 'direccion', 'admin')
  );
$$;

revoke execute on function fn_ve_contenidos() from public, anon;
revoke execute on function fn_carga_contenidos() from public, anon;
grant execute on function fn_ve_contenidos() to authenticated;
grant execute on function fn_carga_contenidos() to authenticated;

-- =====================================================================
-- 2. Fichas de contenido
-- =====================================================================
create table if not exists contenidos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(trim(nombre)) > 0),
  cuenta text not null check (cuenta in ('gastroware', 'zumex', 'colaboracion')),
  -- Solo fecha (sin hora): no se corre por la zona horaria
  fecha date not null,
  tipo text not null check (tipo in ('historia', 'feed')),
  objetivo text,
  copy text,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobado', 'reedicion', 'cancelado')),
  correccion text,
  created_at timestamptz not null default now(),
  created_by uuid references usuarios(id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid references usuarios(id) on delete set null default auth.uid()
);
create index if not exists contenidos_fecha_idx on contenidos (fecha);

create table if not exists contenido_archivos (
  id uuid primary key default gen_random_uuid(),
  contenido_id uuid not null references contenidos(id) on delete cascade,
  path text not null unique,
  nombre text not null,
  mime text,
  tamano bigint,
  created_at timestamptz not null default now(),
  created_by uuid references usuarios(id) on delete set null default auth.uid()
);
create index if not exists contenido_archivos_contenido_idx on contenido_archivos (contenido_id);

-- Quién y cuándo tocó cada ficha; solo dirección general aprueba, pide
-- re-edición, cancela o escribe la corrección. Los demás solo la dejan
-- (o la vuelven a poner) pendiente de aprobación.
create or replace function fn_contenido_guardia() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if auth.uid() is not null then
    new.updated_by := auth.uid();
  end if;
  if auth.uid() is null or fn_rol() = 'direccion' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.estado <> 'pendiente' then
      raise exception 'Solo dirección aprueba: el contenido queda pendiente de aprobación';
    end if;
    if coalesce(new.correccion, '') <> '' then
      raise exception 'La corrección la escribe dirección';
    end if;
  else
    if new.estado is distinct from old.estado and new.estado <> 'pendiente' then
      raise exception 'Solo dirección aprueba, pide re-edición o cancela';
    end if;
    if new.correccion is distinct from old.correccion then
      raise exception 'La corrección la escribe dirección';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists tg_contenido_guardia on contenidos;
create trigger tg_contenido_guardia before insert or update on contenidos
  for each row execute function fn_contenido_guardia();

drop trigger if exists tg_audit_contenidos on contenidos;
create trigger tg_audit_contenidos after insert or update or delete on contenidos
  for each row execute function fn_audit();

-- =====================================================================
-- 3. Permisos: ven los habilitados; cargan marketing y dirección
-- =====================================================================
alter table contenidos enable row level security;
alter table contenido_archivos enable row level security;

drop policy if exists contenidos_select on contenidos;
create policy contenidos_select on contenidos for select to authenticated using (fn_ve_contenidos());
drop policy if exists contenidos_insert on contenidos;
create policy contenidos_insert on contenidos for insert to authenticated with check (fn_carga_contenidos());
drop policy if exists contenidos_update on contenidos;
create policy contenidos_update on contenidos for update to authenticated using (fn_carga_contenidos()) with check (fn_carga_contenidos());
drop policy if exists contenidos_delete on contenidos;
create policy contenidos_delete on contenidos for delete to authenticated using (fn_carga_contenidos());

drop policy if exists contenido_archivos_select on contenido_archivos;
create policy contenido_archivos_select on contenido_archivos for select to authenticated using (fn_ve_contenidos());
drop policy if exists contenido_archivos_insert on contenido_archivos;
create policy contenido_archivos_insert on contenido_archivos for insert to authenticated with check (fn_carga_contenidos());
drop policy if exists contenido_archivos_delete on contenido_archivos;
create policy contenido_archivos_delete on contenido_archivos for delete to authenticated using (fn_carga_contenidos());

-- =====================================================================
-- 4. Archivos: bucket privado (imágenes y videos, links firmados)
--    Límite por archivo 500 MB; el plan de Supabase puede limitar menos
--    (plan gratis: 50 MB por archivo).
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contenidos', 'contenidos', false, 524288000, array['image/*', 'video/*'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists contenidos_obj_select on storage.objects;
create policy contenidos_obj_select on storage.objects for select to authenticated
  using (bucket_id = 'contenidos' and fn_ve_contenidos());
drop policy if exists contenidos_obj_insert on storage.objects;
create policy contenidos_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'contenidos' and fn_carga_contenidos());
drop policy if exists contenidos_obj_delete on storage.objects;
create policy contenidos_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'contenidos' and fn_carga_contenidos());
