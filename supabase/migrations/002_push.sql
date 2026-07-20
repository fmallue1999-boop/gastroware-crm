-- Migración 002: suscripciones de notificaciones push
-- Ejecutar en Supabase: Dashboard → SQL Editor → New query → Run

create table if not exists push_subs (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references usuarios(id) on delete cascade,
  endpoint text unique not null,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);

alter table push_subs enable row level security;
drop policy if exists "autenticados todo" on push_subs;
create policy "autenticados todo" on push_subs
  for all to authenticated using (true) with check (true);
