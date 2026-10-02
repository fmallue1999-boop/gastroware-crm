-- 045: Espacios propios en Material y pedidos de contenido con aprobación (v1.23).
-- Pedido de dirección: "que marketing pueda crear espacios para subir contenido
-- de distinta índole" y "el pedido de contenido: se pide, marketing lo hace y lo
-- sube, dirección lo aprueba o pide cambios, y después queda en Material".
--
-- 1. material_espacios: espacios que crea marketing (generales, de una marca o
--    de un producto). Sus archivos son material_archivos con dueno='espacio' y
--    espacio='propio' (cualquier tipo de archivo).
-- 2. Lo que marketing entrega de un pedido: material_archivos con
--    dueno='pedido' y espacio='entrega'. Al aprobarse pasan a un espacio.
-- 3. pedidos_material: estados para_aprobar / cambios / aprobado / cancelado,
--    la corrección de dirección y el espacio de destino. Solo dirección aprueba,
--    pide cambios o cancela (también puede cancelar quien lo pidió).
-- Idempotente.

-- =====================================================================
-- 1. Espacios propios
-- =====================================================================
create table if not exists material_espacios (
  id uuid primary key default gen_random_uuid(),
  ambito text not null check (ambito in ('general', 'marca', 'producto')),
  ambito_id uuid,
  nombre text not null check (length(trim(nombre)) between 1 and 80),
  descripcion text,
  orden int not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references usuarios(id) on delete set null default auth.uid(),
  check ((ambito = 'general') = (ambito_id is null))
);
create index if not exists material_espacios_ambito_idx on material_espacios (ambito, ambito_id);

alter table material_espacios enable row level security;
drop policy if exists material_espacios_select on material_espacios;
create policy material_espacios_select on material_espacios for select to authenticated using ((select auth.uid()) is not null);
drop policy if exists material_espacios_write on material_espacios;
create policy material_espacios_write on material_espacios for all to authenticated
  using ((select fn_gestiona_material())) with check ((select fn_gestiona_material()));

drop trigger if exists tg_audit_material_espacios on material_espacios;
create trigger tg_audit_material_espacios after insert or update or delete on material_espacios
  for each row execute function fn_audit();

-- El espacio donde caen los pedidos aprobados (marketing después lo acomoda)
insert into material_espacios (ambito, nombre, descripcion, orden)
select 'general', 'Pedidos aprobados', 'Lo que dirección aprobó de los pedidos de contenido. Marketing lo acomoda donde corresponda.', 0
where not exists (select 1 from material_espacios where ambito = 'general' and nombre = 'Pedidos aprobados');

-- =====================================================================
-- 2. Archivos: dueños "espacio" y "pedido"
-- =====================================================================
do $$
declare c record;
begin
  for c in select conname from pg_constraint where conrelid = 'material_archivos'::regclass and contype = 'c' loop
    execute format('alter table material_archivos drop constraint %I', c.conname);
  end loop;
end $$;

alter table material_archivos
  add constraint material_archivos_dueno_check check (dueno in ('marca', 'producto', 'espacio', 'pedido')),
  add constraint material_archivos_espacio_check check (espacio in ('catalogo', 'logo', 'tipografias', 'videos', 'imagenes', 'ficha', 'propio', 'entrega')),
  add constraint material_archivos_video_tipo_check check (video_tipo in ('usar', 'configurar', 'lavar', 'otro')),
  add constraint material_archivos_de_marca check ((dueno = 'marca') = (espacio in ('catalogo', 'logo', 'tipografias'))),
  add constraint material_archivos_de_producto check ((dueno = 'producto') = (espacio in ('videos', 'imagenes', 'ficha'))),
  add constraint material_archivos_de_espacio check ((dueno = 'espacio') = (espacio = 'propio')),
  add constraint material_archivos_de_pedido check ((dueno = 'pedido') = (espacio = 'entrega')),
  add constraint material_archivos_video check ((espacio = 'videos') = (video_tipo is not null));

-- De qué pedido salió el archivo (sigue aunque marketing lo mueva de espacio)
alter table material_archivos add column if not exists pedido_id uuid references pedidos_material(id) on delete set null;
create index if not exists material_archivos_pedido_idx on material_archivos (pedido_id) where pedido_id is not null;

-- Al borrar un espacio se van sus archivos; al borrar una marca o un producto,
-- también sus espacios (los objetos del almacenamiento los borra la app antes)
create or replace function fn_material_borra_archivos() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_dueno text;
begin
  v_dueno := case tg_table_name
    when 'material_marcas' then 'marca'
    when 'material_productos' then 'producto'
    when 'material_espacios' then 'espacio'
    else 'pedido' end;
  delete from material_archivos where dueno = v_dueno and dueno_id = old.id;
  if tg_table_name in ('material_marcas', 'material_productos') then
    delete from material_espacios where ambito = v_dueno and ambito_id = old.id;
  end if;
  return old;
end $$;
drop trigger if exists tg_material_espacio_archivos on material_espacios;
create trigger tg_material_espacio_archivos after delete on material_espacios
  for each row execute function fn_material_borra_archivos();

-- =====================================================================
-- 3. Pedidos de contenido con aprobación
-- =====================================================================
alter table pedidos_material
  add column if not exists tomado_por uuid references usuarios(id) on delete set null,
  add column if not exists enviado_at timestamptz,
  add column if not exists correccion text,
  add column if not exists revisado_por uuid references usuarios(id) on delete set null,
  add column if not exists revisado_at timestamptz,
  add column if not exists espacio_destino_id uuid references material_espacios(id) on delete set null;

do $$
declare c record;
begin
  for c in select conname from pg_constraint
            where conrelid = 'pedidos_material'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%estado%' loop
    execute format('alter table pedidos_material drop constraint %I', c.conname);
  end loop;
end $$;
alter table pedidos_material add constraint pedidos_material_estado_check
  check (estado in ('pedido', 'en_curso', 'para_aprobar', 'cambios', 'aprobado', 'entregado', 'cancelado'));

-- Solo dirección aprueba, pide cambios o escribe la corrección; cancelar también puede quien lo pidió
create or replace function fn_pedido_material_guardia() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or fn_rol() = 'direccion' then
    return new;
  end if;
  if new.estado is distinct from old.estado and new.estado in ('aprobado', 'cambios') then
    raise exception 'Solo dirección aprueba o pide cambios en un pedido de contenido';
  end if;
  if new.estado is distinct from old.estado and new.estado = 'cancelado' and old.pedido_por is distinct from auth.uid() then
    raise exception 'Solo dirección o quien lo pidió puede cancelar el pedido';
  end if;
  if new.correccion is distinct from old.correccion
     or new.revisado_por is distinct from old.revisado_por
     or new.revisado_at is distinct from old.revisado_at then
    raise exception 'Solo dirección escribe la corrección';
  end if;
  return new;
end $$;
drop trigger if exists tg_pedido_material_guardia on pedidos_material;
create trigger tg_pedido_material_guardia before update on pedidos_material
  for each row execute function fn_pedido_material_guardia();

-- Marca para saber que se aplicó
insert into config (clave, valor) values ('migracion_045', 'aplicada') on conflict (clave) do update set valor = excluded.valor;
