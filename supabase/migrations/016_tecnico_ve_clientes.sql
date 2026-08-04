-- 016: el técnico ve todos los clientes (y sus equipos/sucursales/documentos).
-- Antes solo veía los clientes de sus OTs asignadas, pero necesita buscar
-- cualquier cliente para abrir órdenes y consultar equipos por serie.
-- Las oportunidades/ventas siguen cerradas para el técnico (política aparte).

create or replace function fn_puede_ver_cliente(cid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select fn_es_gestor()
    or fn_rol() in ('marketing','tecnico')
    or (fn_rol() = 'comercial' and exists (
          select 1 from clientes c where c.id = cid
            and (c.comercial_id = auth.uid() or c.comercial_id is null)))
    or (fn_rol() = 'distribuidor' and exists (
          select 1 from clientes c where c.id = cid
            and c.distribuidor_id = fn_distribuidor()))
$$;

drop policy if exists clientes_select on clientes;
create policy clientes_select on clientes for select to authenticated
  using (
    (deleted_at is null or fn_es_gestor()) and (
      fn_es_gestor() or fn_rol() in ('marketing','tecnico')
      or (fn_rol() = 'comercial' and (comercial_id = auth.uid() or comercial_id is null))
      or (fn_rol() = 'distribuidor' and distribuidor_id = fn_distribuidor())
    ));
