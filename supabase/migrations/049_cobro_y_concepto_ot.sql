-- 049: Servicio técnico (v1.27). Pedido de dirección: "que se puedan cobrar
-- horas de trabajo en garantía" y "que se determine el concepto para
-- facturarlo: no por horas, sino 'ST XXX - Cambio de luz por garantía
-- (Movilidad)'".
-- - horas_cobrar: las horas que se cobran (null = automático: las
--   trabajadas si es facturable; 0 si es garantía o contrato).
-- - cobro_como: cómo se cobran esas horas (mano de obra, movilidad, visita
--   técnica, diagnóstico): va entre paréntesis en el concepto.
-- - concepto_factura: el renglón de la factura (null = el sugerido).
-- - facturas.concepto: el concepto con que se facturó (queda en Cobranzas).
-- Idempotente.

alter table ordenes_trabajo
  add column if not exists horas_cobrar numeric,
  add column if not exists cobro_como text,
  add column if not exists concepto_factura text;

alter table ordenes_trabajo drop constraint if exists ordenes_trabajo_horas_cobrar_check;
alter table ordenes_trabajo add constraint ordenes_trabajo_horas_cobrar_check
  check (horas_cobrar is null or (horas_cobrar >= 0 and horas_cobrar <= 200));
alter table ordenes_trabajo drop constraint if exists ordenes_trabajo_cobro_como_check;
alter table ordenes_trabajo add constraint ordenes_trabajo_cobro_como_check
  check (cobro_como is null or cobro_como in ('mano_de_obra', 'movilidad', 'visita', 'diagnostico'));

alter table facturas add column if not exists concepto text;

-- Marca para saber que se aplicó
insert into config (clave, valor) values ('migracion_049', 'aplicada') on conflict (clave) do update set valor = excluded.valor;
