-- 018: campañas por email (Resend)
-- - asunto del email en la campaña
-- - estado "error" por destinatario (con el detalle del error)
alter table campanias add column if not exists asunto text;
alter table campania_destinatarios add column if not exists error text;
alter table campania_destinatarios drop constraint if exists campania_destinatarios_estado_check;
alter table campania_destinatarios add constraint campania_destinatarios_estado_check
  check (estado in ('pendiente','enviado','salteado','error'));
