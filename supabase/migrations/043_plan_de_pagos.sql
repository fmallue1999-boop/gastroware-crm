-- 043: Plan de pagos de la venta (v1.18).
-- Con "Anticipo + saldo", cheque o cuenta corriente, el vendedor carga cómo se
-- paga: partes (anticipo / saldo) y pagos con % del total, a cuántos días y con
-- qué medio. Se guarda en la venta (lib/plan-pago.ts: { total, moneda, grupos }).
-- La forma de pago "Anticipo y saldo antes de despachar" pasa a llamarse
-- "Anticipo + saldo" (el saldo puede ser antes de despachar o contra entrega).
-- Idempotente.

alter table oportunidades add column if not exists plan_pago jsonb;

update oportunidades
   set forma_pago = 'Anticipo + saldo'
 where forma_pago = 'Anticipo y saldo antes de despachar';

-- Marca para saber que se aplicó
insert into config (clave, valor) values ('migracion_043', 'aplicada') on conflict (clave) do update set valor = excluded.valor;
