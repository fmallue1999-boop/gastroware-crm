-- 010: Etapa 6 — IA con límites de costo y registro auditable
-- Reglas del spec: la IA solo ve lo que el usuario puede ver (las consultas
-- pasan por RLS con la sesión del usuario), salidas validadas por esquema,
-- vista previa + aprobación humana, límite diario configurable.

create table if not exists ia_usos (
  id bigint generated always as identity primary key,
  usuario_id uuid references usuarios(id),
  funcion text not null,
  tokens_entrada int not null default 0,
  tokens_salida int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists ia_usos_fecha_idx on ia_usos (created_at desc);

alter table ia_usos enable row level security;
-- Cada usuario registra su propio uso; solo gestores ven el total
create policy ia_usos_ins on ia_usos for insert to authenticated
  with check (usuario_id = auth.uid());
create policy ia_usos_sel on ia_usos for select to authenticated
  using (fn_es_gestor() or usuario_id = auth.uid());

-- Límite de llamadas de IA por día (todo el equipo). 0 = IA apagada.
insert into config (clave, valor) values ('ia_limite_diario', '100')
on conflict (clave) do nothing;
