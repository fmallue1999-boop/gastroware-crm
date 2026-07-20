-- =============================================================
-- CRM GastroWare — esquema completo
-- Ejecutar una sola vez en Supabase: Dashboard → SQL Editor → New query
-- =============================================================

-- ---------- Usuarios del sistema ----------
create table if not exists usuarios (
  id uuid primary key references auth.users on delete cascade,
  nombre text not null,
  rol text not null default 'vendedor' check (rol in ('admin','vendedor')),
  activo boolean not null default true
);

-- Alta automática en `usuarios` cuando se crea un usuario en Auth
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.usuarios (id, nombre)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Clientes ----------
create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  nombre_comercial text not null,
  razon_social text,
  rubro text not null,
  ciudad text,
  provincia text,
  telefono text,
  email text,
  instagram_web text,
  estado text not null default 'prospecto' check (estado in ('prospecto','cliente_activo','inactivo')),
  potencial text check (potencial in ('alto','medio','bajo')),
  vendedor_id uuid references usuarios(id),
  notas text,
  created_at timestamptz not null default now()
);
create index if not exists clientes_telefono_idx on clientes (telefono);
create index if not exists clientes_rubro_idx on clientes (rubro, estado);

-- ---------- Personas de contacto ----------
create table if not exists contactos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  nombre text not null,
  cargo text,
  telefono text,
  es_decisor boolean not null default false
);

-- ---------- Catálogo de productos ----------
create table if not exists productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  marca text,
  categoria text not null,
  es_consumible boolean not null default false,
  frecuencia_recompra_dias int,
  consumible_de uuid references productos(id),
  precio_referencia numeric,
  moneda text not null default 'ARS',
  activo boolean not null default true
);

-- ---------- Plantillas de mensajes ----------
create table if not exists plantillas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  uso text not null,
  producto_id uuid references productos(id),
  contenido text not null
);

-- ---------- Oportunidades ----------
create table if not exists oportunidades (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  producto_id uuid references productos(id),
  vendedor_id uuid references usuarios(id),
  etapa text not null default 'nueva' check (etapa in
    ('nueva','diagnostico','cotizada','seguimiento','negociacion','ganada','perdida')),
  temperatura text check (temperatura in ('caliente','tibio','frio')),
  origen text not null,
  monto_estimado numeric,
  moneda text not null default 'ARS',
  diagnostico jsonb not null default '{}',
  objecion_principal text,
  motivo_perdida text,
  fecha_cierre_estimada date,
  mensaje_inicial text,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create index if not exists oportunidades_etapa_idx on oportunidades (etapa, vendedor_id);

-- ---------- Cotizaciones ----------
create table if not exists cotizaciones (
  id uuid primary key default gen_random_uuid(),
  oportunidad_id uuid not null references oportunidades(id) on delete cascade,
  monto numeric,
  moneda text not null default 'ARS',
  archivo_url text,
  forma_pago text,
  validez_dias int,
  enviada_at timestamptz not null default now(),
  notas text
);

-- ---------- Recurrencias de consumibles ----------
create table if not exists recurrencias (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  producto_id uuid not null references productos(id),
  frecuencia_dias int not null,
  ultima_compra date,
  proxima_alerta date not null,
  activa boolean not null default true
);

-- ---------- Tareas ----------
create table if not exists tareas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  oportunidad_id uuid references oportunidades(id) on delete cascade,
  recurrencia_id uuid references recurrencias(id) on delete set null,
  vendedor_id uuid references usuarios(id),
  tipo text not null default 'seguimiento' check (tipo in
    ('seguimiento','reactivacion','recompra','postventa','otro')),
  titulo text not null,
  plantilla_id uuid references plantillas(id),
  vence_el date not null,
  auto boolean not null default false,
  completada_at timestamptz,
  cancelada boolean not null default false
);
create index if not exists tareas_pendientes_idx on tareas (vendedor_id, vence_el)
  where completada_at is null and not cancelada;

-- ---------- Equipos instalados ----------
create table if not exists equipos_instalados (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  producto_id uuid not null references productos(id),
  cantidad int not null default 1,
  fecha_compra date,
  oportunidad_id uuid references oportunidades(id),
  notas text
);

-- ---------- Timeline de actividades ----------
create table if not exists actividades (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  oportunidad_id uuid references oportunidades(id) on delete cascade,
  tipo text not null,
  contenido text,
  created_by uuid references usuarios(id),
  created_at timestamptz not null default now()
);
create index if not exists actividades_cliente_idx on actividades (cliente_id, created_at desc);

-- ---------- Biblioteca de materiales ----------
create table if not exists materiales (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text not null,
  producto_id uuid references productos(id),
  url text,
  prioridad text not null default 'alta'
);

-- =============================================================
-- RLS: equipo chico, todos los autenticados ven y editan todo
-- =============================================================
do $$
declare t text;
begin
  foreach t in array array['usuarios','clientes','contactos','productos','plantillas',
    'oportunidades','cotizaciones','recurrencias','tareas','equipos_instalados',
    'actividades','materiales']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "autenticados todo" on %I', t);
    execute format('create policy "autenticados todo" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- =============================================================
-- Storage: bucket para PDFs/fotos de cotizaciones
-- (rutas con UUID => no adivinables)
-- =============================================================
insert into storage.buckets (id, name, public)
values ('cotizaciones', 'cotizaciones', true)
on conflict (id) do nothing;

drop policy if exists "auth sube cotizaciones" on storage.objects;
create policy "auth sube cotizaciones" on storage.objects
  for insert to authenticated with check (bucket_id = 'cotizaciones');

-- =============================================================
-- Seeds: productos
-- =============================================================
insert into productos (nombre, marca, categoria, precio_referencia, moneda) values
  ('GX22', 'GastroWare', 'licuadora', null, 'ARS'),
  ('GX18', 'GastroWare', 'licuadora', null, 'ARS'),
  ('Zumex Speed Pro', 'Zumex', 'exprimidora', null, 'USD'),
  ('Zumex Versatile Pro', 'Zumex', 'exprimidora', null, 'USD'),
  ('Zumex Minex', 'Zumex', 'exprimidora', null, 'USD'),
  ('Horno Rational iCombi', 'Rational', 'horno', null, 'USD'),
  ('Otro producto', null, 'otro', null, 'ARS');

insert into productos (nombre, marca, categoria, es_consumible, frecuencia_recompra_dias, consumible_de, moneda)
select 'Pastillas de limpieza Rational', 'Rational', 'consumible', true, 45, p.id, 'ARS'
from productos p where p.nombre = 'Horno Rational iCombi';

-- =============================================================
-- Seeds: plantillas (textos del análisis comercial, secciones 10 y 11)
-- =============================================================
insert into plantillas (nombre, uso, contenido) values
  ('Seguimiento D+2', 'd2',
   'Buen día {nombre}, ¿cómo estás? Te escribo para hacer seguimiento de la propuesta que vimos. Por el tipo de uso que me comentaste, creo que puede ser una buena opción para mejorar la operación. ¿Querés que lo veamos con alguna alternativa de financiación?'),
  ('Seguimiento D+5 con contenido', 'd5',
   'Hola {nombre}, te comparto este video para que veas mejor el equipo en funcionamiento. Más allá de las características técnicas, lo importante es que está pensado para uso gastronómico y para trabajar con mayor exigencia que una opción común.'),
  ('Seguimiento D+10 diagnóstico', 'd10',
   'Hola {nombre}, te consulto para entender mejor: ¿lo que más te frena hoy es el valor, el momento de compra o que todavía estás comparando alternativas? Así veo si tiene sentido pasarte financiación, otra configuración o dejarlo para más adelante.'),
  ('Reactivación D+20', 'd20',
   'Hola {nombre}, te escribo para cerrar el seguimiento de la consulta. Si todavía tiene sentido evaluarlo, puedo ayudarte a revisar financiación o una alternativa. Si quedó para más adelante, lo dejamos agendado y te vuelvo a contactar.'),
  ('Objeción: precio', 'objecion:precio',
   'Entiendo {nombre}. Para que lo puedas evaluar mejor, más que compararlo solo contra el precio inicial, conviene ver qué problema resuelve y cuánto cuesta trabajar con un equipo que se queda corto o se rompe. Si querés, lo vemos con una opción de pago más gradual.'),
  ('Guion de diagnóstico GX22/GX18', 'diagnostico:gx',
   'Sí, te paso. Antes te hago 3 consultas rápidas así te recomiendo bien: ¿La usarían para licuados, smoothies, frappés, hielo u otro producto? ¿Aproximadamente cuántos usos por día calculan? ¿Hoy ya tienen alguna licuadora o sería una incorporación nueva?'),
  ('Guion de diagnóstico Zumex', 'diagnostico:zumex',
   'Sí, te paso. Antes te hago 3 consultas rápidas así te recomiendo bien: ¿Sería para cafetería, hotel, estación, restaurante u otro tipo de negocio? ¿La idea es sumar jugo natural como producto nuevo o reemplazar una exprimidora actual? ¿Tenés una idea aproximada de cuántos vasos podrían vender por día?'),
  ('Pasar precio GX22', 'precio:gx',
   'Por el uso que me comentás, te recomiendo la GX22. Es una licuadora pensada para operación gastronómica, no para uso doméstico. Tiene cabina acústica, jarra de Tritan, programas automáticos y está preparada para trabajar con licuados, smoothies, frappés y preparaciones con hielo. También tenés respaldo local de GastroWare, garantía, repuestos y servicio técnico. El valor es de {monto} + IVA. También podemos verlo con pago contado, anticipo + cuotas, e-cheqs o financiación.'),
  ('Pasar precio Zumex', 'precio:zumex',
   'Por lo que me comentás, Zumex puede tener mucho sentido si la idea es sumar jugo natural como producto nuevo. Más que verlo solo como una exprimidora, conviene analizarlo como una unidad de negocio: cuántos vasos podés vender por día, a qué precio y en cuánto tiempo recuperás la inversión. El valor es de {monto}. También podemos trabajarlo con anticipo + cuotas, e-cheqs o financiación.'),
  ('Recompra de consumible', 'recompra',
   'Hola {nombre}, ¿cómo va todo? Te escribo porque calculo que ya deben estar necesitando reponer {producto}. ¿Te preparo un pedido como el anterior?');
