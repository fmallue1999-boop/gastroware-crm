-- 029: Tareas y agenda del equipo (v1.2).
-- Tareas sueltas, reuniones, capacitaciones y recordatorios de pago que
-- cualquiera crea y asigna a una o varias personas. Aparecen en Mi día y en
-- /tareas (lista y calendario) y avisan en la campana y en el celular.
-- No tiene que ver con la tabla "tareas" (seguimientos automáticos de
-- clientes). Solo agrega tablas y una columna: no toca datos existentes.
-- Idempotente: se puede volver a correr.

-- =====================================================================
-- 1. Agenda: cada tarea, reunión, capacitación o pago
-- =====================================================================
create table if not exists agenda (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(btrim(titulo)) between 1 and 200),
  tipo text not null default 'tarea'
    check (tipo in ('tarea','reunion','capacitacion','pago','otro')),
  descripcion text,
  fecha date not null,
  hora time,
  hora_fin time,
  lugar text,
  links jsonb not null default '[]'::jsonb check (jsonb_typeof(links) = 'array'),
  monto numeric check (monto is null or monto >= 0),
  moneda text not null default 'ARS' check (moneda in ('ARS','USD')),
  -- Días antes de la fecha en que llega el aviso (además del día mismo)
  aviso_dias int not null default 0 check (aviso_dias between 0 and 30),
  -- Las repetidas comparten serie (cada fecha es una fila propia)
  serie_id uuid,
  repite text check (repite in ('semanal','quincenal','mensual')),
  creada_por uuid not null references usuarios(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists agenda_fecha_idx on agenda (fecha);
create index if not exists agenda_creador_idx on agenda (creada_por, fecha);
create index if not exists agenda_serie_idx on agenda (serie_id, fecha) where serie_id is not null;

-- Quiénes la tienen y si ya la hicieron (cada uno marca lo suyo)
create table if not exists agenda_personas (
  agenda_id uuid not null references agenda(id) on delete cascade,
  usuario_id uuid not null references usuarios(id) on delete cascade,
  hecha_at timestamptz,
  -- Último día en que se le mandó el aviso (evita repetirlo)
  avisado_el date,
  primary key (agenda_id, usuario_id)
);
create index if not exists agenda_personas_usuario_idx on agenda_personas (usuario_id, hecha_at);

-- El creador no cambia y se registra la última modificación
create or replace function fn_agenda_touch() returns trigger
language plpgsql set search_path = public as $$
begin
  new.creada_por := old.creada_por;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists tg_agenda_touch on agenda;
create trigger tg_agenda_touch before update on agenda
  for each row execute function fn_agenda_touch();

-- Auditoría como el resto de las tablas
drop trigger if exists tg_audit_agenda on agenda;
create trigger tg_audit_agenda after insert or update or delete on agenda
  for each row execute function fn_audit();

-- =====================================================================
-- 2. Permisos
--    Ve una tarea: quien la creó, quienes la tienen y dirección.
--    La cambia o la borra: quien la creó y dirección. Si la tiene una sola
--    persona, esa persona también la puede cambiar (mover de día, etc.).
--    Cada uno marca como hecha la suya.
-- =====================================================================
create or replace function fn_en_agenda(a uuid) returns boolean
language sql security definer stable set search_path = public as
$$ select exists (select 1 from agenda_personas where agenda_id = a and usuario_id = auth.uid()) $$;

create or replace function fn_agenda_propia(a uuid) returns boolean
language sql security definer stable set search_path = public as
$$ select coalesce(fn_es_gestor(), false)
       or exists (select 1 from agenda where id = a and creada_por = auth.uid()) $$;

create or replace function fn_edita_agenda(a uuid) returns boolean
language sql security definer stable set search_path = public as
$$ select fn_agenda_propia(a)
       or (fn_en_agenda(a) and (select count(*) from agenda_personas where agenda_id = a) = 1) $$;

revoke execute on function fn_en_agenda(uuid) from public, anon;
revoke execute on function fn_agenda_propia(uuid) from public, anon;
revoke execute on function fn_edita_agenda(uuid) from public, anon;
grant execute on function fn_en_agenda(uuid) to authenticated, service_role;
grant execute on function fn_agenda_propia(uuid) to authenticated, service_role;
grant execute on function fn_edita_agenda(uuid) to authenticated, service_role;

alter table agenda enable row level security;
alter table agenda_personas enable row level security;

drop policy if exists agenda_select on agenda;
create policy agenda_select on agenda for select to authenticated
  using (creada_por = auth.uid() or coalesce(fn_es_gestor(), false) or fn_en_agenda(id));
drop policy if exists agenda_insert on agenda;
create policy agenda_insert on agenda for insert to authenticated
  with check (creada_por = auth.uid());
drop policy if exists agenda_update on agenda;
create policy agenda_update on agenda for update to authenticated
  using (fn_edita_agenda(id)) with check (fn_edita_agenda(id));
drop policy if exists agenda_delete on agenda;
create policy agenda_delete on agenda for delete to authenticated
  using (fn_agenda_propia(id));

drop policy if exists agenda_personas_select on agenda_personas;
create policy agenda_personas_select on agenda_personas for select to authenticated
  using (usuario_id = auth.uid() or fn_en_agenda(agenda_id) or fn_agenda_propia(agenda_id));
drop policy if exists agenda_personas_insert on agenda_personas;
create policy agenda_personas_insert on agenda_personas for insert to authenticated
  with check (fn_agenda_propia(agenda_id));
drop policy if exists agenda_personas_update on agenda_personas;
create policy agenda_personas_update on agenda_personas for update to authenticated
  using (usuario_id = auth.uid() or fn_agenda_propia(agenda_id))
  with check (usuario_id = auth.uid() or fn_agenda_propia(agenda_id));
drop policy if exists agenda_personas_delete on agenda_personas;
create policy agenda_personas_delete on agenda_personas for delete to authenticated
  using (fn_agenda_propia(agenda_id));

-- =====================================================================
-- 3. Avisos al celular: cada aviso de la campana se manda una sola vez
-- =====================================================================
alter table notificaciones add column if not exists push_at timestamptz;
create index if not exists notif_push_idx on notificaciones (created_at) where push_at is null;
