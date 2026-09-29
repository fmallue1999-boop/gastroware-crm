-- 034: Cotización en PDF (v1.8).
-- El PDF de la cotización con el membrete de la empresa, número de
-- comprobante (punto de venta + número), IVA, condiciones de entrega, leyenda
-- del dólar y las fichas de los productos anexadas al final.
-- Solo agrega columnas, datos de configuración y una función; no borra nada.
-- Idempotente.

-- =====================================================================
-- 1. Datos de la empresa para el encabezado (se editan en Administración)
-- =====================================================================
insert into config (clave, valor) values
  ('empresa_razon_social', 'GASTROWARE COMPANY S.A.'),
  ('empresa_telefono', '2233400755'),
  ('empresa_direccion', 'MITRE 2007'),
  ('empresa_localidad', 'MAR DEL PLATA'),
  ('empresa_email', 'info@gastroware.com.ar'),
  ('empresa_condicion_iva', 'Responsable Inscripto'),
  ('empresa_cuit', '30-71905618-7'),
  ('empresa_iibb', '30-71905618-7'),
  ('empresa_inicio_actividades', '29/08/2025'),
  ('cotizacion_punto_venta', '0007'),
  ('cotizacion_leyenda_usd', 'El monto de los ítems equivale a {total}. El cliente podrá abonar los ítems en pesos argentinos aplicando el valor de cambio tipo vendedor de la moneda extranjera del presente, informada por el BNA, correspondiente al día del efectivo pago. Se genera Nota de Débito o Crédito según cambio del dólar del día de pago.')
on conflict (clave) do nothing;

-- =====================================================================
-- 2. Producto: código y detalle técnico (la segunda línea en la cotización)
-- =====================================================================
alter table productos add column if not exists codigo text;
alter table productos add column if not exists detalle_tecnico text;

-- Cada línea de la cotización guarda el código y el detalle del momento
alter table cotizacion_items add column if not exists codigo text;
alter table cotizacion_items add column if not exists detalle text;

-- =====================================================================
-- 3. Cotización: IVA, entrega y tipo de cambio
--    total sigue siendo el neto (sin IVA), como hasta ahora; iva_pct es el
--    IVA que se suma en el PDF (0 = no se discrimina).
-- =====================================================================
alter table cotizacion_versiones add column if not exists iva_pct numeric
  check (iva_pct is null or (iva_pct >= 0 and iva_pct <= 27));
alter table cotizacion_versiones add column if not exists plazo_entrega text;
alter table cotizacion_versiones add column if not exists condicion_entrega text;
alter table cotizacion_versiones add column if not exists tipo_cambio numeric
  check (tipo_cambio is null or tipo_cambio > 0);

-- =====================================================================
-- 4. Fichas de producto (PDF o imagen) que se anexan a la cotización
-- =====================================================================
do $$
declare c text;
begin
  for c in select conname from pg_constraint
            where conrelid = 'documentos'::regclass and contype = 'c'
              and (pg_get_constraintdef(oid) ilike '%entidad%' or pg_get_constraintdef(oid) ilike '%tipo%')
  loop
    execute format('alter table documentos drop constraint %I', c);
  end loop;
end $$;
alter table documentos add constraint documentos_entidad_check
  check (entidad in ('cliente','equipo','orden','oportunidad','repuesto','producto'));
alter table documentos add constraint documentos_tipo_check
  check (tipo in ('factura','remito','manual','contrato','foto','ficha','otro'));

-- Las fichas del catálogo las ve todo el equipo (las usa cualquier cotización)
drop policy if exists documentos_select on documentos;
create policy documentos_select on documentos for select to authenticated
  using (
    fn_ve_todo()
    or (entidad = 'cliente' and fn_puede_ver_cliente(entidad_id))
    or (entidad = 'equipo' and exists (
          select 1 from equipos e where e.id = entidad_id and fn_puede_ver_cliente(e.cliente_id)))
    or (entidad = 'orden' and exists (
          select 1 from ordenes_trabajo o where o.id = entidad_id
            and (o.tecnico_id = auth.uid() or fn_puede_ver_cliente(o.cliente_id))))
    or (entidad = 'oportunidad' and exists (
          select 1 from oportunidades op where op.id = entidad_id and op.comercial_id = auth.uid()))
    or entidad in ('repuesto', 'producto'));

-- =====================================================================
-- 5. Numeración: dirección fija desde qué número siguen las cotizaciones
-- =====================================================================
create or replace function fn_proximo_numero_cotizacion(p_numero int) returns void
language plpgsql security definer set search_path = public as $$
declare v_max int;
begin
  if not coalesce(fn_es_gestor(), false) then
    raise exception 'Solo dirección puede cambiar la numeración';
  end if;
  select coalesce(max(numero), 0) into v_max from cotizaciones;
  if p_numero <= v_max then
    raise exception 'El próximo número tiene que ser mayor que el último emitido (%)', v_max;
  end if;
  execute format('alter table cotizaciones alter column numero restart with %s', p_numero);
end $$;
revoke execute on function fn_proximo_numero_cotizacion(int) from public, anon;
grant execute on function fn_proximo_numero_cotizacion(int) to authenticated;
