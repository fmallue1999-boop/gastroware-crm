-- =============================================================
-- Migración 003: equipos con serie/garantía + servicio técnico
-- Ejecutar en Supabase: Dashboard → SQL Editor → New query → Run
-- =============================================================

-- ---------- Rol técnico ----------
alter table usuarios drop constraint if exists usuarios_rol_check;
alter table usuarios add constraint usuarios_rol_check
  check (rol in ('admin','vendedor','tecnico'));

-- ---------- Garantías por producto (en meses) ----------
alter table productos add column if not exists garantia_meses int;
update productos set garantia_meses = 60 where categoria = 'exprimidora';
update productos set garantia_meses = 12 where categoria = 'licuadora';
update productos set garantia_meses = 12 where categoria = 'horno';

-- ---------- Equipos: serie, origen y garantía ----------
-- Los equipos ajenos no tienen producto del catálogo
alter table equipos_instalados alter column producto_id drop not null;
alter table equipos_instalados add column if not exists numero_serie text;
alter table equipos_instalados add column if not exists marca_modelo text;
alter table equipos_instalados add column if not exists origen text not null default 'vendido';
alter table equipos_instalados add column if not exists garantia_hasta date;
alter table equipos_instalados add column if not exists proximo_service date;
create index if not exists equipos_serie_idx on equipos_instalados (numero_serie);

-- ---------- Configuración simple ----------
create table if not exists config (
  clave text primary key,
  valor text not null
);
insert into config (clave, valor) values
  ('tarifa_hora', '0'),
  ('meses_cliente_dormido', '6')
on conflict (clave) do nothing;

-- ---------- Órdenes de trabajo ----------
create table if not exists ordenes_trabajo (
  id uuid primary key default gen_random_uuid(),
  numero int generated always as identity,
  cliente_id uuid not null references clientes(id) on delete cascade,
  equipo_id uuid references equipos_instalados(id) on delete set null,
  tecnico_id uuid references usuarios(id),
  creado_por uuid references usuarios(id),
  estado text not null default 'abierta' check (estado in
    ('abierta','en_proceso','cerrada_tecnico','facturable','facturada','anulada')),
  tipo text not null default 'correctivo' check (tipo in
    ('correctivo','preventivo','instalacion','garantia')),
  es_garantia boolean not null default false,
  fecha_programada date,
  problema text,
  trabajo_realizado text,
  horas numeric,
  firma_url text,
  firmante text,
  total numeric,
  nro_factura text,
  facturada_at timestamptz,
  created_at timestamptz not null default now(),
  cerrada_at timestamptz
);
create index if not exists ot_estado_idx on ordenes_trabajo (estado, tecnico_id);
create index if not exists ot_agenda_idx on ordenes_trabajo (fecha_programada, tecnico_id);

-- ---------- Ítems de la orden: refacciones y gastos ----------
create table if not exists ot_items (
  id uuid primary key default gen_random_uuid(),
  ot_id uuid not null references ordenes_trabajo(id) on delete cascade,
  tipo text not null check (tipo in ('refaccion','gasto')),
  descripcion text not null,
  producto_id uuid references productos(id),
  cantidad numeric not null default 1,
  precio_unit numeric not null default 0,
  refacturable boolean not null default true,
  comprobante_url text,
  created_at timestamptz not null default now()
);

-- ---------- Fotos del trabajo ----------
create table if not exists ot_fotos (
  id uuid primary key default gen_random_uuid(),
  ot_id uuid not null references ordenes_trabajo(id) on delete cascade,
  url text not null,
  created_at timestamptz not null default now()
);

-- ---------- RLS ----------
do $$
declare t text;
begin
  foreach t in array array['config','ordenes_trabajo','ot_items','ot_fotos']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "autenticados todo" on %I', t);
    execute format('create policy "autenticados todo" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- ---------- Storage para fotos, firmas y tickets ----------
insert into storage.buckets (id, name, public)
values ('servicio', 'servicio', true)
on conflict (id) do nothing;

drop policy if exists "auth sube servicio" on storage.objects;
create policy "auth sube servicio" on storage.objects
  for insert to authenticated with check (bucket_id = 'servicio');

-- ---------- Refacciones de ejemplo en el catálogo ----------
insert into productos (nombre, marca, categoria, moneda) values
  ('Jarra GX22 repuesto', 'GastroWare', 'refaccion', 'ARS'),
  ('Cuchilla GX22', 'GastroWare', 'refaccion', 'ARS'),
  ('Kit gomas Zumex', 'Zumex', 'refaccion', 'ARS')
on conflict do nothing;
