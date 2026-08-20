-- 019: campañas en borrador — se diseñan y guardan, y se activan cuando
-- el usuario quiere empezar a enviar (recién ahí se congela la lista).
alter table campanias drop constraint if exists campanias_estado_check;
alter table campanias add constraint campanias_estado_check
  check (estado in ('borrador','en_curso','pausada','terminada'));
