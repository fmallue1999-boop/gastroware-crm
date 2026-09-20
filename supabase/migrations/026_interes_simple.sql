-- 026: Etapa 1 — un interés, una próxima fecha.
-- El próximo contacto vive en el interés (oportunidades), no en una tabla
-- de tareas. Los pendientes del inicio se calculan a partir de eso. La tabla
-- tareas queda para servicio técnico, recompras y (Etapa 4) cobranzas.

alter table oportunidades
  add column if not exists proximo_contacto date,
  add column if not exists proximo_nota text,
  add column if not exists ultimo_movimiento_at timestamptz not null default now();

create index if not exists opps_proximo_idx on oportunidades (comercial_id, proximo_contacto)
  where etapa in ('nueva','cotizada','seguimiento','espera');

-- Migrar las tareas manuales pendientes de ventas al interés (la más próxima por oportunidad).
update oportunidades o set
  proximo_contacto = t.vence_el,
  proximo_nota = t.titulo
from (
  select distinct on (oportunidad_id) oportunidad_id, vence_el, titulo
  from tareas
  where completada_at is null and not cancelada and oportunidad_id is not null
    and tipo in ('seguimiento','otro')
  order by oportunidad_id, vence_el
) t
where o.id = t.oportunidad_id and o.etapa in ('nueva','cotizada','seguimiento','espera');

-- Los "volver a contactar" agendados sobre el contacto (sin interés) pasan
-- al interés abierto más reciente de ese contacto, si lo tiene.
update oportunidades o set
  proximo_contacto = t.vence_el,
  proximo_nota = t.titulo
from (
  select distinct on (cliente_id) cliente_id, vence_el, titulo
  from tareas
  where completada_at is null and not cancelada and oportunidad_id is null
    and auto = false and tipo in ('seguimiento','otro')
  order by cliente_id, vence_el
) t
where o.cliente_id = t.cliente_id
  and o.etapa in ('nueva','cotizada','seguimiento','espera')
  and o.proximo_contacto is null
  and o.id = (
    select id from oportunidades x
    where x.cliente_id = o.cliente_id
      and x.etapa in ('nueva','cotizada','seguimiento','espera')
    order by created_at desc limit 1
  );

-- Las tareas migradas se cancelan (se conserva el historial).
update tareas set cancelada = true
where completada_at is null and not cancelada
  and tipo in ('seguimiento','otro')
  and (oportunidad_id is not null or auto = false);

-- Trigger: cualquier actividad sobre un interés actualiza ultimo_movimiento_at.
create or replace function fn_toca_interes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.oportunidad_id is not null then
    update oportunidades set ultimo_movimiento_at = now() where id = new.oportunidad_id;
  end if;
  return new;
end $$;
drop trigger if exists trg_toca_interes on actividades;
create trigger trg_toca_interes after insert on actividades
  for each row execute function fn_toca_interes();

-- Descuento atómico de stock al entregar una venta (y suma si se vuelve
-- atrás). Único descuento automático; los ajustes manuales siguen siendo
-- de gestores. Security definer: el vendedor que marca "Entregado" no tiene
-- permiso de escribir productos.
create or replace function fn_ajustar_stock(p_producto_id uuid, p_delta int) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_stock int;
begin
  update productos
     set stock = greatest(0, coalesce(stock, 0) + p_delta)
   where id = p_producto_id
  returning stock into v_stock;
  return v_stock;
end $$;
revoke execute on function fn_ajustar_stock(uuid, int) from anon;
