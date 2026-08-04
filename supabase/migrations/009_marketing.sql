-- 009: Etapa 5 — Marketing (campañas WhatsApp asistidas)
-- Canal principal: WhatsApp MANUAL asistido (decisión de Franco: sin API).
-- El canal email queda modelado y se activa cuando exista RESEND_API_KEY.

-- Exclusión de comunicaciones (baja / no molestar)
alter table clientes add column if not exists no_contactar boolean not null default false;

-- Vincular tareas a un equipo (dedup de avisos de garantía por vencer)
alter table tareas add column if not exists equipo_id uuid references equipos(id) on delete set null;

create table if not exists campanias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  canal text not null default 'whatsapp' check (canal in ('whatsapp','email')),
  filtros jsonb not null default '{}',
  plantilla text not null,
  estado text not null default 'en_curso' check (estado in ('en_curso','pausada','terminada')),
  creado_por uuid references usuarios(id),
  created_at timestamptz not null default now()
);

create table if not exists campania_destinatarios (
  id uuid primary key default gen_random_uuid(),
  campania_id uuid not null references campanias(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  estado text not null default 'pendiente' check (estado in ('pendiente','enviado','salteado')),
  enviado_at timestamptz,
  enviado_por uuid references usuarios(id),
  unique (campania_id, cliente_id)
);
create index if not exists campdest_campania_idx on campania_destinatarios (campania_id, estado);

alter table campanias enable row level security;
alter table campania_destinatarios enable row level security;

-- Leer: todo el equipo. Escribir: dirección, administración y marketing.
create policy campanias_sel on campanias for select to authenticated using (true);
create policy campanias_write on campanias for all to authenticated
  using (fn_es_gestor() or fn_rol() = 'marketing')
  with check (fn_es_gestor() or fn_rol() = 'marketing');
create policy campdest_sel on campania_destinatarios for select to authenticated using (true);
create policy campdest_write on campania_destinatarios for all to authenticated
  using (fn_es_gestor() or fn_rol() = 'marketing')
  with check (fn_es_gestor() or fn_rol() = 'marketing');

-- Auditoría
create trigger tr_audit_campanias after insert or update or delete on campanias
  for each row execute function fn_audit();
create trigger tr_audit_campdest after insert or update or delete on campania_destinatarios
  for each row execute function fn_audit();
