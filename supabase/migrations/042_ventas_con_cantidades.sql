-- 042: Ventas con cantidades (v1.16).
-- Al cerrar una venta se creaba UN solo equipo, y solo del primer producto.
-- Ahora: un equipo por unidad de cada producto de la venta (el principal y los
-- extra, con la cantidad de oportunidad_items; si no hay, 1), cada uno con su
-- garantía y en la sucursal de la venta. Consumibles y repuestos siguen igual.
-- Devuelve el primer equipo creado (como antes). Idempotente.

create or replace function fn_ganar_venta(
  p_oportunidad_id uuid,
  p_numero_serie text default null,
  p_fecha_compra date default null
) returns uuid
language plpgsql set search_path = public as $$
declare
  v_opp oportunidades%rowtype;
  v_prod record;
  v_consumible record;
  v_item record;
  v_equipo_id uuid;
  v_primero uuid;
  v_unidades int;
  k int;
  v_fecha date := coalesce(p_fecha_compra, (now() at time zone 'America/Argentina/Buenos_Aires')::date);
begin
  select * into v_opp from oportunidades where id = p_oportunidad_id for update;
  if not found then
    raise exception 'Oportunidad no encontrada';
  end if;
  if v_opp.etapa = 'ganada' then
    select id into v_equipo_id from equipos
     where oportunidad_id = p_oportunidad_id and deleted_at is null
     order by created_at
     limit 1;
    return v_equipo_id;
  end if;

  update oportunidades
     set etapa = 'ganada', closed_at = now(), pedido_estado = 'comprometido'
   where id = p_oportunidad_id;
  update tareas set cancelada = true
   where oportunidad_id = p_oportunidad_id and completada_at is null;
  update clientes set estado = 'cliente_activo' where id = v_opp.cliente_id;

  -- Consumibles de la venta (el principal y los extra): cada uno a su plan
  for v_item in
    select p.id, i.cantidad, i.unidad
      from productos p
      left join oportunidad_items i on i.oportunidad_id = p_oportunidad_id and i.producto_id = p.id
     where p.es_consumible
       and (p.id = v_opp.producto_id or coalesce(v_opp.productos_extra, '[]'::jsonb) ? p.id::text)
  loop
    perform fn_reponer(v_opp.cliente_id, v_item.id, v_opp.sucursal_id, v_fecha, v_item.cantidad, v_item.unidad, p_oportunidad_id);
  end loop;

  -- Equipos: uno por unidad de cada producto (principal primero)
  for v_prod in
    select p.id, p.garantia_meses, p.modelo_id,
           greatest(1, coalesce((select round(sum(i.cantidad))::int from oportunidad_items i
                                  where i.oportunidad_id = p_oportunidad_id and i.producto_id = p.id), 1)) as unidades,
           (p.id = v_opp.producto_id) as principal
      from productos p
     where not p.es_consumible
       and coalesce(p.categoria, '') not in ('repuesto', 'refaccion')
       and (p.id = v_opp.producto_id or coalesce(v_opp.productos_extra, '[]'::jsonb) ? p.id::text)
     order by (p.id = v_opp.producto_id) desc, p.nombre
  loop
    v_unidades := least(v_prod.unidades, 500);
    for k in 1..v_unidades loop
      insert into equipos (cliente_id, producto_id, modelo_id, sucursal_id, numero_serie, origen,
                           fecha_venta, garantia_hasta, comercial_id, oportunidad_id)
      values (v_opp.cliente_id, v_prod.id, v_prod.modelo_id, v_opp.sucursal_id,
              case when v_prod.principal and k = 1 then nullif(trim(coalesce(p_numero_serie, '')), '') else null end,
              'vendido', v_fecha,
              case when v_prod.garantia_meses is not null
                   then (v_fecha + (v_prod.garantia_meses || ' months')::interval)::date
                   else null end,
              v_opp.comercial_id, p_oportunidad_id)
      returning id into v_equipo_id;
      v_primero := coalesce(v_primero, v_equipo_id);
    end loop;

    -- El consumible del equipo vendido (ej. pastillas del horno) arranca su plan
    select id into v_consumible from productos where consumible_de = v_prod.id and es_consumible limit 1;
    if v_consumible.id is not null then
      perform fn_reponer(v_opp.cliente_id, v_consumible.id, v_opp.sucursal_id, v_fecha, null, null, null);
    end if;
  end loop;

  insert into actividades (cliente_id, oportunidad_id, tipo, contenido, created_by)
  values (v_opp.cliente_id, p_oportunidad_id, 'cambio_etapa', 'Venta cerrada', auth.uid());

  return v_primero;
end $$;

-- Marca para saber que se aplicó
insert into config (clave, valor) values ('migracion_042', 'aplicada') on conflict (clave) do update set valor = excluded.valor;
