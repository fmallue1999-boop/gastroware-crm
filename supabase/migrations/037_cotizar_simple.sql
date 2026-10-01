-- 037: Cotizar simple para el vendedor (v1.12).
-- El IVA lo define cada producto (no el que cotiza), la moneda de cotización
-- la fija dirección (dólares) y las formas de pago, plazos y condiciones de
-- entrega salen de listas precargadas que edita dirección.
-- Solo agrega columnas y datos de configuración. Idempotente.

-- =====================================================================
-- 1. IVA de cada producto (equipos 10,5%; consumibles y repuestos 21%)
-- =====================================================================
alter table productos add column if not exists iva_pct numeric
  check (iva_pct is null or (iva_pct >= 0 and iva_pct <= 27));
update productos
   set iva_pct = case when es_consumible or categoria in ('consumible', 'repuesto', 'refaccion') then 21 else 10.5 end
 where iva_pct is null;
alter table productos alter column iva_pct set default 10.5;

-- Cada línea de la cotización guarda el IVA del producto al cotizar
alter table cotizacion_items add column if not exists iva_pct numeric
  check (iva_pct is null or (iva_pct >= 0 and iva_pct <= 27));

-- =====================================================================
-- 2. Configuración de la cotización (Administración → Marca)
-- =====================================================================
insert into config (clave, valor) values
  ('cotizacion_moneda', 'USD'),
  ('cotizacion_formas_pago', E'Contado (transferencia)\nContado (efectivo)\n50% de anticipo y saldo antes de despachar\nCheque o e-cheq\nTarjeta de crédito\nMercado Pago\nCuenta corriente (condición aprobada)'),
  ('cotizacion_plazos_entrega', E'Inmediata (con stock)\n7 días\n15 días\n30 días\nA confirmar'),
  ('cotizacion_condiciones_entrega', E'A cargo del cliente\nRetira en nuestro local\nEnvío incluido en Mar del Plata\nEnvío por transporte a cargo del cliente')
on conflict (clave) do nothing;

-- =====================================================================
-- 3. Primer contacto: lo marca cualquier contacto anotado sobre el interés
--    (antes solo contaba si lo anotaba el vendedor asignado: si dirección
--    lo contactaba o el interés estaba a nombre de otro, seguía "sin primer
--    contacto"). La nota de alta de la consulta va como tipo 'consulta' y
--    no cuenta.
-- =====================================================================
create or replace function fn_toca_interes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.oportunidad_id is not null then
    update oportunidades
       set ultimo_movimiento_at = now(),
           primer_contacto_at = case
             when primer_contacto_at is null
              and new.tipo in ('nota','cotizacion')
              and new.created_by is not null
             then now() else primer_contacto_at end
     where id = new.oportunidad_id;
  end if;
  return new;
end $$;

-- =====================================================================
-- 4. El apartado sale del producto también cuando se cambia el producto
--    (antes solo al crear: un interés sin producto quedaba fuera del embudo)
-- =====================================================================
create or replace function fn_linea_oportunidad() returns trigger
language plpgsql set search_path = public as $$
declare v_cons boolean; v_cat text;
begin
  -- Al crear, solo si no se indicó otro apartado; al cambiar el producto,
  -- solo entre equipos y consumibles (los pedidos de repuesto no se tocan)
  if new.producto_id is not null and (
       (tg_op = 'INSERT' and coalesce(new.linea, 'equipos') = 'equipos')
    or (tg_op = 'UPDATE' and new.producto_id is distinct from old.producto_id and coalesce(new.linea, 'equipos') in ('equipos', 'consumibles'))
  ) then
    select es_consumible, categoria into v_cons, v_cat from productos where id = new.producto_id;
    new.linea := case when v_cons then 'consumibles' when tg_op = 'INSERT' and v_cat in ('repuesto', 'refaccion') then 'repuestos' else 'equipos' end;
  end if;
  if new.linea is null then new.linea := 'equipos'; end if;
  return new;
end $$;
drop trigger if exists tg_linea_oportunidad on oportunidades;
create trigger tg_linea_oportunidad before insert or update of producto_id on oportunidades
  for each row execute function fn_linea_oportunidad();

