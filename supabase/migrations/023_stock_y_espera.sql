-- 023: stock por producto, ingresos previstos y lista de espera.
-- Franco: "un cliente me quiere comprar una JL15 y no tengo stock: lo pongo
-- en lista de espera; los vendedores tienen que ver el stock disponible y
-- lo que va a ingresar y en qué fecha".

alter table productos add column if not exists stock int not null default 0;

create table if not exists ingresos_stock (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references productos(id) on delete cascade,
  cantidad int not null check (cantidad > 0),
  fecha_estimada date,
  recibido_at timestamptz,
  nota text,
  created_by uuid references usuarios(id),
  created_at timestamptz not null default now()
);
create index if not exists ingresos_stock_producto_idx on ingresos_stock (producto_id, recibido_at);

alter table ingresos_stock enable row level security;
drop policy if exists ingresos_select on ingresos_stock;
create policy ingresos_select on ingresos_stock for select to authenticated using (true);
drop policy if exists ingresos_write on ingresos_stock;
create policy ingresos_write on ingresos_stock for all to authenticated
  using (fn_es_gestor()) with check (fn_es_gestor());

-- Nueva etapa "espera": la consulta sigue viva, esperando stock.
alter table oportunidades drop constraint if exists oportunidades_etapa_check;
alter table oportunidades add constraint oportunidades_etapa_check
  check (etapa in ('nueva','cotizada','seguimiento','espera','ganada','perdida'));
