-- Puesta a cero de octubre 2026 (docs/ARRANQUE-OCTUBRE.md).
-- NO es una migración: se corre UNA vez, a mano, con el OK de dirección y
-- después de aplicar 027 y 028. Conserva contactos, historial, ventas en curso
-- y services; solo cierra el trabajo comercial abierto que no refleja la
-- realidad, para que cada vendedor arranque octubre con lo que está vivo.
--
-- Paso 1 (vista previa, no cambia nada): correr solo este bloque.
-- Paso 2: correr el bloque de cambios (una transacción).

-- ============================== VISTA PREVIA ==============================
select
  count(*) filter (where etapa in ('nueva','cotizada','seguimiento')
                     and ultimo_movimiento_at < now() - interval '30 days') as se_cierran,
  count(*) filter (where etapa in ('nueva','cotizada','seguimiento')
                     and ultimo_movimiento_at >= now() - interval '30 days') as quedan_abiertos,
  count(*) filter (where etapa = 'espera') as lista_de_espera_queda
from oportunidades
where deleted_at is null;

-- ============================== CAMBIOS ==================================
-- begin;
--
-- -- 1) Intereses sin movimiento real en 30 días: se cierran con un motivo
-- --    propio (no cuentan como "no se dio" de un vendedor en el tablero de
-- --    octubre porque se cierran antes del 1°). La lista de espera queda.
-- with cerrados as (
--   update oportunidades
--      set etapa = 'perdida',
--          closed_at = now(),
--          motivo_perdida = 'Puesta a cero octubre 2026 (sin movimiento)',
--          proximo_contacto = null,
--          proximo_nota = null
--    where deleted_at is null
--      and etapa in ('nueva','cotizada','seguimiento')
--      and ultimo_movimiento_at < now() - interval '30 days'
--   returning id, cliente_id
-- )
-- insert into actividades (cliente_id, oportunidad_id, tipo, contenido)
-- select cliente_id, id, 'cambio_etapa', 'Cerrado en la puesta a cero de octubre (sin movimiento en 30 días)'
--   from cerrados;
--
-- -- 2) Los que quedan abiertos sin fecha: próximo contacto el 1° de octubre,
-- --    para que aparezcan en Mi día de su vendedor.
-- update oportunidades
--    set proximo_contacto = '2026-10-01', proximo_nota = 'Retomar (arranque de octubre)'
--  where deleted_at is null
--    and etapa in ('nueva','cotizada','seguimiento')
--    and proximo_contacto is null;
--
-- commit;
