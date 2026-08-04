-- 015: numero de factura de la venta (se pide al pasar el pedido de
-- "emitir factura" a "pendiente de pago", junto con la serie del equipo).
alter table oportunidades add column if not exists nro_factura text;
