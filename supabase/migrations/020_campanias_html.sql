-- 020: email diseñado por IA — la campaña puede llevar un HTML completo
-- (si está, el envío usa ese diseño; si no, la plantilla de texto de siempre).
alter table campanias add column if not exists html text;
