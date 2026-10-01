-- 036: Material, la biblioteca comercial (v1.11).
-- Marca → categoría (productos o accesorios) → producto → Videos | Imágenes
-- | Ficha, más la identidad de cada marca (catálogo general, logo,
-- tipografías). Lista propia, editable desde la pantalla; cada producto se
-- puede vincular con el del Catálogo para que su ficha también se anexe al
-- PDF de la cotización. Lo ve todo el equipo; cargan marketing y dirección.
-- Solo agrega tablas, funciones, políticas, un bucket y datos iniciales. Idempotente.

-- =====================================================================
-- 1. Quién carga y ordena el material
-- =====================================================================
create or replace function fn_gestiona_material() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from usuarios u
    where u.id = auth.uid() and u.activo and u.rol in ('marketing', 'direccion', 'admin')
  );
$$;
revoke execute on function fn_gestiona_material() from public, anon;
grant execute on function fn_gestiona_material() to authenticated;

-- =====================================================================
-- 2. Marcas, categorías y productos
-- =====================================================================
create table if not exists material_marcas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(trim(nombre)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  orden int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists material_categorias (
  id uuid primary key default gen_random_uuid(),
  marca_id uuid not null references material_marcas(id) on delete cascade,
  nombre text not null check (length(trim(nombre)) > 0),
  seccion text not null default 'productos' check (seccion in ('productos', 'accesorios')),
  orden int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists material_categorias_marca_idx on material_categorias (marca_id, seccion, orden);

create table if not exists material_productos (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references material_categorias(id) on delete restrict,
  nombre text not null check (length(trim(nombre)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  orden int not null default 0,
  -- Vínculo con el producto del Catálogo (su ficha se anexa a la cotización)
  producto_id uuid references productos(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists material_productos_categoria_idx on material_productos (categoria_id, orden);
create index if not exists material_productos_producto_idx on material_productos (producto_id);

-- =====================================================================
-- 3. Archivos: de la marca (catálogo general, logo, tipografías) o del
--    producto (videos con su tipo, imágenes, ficha)
-- =====================================================================
create table if not exists material_archivos (
  id uuid primary key default gen_random_uuid(),
  dueno text not null check (dueno in ('marca', 'producto')),
  dueno_id uuid not null,
  espacio text not null check (espacio in ('catalogo', 'logo', 'tipografias', 'videos', 'imagenes', 'ficha')),
  video_tipo text check (video_tipo in ('usar', 'configurar', 'lavar', 'otro')),
  path text not null unique,
  nombre text not null,
  mime text,
  tamano bigint,
  created_at timestamptz not null default now(),
  created_by uuid references usuarios(id) on delete set null default auth.uid(),
  check ((dueno = 'marca') = (espacio in ('catalogo', 'logo', 'tipografias'))),
  check ((espacio = 'videos') = (video_tipo is not null))
);
create index if not exists material_archivos_dueno_idx on material_archivos (dueno, dueno_id, espacio);

-- Al borrar una marca o un producto, sus filas de archivos se van también
-- (los objetos del almacenamiento los borra la app antes)
create or replace function fn_material_borra_archivos() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from material_archivos
  where dueno = case when tg_table_name = 'material_marcas' then 'marca' else 'producto' end
    and dueno_id = old.id;
  return old;
end $$;
drop trigger if exists tg_material_marca_archivos on material_marcas;
create trigger tg_material_marca_archivos after delete on material_marcas
  for each row execute function fn_material_borra_archivos();
drop trigger if exists tg_material_producto_archivos on material_productos;
create trigger tg_material_producto_archivos after delete on material_productos
  for each row execute function fn_material_borra_archivos();

drop trigger if exists tg_audit_material_productos on material_productos;
create trigger tg_audit_material_productos after insert or update or delete on material_productos
  for each row execute function fn_audit();
drop trigger if exists tg_audit_material_archivos on material_archivos;
create trigger tg_audit_material_archivos after insert or delete on material_archivos
  for each row execute function fn_audit();

-- =====================================================================
-- 4. Permisos: todo el equipo ve y descarga; cargan marketing y dirección
-- =====================================================================
alter table material_marcas enable row level security;
alter table material_categorias enable row level security;
alter table material_productos enable row level security;
alter table material_archivos enable row level security;

do $$
declare t text;
begin
  foreach t in array array['material_marcas', 'material_categorias', 'material_productos', 'material_archivos'] loop
    execute format('drop policy if exists %I on %I', t || '_select', t);
    execute format('create policy %I on %I for select to authenticated using (auth.uid() is not null)', t || '_select', t);
    execute format('drop policy if exists %I on %I', t || '_write', t);
    execute format('create policy %I on %I for all to authenticated using (fn_gestiona_material()) with check (fn_gestiona_material())', t || '_write', t);
  end loop;
end $$;

-- Bucket privado (links firmados). 500 MB por archivo; el plan de Supabase
-- puede limitar menos (plan gratis: 50 MB).
insert into storage.buckets (id, name, public, file_size_limit)
values ('material', 'material', false, 524288000)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists material_obj_select on storage.objects;
create policy material_obj_select on storage.objects for select to authenticated
  using (bucket_id = 'material' and auth.uid() is not null);
drop policy if exists material_obj_insert on storage.objects;
create policy material_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'material' and fn_gestiona_material());
drop policy if exists material_obj_delete on storage.objects;
create policy material_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'material' and fn_gestiona_material());

-- =====================================================================
-- 5. Datos iniciales (los nombres se corrigen desde la pantalla)
-- =====================================================================
insert into material_marcas (nombre, slug, orden) values
  ('JETINNO', 'jetinno', 1),
  ('GASTROWARE', 'gastroware', 2),
  ('ZUMEX', 'zumex', 3)
on conflict (slug) do nothing;

-- Categorías (solo si la marca todavía no tiene ninguna con ese nombre)
insert into material_categorias (marca_id, nombre, seccion, orden)
select m.id, c.nombre, c.seccion, c.orden
from (values
  ('jetinno', 'CAFETERAS', 'productos', 1),
  ('jetinno', 'ACCESORIOS', 'accesorios', 1),
  ('gastroware', 'LICUADORAS', 'productos', 1),
  ('gastroware', 'CALENTADOR', 'productos', 2),
  ('gastroware', 'OTROS', 'productos', 3),
  ('zumex', 'JUGUERAS', 'productos', 1)
) as c(marca, nombre, seccion, orden)
join material_marcas m on m.slug = c.marca
where not exists (select 1 from material_categorias x where x.marca_id = m.id and x.nombre = c.nombre);

-- Productos, vinculados al del Catálogo cuando existe
insert into material_productos (categoria_id, nombre, slug, orden, producto_id)
select cat.id, p.nombre, p.slug, p.orden, (select pr.id from productos pr where pr.nombre = p.catalogo limit 1)
from (values
  ('jetinno', 'CAFETERAS', 'JL15', 'jl15', 1, 'Jetinno JL15'),
  ('jetinno', 'CAFETERAS', 'JL31', 'jl31', 2, 'Jetinno JL31B'),
  ('jetinno', 'CAFETERAS', 'JL36', 'jl36', 3, 'Jetinno JL36A'),
  ('jetinno', 'CAFETERAS', 'JL38', 'jl38', 4, 'Jetinno JL38A'),
  ('jetinno', 'CAFETERAS', 'JL60', 'jl60', 5, 'Jetinno JL60B'),
  ('jetinno', 'ACCESORIOS', 'JA15', 'ja15', 1, 'Jetinno JA15B'),
  ('jetinno', 'ACCESORIOS', 'JA16', 'ja16', 2, 'Jetinno JA16 — Dispensador de vasos'),
  ('jetinno', 'ACCESORIOS', 'JA19', 'ja19', 3, 'Jetinno JA19-B — Máquina de vapor'),
  ('jetinno', 'ACCESORIOS', 'JA20', 'ja20', 4, 'Jetinno JA20 — Espumador de leche'),
  ('jetinno', 'ACCESORIOS', 'MC6D', 'mc6d', 5, 'Jetinno MC6D — Heladera de leche 6,5 L'),
  ('jetinno', 'ACCESORIOS', 'JMC16', 'jmc16', 6, 'Jetinno JMC16 — Heladera de leche 16 L'),
  ('gastroware', 'LICUADORAS', 'GX18', 'gx18', 1, 'GastroWare GX18'),
  ('gastroware', 'LICUADORAS', 'GX22', 'gx22', 2, 'Licuadora GX22'),
  ('gastroware', 'CALENTADOR', 'Calentador', 'calentador', 1, null),
  ('zumex', 'JUGUERAS', 'Multifruit', 'multifruit', 1, 'Zumex Multifruit'),
  ('zumex', 'JUGUERAS', 'Soul Series 2', 'soul-series-2', 2, 'Zumex Soul Series 2'),
  ('zumex', 'JUGUERAS', 'Essential Basic', 'essential-basic', 3, 'Zumex Essential Basic'),
  ('zumex', 'JUGUERAS', 'Essential Pro', 'essential-pro', 4, 'Zumex Essential Pro'),
  ('zumex', 'JUGUERAS', 'Versatile Basic', 'versatile-basic', 5, 'Zumex Versatile Basic'),
  ('zumex', 'JUGUERAS', 'Versatile Pro', 'versatile-pro', 6, 'Zumex Versatile Pro'),
  ('zumex', 'JUGUERAS', 'Versatile Star', 'versatile-star', 7, 'Zumex Versatile Star'),
  ('zumex', 'JUGUERAS', 'Speed Up', 'speed-up', 8, 'Zumex Speed Up'),
  ('zumex', 'JUGUERAS', 'Speed S+Plus', 'speed-s-plus', 9, 'Zumex Speed S+ Plus'),
  ('zumex', 'JUGUERAS', 'Speed S+Plus Tank', 'speed-s-plus-tank', 10, null),
  ('zumex', 'JUGUERAS', 'Pineomatic', 'pineomatic', 11, null)
) as p(marca, categoria, nombre, slug, orden, catalogo)
join material_marcas m on m.slug = p.marca
join material_categorias cat on cat.marca_id = m.id and cat.nombre = p.categoria
on conflict (slug) do nothing;
