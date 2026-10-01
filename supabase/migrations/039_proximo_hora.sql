-- 039: Reprogramar con hora (v1.13).
-- El próximo contacto de un interés puede tener hora ("más tarde hoy, a las
-- 16"), para que Mi día los ordene y lo diga. Si otra acción cambia la fecha
-- sin decir hora (anotar un contacto, cotizar, la cadencia…), la hora vieja
-- deja de valer y se borra sola. Idempotente.

alter table oportunidades add column if not exists proximo_hora time;

create or replace function fn_hora_proximo() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.proximo_contacto is distinct from old.proximo_contacto
     and new.proximo_hora is not distinct from old.proximo_hora then
    new.proximo_hora := null;
  end if;
  return new;
end $$;

drop trigger if exists tg_hora_proximo on oportunidades;
create trigger tg_hora_proximo before update of proximo_contacto on oportunidades
  for each row execute function fn_hora_proximo();
