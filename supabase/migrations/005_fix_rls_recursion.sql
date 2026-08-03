-- =============================================================
-- Migración 005 — Fix: recursión infinita en políticas RLS
-- El ciclo: clientes_select consultaba ordenes_trabajo en contexto
-- de usuario, y ot_select consultaba clientes en contexto de usuario
-- (rama distribuidor). Se rompen ambos lados con funciones
-- security definer, que evalúan sin RLS.
-- =============================================================

create or replace function fn_tecnico_asignado_a_cliente(cid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from ordenes_trabajo o
    where o.cliente_id = cid and o.tecnico_id = auth.uid())
$$;

create or replace function fn_cliente_de_mi_cartera(cid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from clientes c
    where c.id = cid and c.distribuidor_id = fn_distribuidor())
$$;

-- clientes: reemplazar la rama de técnico (inline) por la función definer
drop policy if exists clientes_select on clientes;
create policy clientes_select on clientes for select to authenticated
  using (
    (deleted_at is null or fn_es_gestor()) and (
      fn_es_gestor() or fn_rol() = 'marketing'
      or (fn_rol() = 'comercial' and (comercial_id = auth.uid() or comercial_id is null))
      or (fn_rol() = 'distribuidor' and distribuidor_id = fn_distribuidor())
      or (fn_rol() = 'tecnico' and fn_tecnico_asignado_a_cliente(id))
    ));

-- ordenes_trabajo: reemplazar la rama de distribuidor (inline) por la función definer
drop policy if exists ot_select on ordenes_trabajo;
create policy ot_select on ordenes_trabajo for select to authenticated
  using (
    (deleted_at is null or fn_es_gestor()) and (
      fn_es_gestor()
      or (fn_rol() = 'tecnico' and tecnico_id = auth.uid())
      or (fn_rol() = 'comercial' and fn_puede_ver_cliente(cliente_id))
      or (fn_rol() = 'distribuidor' and fn_cliente_de_mi_cartera(cliente_id))
    ));

-- oportunidades: misma rama de distribuidor inline → definer (previene ciclos futuros)
drop policy if exists opps_select on oportunidades;
create policy opps_select on oportunidades for select to authenticated
  using (
    (deleted_at is null or fn_es_gestor()) and (
      fn_es_gestor()
      or (fn_rol() = 'comercial' and (comercial_id = auth.uid() or comercial_id is null))
      or (fn_rol() = 'distribuidor' and fn_cliente_de_mi_cartera(cliente_id))
    ));
