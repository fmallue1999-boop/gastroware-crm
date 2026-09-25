-- 027: Etapa 2, punto 2.2 — la consulta del formulario web entra con fecha.
-- Desde la migración 026 el próximo contacto vive en el interés; fn_lead_web
-- seguía creando una tarea (que ya no se muestra en ningún lado) y dejaba el
-- interés sin fecha, así que la consulta web no aparecía en Hoy. Ahora el
-- interés nace con proximo_contacto = hoy (hora argentina) y la nota
-- "Responder consulta web", sin tarea, y el aviso a dirección apunta a la
-- ficha del contacto. Mismo cuerpo y firma que 008 salvo esas tres cosas.

create or replace function fn_lead_web(
  p_nombre text,
  p_telefono text,
  p_email text,
  p_rubro text,
  p_ciudad text,
  p_mensaje text,
  p_producto text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_cliente_id uuid;
  v_opp_id uuid;
  v_producto_id uuid;
  v_digitos text;
  v_recientes int;
  v_gestor record;
begin
  -- Rate limit: máximo 20 consultas web por hora (anti-spam)
  select count(*) into v_recientes
  from oportunidades
  where origen = 'Web' and created_at > now() - interval '1 hour';
  if v_recientes >= 20 then
    raise exception 'rate_limit';
  end if;

  if coalesce(trim(p_nombre), '') = '' then
    raise exception 'falta_nombre';
  end if;
  if coalesce(trim(p_telefono), '') = '' and coalesce(trim(p_email), '') = '' then
    raise exception 'falta_contacto';
  end if;

  -- Dedup por teléfono normalizado
  v_digitos := regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g');
  if left(v_digitos, 3) = '549' then v_digitos := substr(v_digitos, 4); end if;
  if left(v_digitos, 2) = '54' then v_digitos := substr(v_digitos, 3); end if;

  if length(v_digitos) >= 8 then
    select id into v_cliente_id from clientes
    where regexp_replace(coalesce(telefono, ''), '\D', '', 'g') like '%' || v_digitos || '%'
      and deleted_at is null
    limit 1;
  end if;

  if v_cliente_id is null then
    insert into clientes (nombre_comercial, rubro, telefono, email, estado)
    values (
      left(trim(p_nombre), 120),
      coalesce(nullif(trim(p_rubro), ''), 'Otro'),
      nullif(trim(p_telefono), ''),
      nullif(trim(p_email), ''),
      'prospecto'
    )
    returning id into v_cliente_id;
    if nullif(trim(p_ciudad), '') is not null then
      insert into sucursales (cliente_id, nombre, ciudad, es_principal)
      values (v_cliente_id, 'Principal', left(trim(p_ciudad), 80), true);
    end if;
  end if;

  -- Producto de interés (búsqueda laxa por nombre; puede quedar null)
  if nullif(trim(p_producto), '') is not null then
    select id into v_producto_id from productos
    where activo and nombre ilike '%' || trim(p_producto) || '%'
    limit 1;
  end if;

  -- El interés nace con fecha de hoy: aparece en Hoy y en el embudo
  insert into oportunidades (cliente_id, producto_id, etapa, origen, temperatura, mensaje_inicial,
                             proximo_contacto, proximo_nota)
  values (v_cliente_id, v_producto_id, 'nueva', 'Web', 'tibio', left(coalesce(p_mensaje, ''), 2000),
          (now() at time zone 'America/Argentina/Buenos_Aires')::date, 'Responder consulta web')
  returning id into v_opp_id;

  insert into actividades (cliente_id, oportunidad_id, tipo, contenido)
  values (v_cliente_id, v_opp_id, 'nota', 'Consulta desde el formulario web');

  -- Avisar a dirección y administración
  for v_gestor in select id from usuarios where rol in ('direccion','admin') and activo loop
    insert into notificaciones (usuario_id, tipo, titulo, cuerpo, url)
    values (v_gestor.id, 'lead_web',
            'Nueva consulta web: ' || left(trim(p_nombre), 60),
            left(coalesce(p_mensaje, ''), 200),
            '/clientes/' || v_cliente_id || '?interes=' || v_opp_id);
  end loop;

  return jsonb_build_object('ok', true);
end $$;

revoke all on function fn_lead_web(text,text,text,text,text,text,text) from public;
grant execute on function fn_lead_web(text,text,text,text,text,text,text) to anon;
grant execute on function fn_lead_web(text,text,text,text,text,text,text) to authenticated;
