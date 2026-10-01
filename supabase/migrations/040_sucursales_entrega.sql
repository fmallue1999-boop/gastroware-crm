-- 040: Sucursales y puntos de entrega (v1.14).
-- Una razón social puede tener varias sucursales o puntos de entrega. Cada una
-- suma quién recibe y el horario / indicaciones para entregar, y al cotizar se
-- elige dónde se entrega (sale en el PDF). Idempotente.

alter table sucursales add column if not exists recibe text;
alter table sucursales add column if not exists indicaciones text;

-- Lugar de entrega elegido en cada versión de la cotización
alter table cotizacion_versiones add column if not exists sucursal_id uuid references sucursales(id) on delete set null;

-- Clientes con sucursales pero ninguna principal: la más vieja pasa a principal
update sucursales s set es_principal = true
 where s.deleted_at is null
   and not exists (select 1 from sucursales t where t.cliente_id = s.cliente_id and t.es_principal and t.deleted_at is null)
   and s.id = (select u.id from sucursales u where u.cliente_id = s.cliente_id and u.deleted_at is null order by u.created_at, u.id limit 1);

-- Último nombre con una letra rota de la importación vieja ("Ä" + control → "Ā")
update clientes set nombre_comercial = replace(nombre_comercial, chr(196) || chr(128), chr(256))
 where position(chr(196) || chr(128) in nombre_comercial) > 0;
