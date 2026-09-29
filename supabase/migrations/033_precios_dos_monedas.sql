-- 033: Precios en pesos y en dólares y descuento especial en la cotización (v1.6).
-- Cada producto puede tener precio de lista en pesos y en dólares (los dos
-- opcionales) y una moneda principal. Al cotizar o vender se elige la moneda
-- y el precio sale del que corresponde. precio_referencia sigue siendo el
-- precio en la moneda principal (lo mantiene un trigger), así lo que ya lo
-- usa sigue andando. Además, las consultas sin monto toman la moneda de su
-- producto (antes quedaban en pesos aunque el equipo fuera en dólares).
-- Solo agrega columnas y completa las nuevas; no borra nada. Idempotente.

alter table productos add column if not exists precio_ars numeric check (precio_ars is null or precio_ars >= 0);
alter table productos add column if not exists precio_usd numeric check (precio_usd is null or precio_usd >= 0);

-- El precio de hoy pasa a la columna de su moneda
update productos set precio_usd = precio_referencia
 where moneda = 'USD' and precio_usd is null and precio_referencia is not null;
update productos set precio_ars = precio_referencia
 where coalesce(moneda, 'ARS') <> 'USD' and precio_ars is null and precio_referencia is not null;

-- precio_referencia = precio en la moneda principal (y al revés, si algo
-- viejo cambia precio_referencia, se copia a la columna de su moneda)
create or replace function fn_producto_precios() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE'
     and new.precio_referencia is distinct from old.precio_referencia
     and new.precio_ars is not distinct from old.precio_ars
     and new.precio_usd is not distinct from old.precio_usd then
    if new.moneda = 'USD' then new.precio_usd := new.precio_referencia;
    else new.precio_ars := new.precio_referencia; end if;
  elsif tg_op = 'INSERT' and new.precio_referencia is not null
        and new.precio_ars is null and new.precio_usd is null then
    if new.moneda = 'USD' then new.precio_usd := new.precio_referencia;
    else new.precio_ars := new.precio_referencia; end if;
  end if;
  new.precio_referencia := case when new.moneda = 'USD' then new.precio_usd else new.precio_ars end;
  return new;
end $$;
drop trigger if exists tg_producto_precios on productos;
create trigger tg_producto_precios before insert or update on productos
  for each row execute function fn_producto_precios();

-- Consultas todavía sin monto: la moneda de su producto
update oportunidades o
   set moneda = p.moneda
  from productos p
 where p.id = o.producto_id
   and o.monto_estimado is null
   and p.moneda in ('ARS','USD')
   and o.moneda is distinct from p.moneda;

-- Cotización: descuento especial pedido para la operación (con su motivo) y
-- el subtotal antes del descuento. Si supera lo que el vendedor puede dar
-- solo, la cotización espera la aprobación de dirección.
alter table cotizacion_versiones add column if not exists subtotal numeric;
alter table cotizacion_versiones add column if not exists descuento_pct numeric
  check (descuento_pct is null or (descuento_pct >= 0 and descuento_pct < 100));
alter table cotizacion_versiones add column if not exists descuento_motivo text;
