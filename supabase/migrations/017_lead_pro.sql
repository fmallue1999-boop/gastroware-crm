-- 017: alta de lead pro
-- - productos_extra: la consulta puede ser por 2+ productos (el principal
--   sigue en producto_id; el resto acá como array jsonb de ids).
-- - pedido: qué pidió el cliente al entrar (precio / info / general),
--   define el guión y la primera tarea.
alter table oportunidades add column if not exists productos_extra jsonb not null default '[]';
alter table oportunidades add column if not exists pedido text
  check (pedido in ('precio','info','general'));
