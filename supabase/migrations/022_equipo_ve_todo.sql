-- 022: CRM simple para un equipo chico. Todos (dirección, administración,
-- comerciales, marketing y técnicos) ven todos los contactos; comerciales y
-- gestores ven todas las consultas y ventas. Antes cada comercial veía solo
-- lo suyo o lo sin asignar, y los contactos cargados por Franco quedaban
-- invisibles para el resto del equipo.

create or replace function fn_puede_ver_cliente(cid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select fn_es_gestor()
    or fn_rol() in ('marketing','tecnico','comercial')
    or (fn_rol() = 'distribuidor' and exists (
          select 1 from clientes c where c.id = cid
            and c.distribuidor_id = fn_distribuidor()))
$$;

drop policy if exists clientes_select on clientes;
create policy clientes_select on clientes for select to authenticated
  using (
    (deleted_at is null or fn_es_gestor()) and (
      fn_es_gestor() or fn_rol() in ('marketing','tecnico','comercial')
      or (fn_rol() = 'distribuidor' and distribuidor_id = fn_distribuidor())
    ));

drop policy if exists clientes_update on clientes;
create policy clientes_update on clientes for update to authenticated
  using (
    fn_es_gestor() or fn_rol() in ('comercial','tecnico')
    or (fn_rol() = 'distribuidor' and distribuidor_id = fn_distribuidor())
  );

drop policy if exists opps_select on oportunidades;
create policy opps_select on oportunidades for select to authenticated
  using (
    (deleted_at is null or fn_es_gestor()) and (
      fn_es_gestor() or fn_rol() = 'comercial'
      or (fn_rol() = 'distribuidor' and exists (
            select 1 from clientes c where c.id = cliente_id and c.distribuidor_id = fn_distribuidor()))
    ));

drop policy if exists opps_update on oportunidades;
create policy opps_update on oportunidades for update to authenticated
  using (fn_es_gestor() or fn_rol() = 'comercial');
