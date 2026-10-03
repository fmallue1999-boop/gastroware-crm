-- 048: La conversación del equipo pasa de la cotización al interés (v1.26).
-- Pedido de dirección: "repensá esto y dónde lo pusiste: ¿no está repetido?
-- Que quede súper pro". Una conversación por interés, desde la consulta
-- hasta la postventa (antes colgaba de la cotización: un interés sin
-- cotizar no tenía, y se mostraba dos veces en la misma ficha).
-- Lo ya escrito pasa al interés de su cotización. Idempotente.

alter table chats add column if not exists oportunidad_id uuid references oportunidades(id) on delete cascade;
create unique index if not exists chats_oportunidad_uq on chats (oportunidad_id) where oportunidad_id is not null;

-- Los permisos viejos miran la cotización: se rehacen abajo
drop policy if exists chats_select on chats;
drop policy if exists chats_insert on chats;
alter table chats drop constraint if exists chats_tipo_check;
alter table chats drop constraint if exists chats_check;

-- Cada conversación de cotización pasa a su interés (si el interés ya tiene
-- una, se juntan los mensajes y las lecturas)
do $$
declare
  r record;
  v_dest uuid;
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'chats' and column_name = 'cotizacion_id') then
    return;
  end if;
  for r in execute 'select c.id, q.oportunidad_id from chats c join cotizaciones q on q.id = c.cotizacion_id where c.cotizacion_id is not null' loop
    select id into v_dest from chats where oportunidad_id = r.oportunidad_id;
    if v_dest is null then
      execute 'update chats set tipo = ''interes'', oportunidad_id = $1, cotizacion_id = null where id = $2' using r.oportunidad_id, r.id;
    else
      update chat_mensajes set chat_id = v_dest where chat_id = r.id;
      insert into chat_lecturas (chat_id, usuario_id, leido_at)
        select v_dest, usuario_id, leido_at from chat_lecturas where chat_id = r.id
        on conflict (chat_id, usuario_id) do update set leido_at = greatest(chat_lecturas.leido_at, excluded.leido_at);
      delete from chats where id = r.id;
      update chats set ultimo_mensaje_at = (select max(created_at) from chat_mensajes where chat_id = v_dest) where id = v_dest;
    end if;
  end loop;
end $$;

alter table chats drop column if exists cotizacion_id;
alter table chats add constraint chats_tipo_check check (tipo in ('interes', 'equipo'));
alter table chats add constraint chats_check check ((tipo = 'interes') = (oportunidad_id is not null));

-- La conversación de un interés la ve quien ve el interés (decide la
-- política de oportunidades); la del equipo, todos
create policy chats_select on chats for select to authenticated
  using (tipo = 'equipo' or exists (select 1 from oportunidades o where o.id = oportunidad_id));
create policy chats_insert on chats for insert to authenticated
  with check (
    (tipo = 'interes' and exists (select 1 from oportunidades o where o.id = oportunidad_id))
    or (tipo = 'equipo' and (select fn_es_gestor()))
  );

-- Marca para saber que se aplicó
insert into config (clave, valor) values ('migracion_048', 'aplicada') on conflict (clave) do update set valor = excluded.valor;
