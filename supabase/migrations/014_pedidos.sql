-- 014: etapas de venta simples + circuito de pedido post-venta
-- Etapas quedan: nueva → cotizada → seguimiento → ganada / perdida
-- (diagnostico se pliega en nueva; negociacion en seguimiento).
-- Al ganar, el pedido sigue su propio circuito:
-- facturar → pendiente_pago → preparar_envio → para_entregar → entregado → finalizado

do $$ declare c text; begin
  select conname into c from pg_constraint
   where conrelid = 'oportunidades'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) like '%etapa%';
  if c is not null then
    execute format('alter table oportunidades drop constraint %I', c);
  end if;
end $$;

update oportunidades set etapa = 'nueva' where etapa = 'diagnostico';
update oportunidades set etapa = 'seguimiento' where etapa = 'negociacion';

alter table oportunidades add constraint oportunidades_etapa_check
  check (etapa in ('nueva','cotizada','seguimiento','ganada','perdida'));

alter table oportunidades add column if not exists pedido_estado text
  check (pedido_estado in
    ('facturar','pendiente_pago','preparar_envio','para_entregar','entregado','finalizado'));
alter table oportunidades add column if not exists entregado_at timestamptz;

-- Ventas ya ganadas arrancan el circuito en "emitir factura"
update oportunidades set pedido_estado = 'facturar'
 where etapa = 'ganada' and pedido_estado is null;
