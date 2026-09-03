-- 021: equipos pre-vendidos / comprometidos (ventas de feria)
-- Nuevo estado inicial opcional del pedido: comprometido (vendido o señado,
-- entrega a coordinar), con fecha estimada de entrega.
alter table oportunidades drop constraint if exists oportunidades_pedido_estado_check;
alter table oportunidades add constraint oportunidades_pedido_estado_check
  check (pedido_estado in
    ('comprometido','facturar','pendiente_pago','preparar_envio','para_entregar','entregado','finalizado'));
alter table oportunidades add column if not exists entrega_estimada date;
