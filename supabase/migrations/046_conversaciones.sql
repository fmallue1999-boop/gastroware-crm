-- 046: Conversaciones (v1.24): el chat interno de cada cotización.
-- Pedido de dirección: "dentro de cada cotización, un chat para anotar cosas o
-- conversar acerca de las cotizaciones, con notificaciones y @".
-- Una conversación por cotización (tipo 'cotizacion'); la ve y escribe quien
-- puede ver la cotización. Queda preparado el tipo 'equipo' (chat general del
-- equipo, para más adelante). Nunca sale en el PDF.
-- Las tablas se llaman chats / chat_mensajes / chat_lecturas porque
-- "conversaciones" y "mensajes" ya existen (008, WhatsApp oficial, sin usar).
-- Idempotente.

create table if not exists chats (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('cotizacion', 'equipo')),
  cotizacion_id uuid unique references cotizaciones(id) on delete cascade,
  nombre text,
  ultimo_mensaje_at timestamptz,
  created_at timestamptz not null default now(),
  check ((tipo = 'cotizacion') = (cotizacion_id is not null))
);

create table if not exists chat_mensajes (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references chats(id) on delete cascade,
  autor_id uuid references usuarios(id) on delete set null default auth.uid(),
  texto text not null check (length(trim(texto)) between 1 and 4000),
  -- Versión de la cotización cuando se escribió (para "sobre v2")
  version int,
  -- A quiénes se mencionó con @
  menciones uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists chat_mensajes_chat_idx on chat_mensajes (chat_id, created_at);

-- Hasta dónde leyó cada uno (para marcar lo nuevo)
create table if not exists chat_lecturas (
  chat_id uuid not null references chats(id) on delete cascade,
  usuario_id uuid not null references usuarios(id) on delete cascade,
  leido_at timestamptz not null default now(),
  primary key (chat_id, usuario_id)
);

-- Al escribir, la conversación guarda cuándo fue el último mensaje
create or replace function fn_chat_ultimo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update chats set ultimo_mensaje_at = new.created_at where id = new.chat_id;
  return new;
end $$;
drop trigger if exists tg_chat_ultimo on chat_mensajes;
create trigger tg_chat_ultimo after insert on chat_mensajes
  for each row execute function fn_chat_ultimo();

-- =====================================================================
-- Permisos: la conversación de una cotización la ve quien ve la cotización
-- (la política de cotizaciones decide); la del equipo, todos.
-- =====================================================================
alter table chats enable row level security;
alter table chat_mensajes enable row level security;
alter table chat_lecturas enable row level security;

drop policy if exists chats_select on chats;
create policy chats_select on chats for select to authenticated
  using (tipo = 'equipo' or exists (select 1 from cotizaciones q where q.id = cotizacion_id));
drop policy if exists chats_insert on chats;
create policy chats_insert on chats for insert to authenticated
  with check (
    (tipo = 'cotizacion' and exists (select 1 from cotizaciones q where q.id = cotizacion_id))
    or (tipo = 'equipo' and (select fn_es_gestor()))
  );

drop policy if exists chat_mensajes_select on chat_mensajes;
create policy chat_mensajes_select on chat_mensajes for select to authenticated
  using (exists (select 1 from chats c where c.id = chat_id));
drop policy if exists chat_mensajes_insert on chat_mensajes;
create policy chat_mensajes_insert on chat_mensajes for insert to authenticated
  with check (autor_id = (select auth.uid()) and exists (select 1 from chats c where c.id = chat_id));
drop policy if exists chat_mensajes_delete on chat_mensajes;
create policy chat_mensajes_delete on chat_mensajes for delete to authenticated
  using (autor_id = (select auth.uid()));

drop policy if exists chat_lecturas_propias on chat_lecturas;
create policy chat_lecturas_propias on chat_lecturas for all to authenticated
  using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));

-- Marca para saber que se aplicó
insert into config (clave, valor) values ('migracion_046', 'aplicada') on conflict (clave) do update set valor = excluded.valor;
