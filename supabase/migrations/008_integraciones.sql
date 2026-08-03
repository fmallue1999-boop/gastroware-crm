-- 008: Etapa 4 — Integraciones
-- 1) fn_lead_web: alta de lead desde el formulario del sitio (sin service key).
--    security definer + grant a anon, con rate limit y dedup por teléfono.
-- 2) Tablas de conversaciones/mensajes (WhatsApp oficial, dormidas hasta
--    configurar Meta) y registro de webhooks.

-- ---------- 1. Lead desde la web ----------
create or replace function fn_lead_web(
  p_nombre text,
  p_telefono text,
  p_email text,
  p_rubro text,
  p_ciudad text,
  p_mensaje text,
  p_producto text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_cliente_id uuid;
  v_opp_id uuid;
  v_producto_id uuid;
  v_digitos text;
  v_recientes int;
  v_gestor record;
begin
  -- Rate limit: máximo 20 consultas web por hora (anti-spam)
  select count(*) into v_recientes
  from oportunidades
  where origen = 'Web' and created_at > now() - interval '1 hour';
  if v_recientes >= 20 then
    raise exception 'rate_limit';
  end if;

  if coalesce(trim(p_nombre), '') = '' then
    raise exception 'falta_nombre';
  end if;
  if coalesce(trim(p_telefono), '') = '' and coalesce(trim(p_email), '') = '' then
    raise exception 'falta_contacto';
  end if;

  -- Dedup por teléfono normalizado
  v_digitos := regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g');
  if left(v_digitos, 3) = '549' then v_digitos := substr(v_digitos, 4); end if;
  if left(v_digitos, 2) = '54' then v_digitos := substr(v_digitos, 3); end if;

  if length(v_digitos) >= 8 then
    select id into v_cliente_id from clientes
    where regexp_replace(coalesce(telefono, ''), '\D', '', 'g') like '%' || v_digitos || '%'
      and deleted_at is null
    limit 1;
  end if;

  if v_cliente_id is null then
    insert into clientes (nombre_comercial, rubro, telefono, email, estado)
    values (
      left(trim(p_nombre), 120),
      coalesce(nullif(trim(p_rubro), ''), 'Otro'),
      nullif(trim(p_telefono), ''),
      nullif(trim(p_email), ''),
      'prospecto'
    )
    returning id into v_cliente_id;
    if nullif(trim(p_ciudad), '') is not null then
      insert into sucursales (cliente_id, nombre, ciudad, es_principal)
      values (v_cliente_id, 'Principal', left(trim(p_ciudad), 80), true);
    end if;
  end if;

  -- Producto de interés (búsqueda laxa por nombre; puede quedar null)
  if nullif(trim(p_producto), '') is not null then
    select id into v_producto_id from productos
    where activo and nombre ilike '%' || trim(p_producto) || '%'
    limit 1;
  end if;

  insert into oportunidades (cliente_id, producto_id, etapa, origen, temperatura, mensaje_inicial)
  values (v_cliente_id, v_producto_id, 'nueva', 'Web', 'tibio', left(coalesce(p_mensaje, ''), 2000))
  returning id into v_opp_id;

  insert into tareas (cliente_id, oportunidad_id, tipo, titulo, vence_el, auto)
  values (v_cliente_id, v_opp_id, 'seguimiento',
          'Responder consulta web de ' || left(trim(p_nombre), 60),
          current_date, true);

  insert into actividades (cliente_id, oportunidad_id, tipo, contenido)
  values (v_cliente_id, v_opp_id, 'nota', 'Consulta desde el formulario web');

  -- Avisar a dirección y administración
  for v_gestor in select id from usuarios where rol in ('direccion','admin') and activo loop
    insert into notificaciones (usuario_id, tipo, titulo, cuerpo, url)
    values (v_gestor.id, 'lead_web',
            'Nueva consulta web: ' || left(trim(p_nombre), 60),
            left(coalesce(p_mensaje, ''), 200),
            '/oportunidades/' || v_opp_id);
  end loop;

  return jsonb_build_object('ok', true);
end $$;

revoke all on function fn_lead_web(text,text,text,text,text,text,text) from public;
grant execute on function fn_lead_web(text,text,text,text,text,text,text) to anon;
grant execute on function fn_lead_web(text,text,text,text,text,text,text) to authenticated;

-- ---------- 2. Conversaciones (WhatsApp oficial — dormidas hasta configurar Meta) ----------
create table if not exists conversaciones (
  id uuid primary key default gen_random_uuid(),
  canal text not null default 'whatsapp' check (canal in ('whatsapp','email')),
  telefono text,
  cliente_id uuid references clientes(id) on delete set null,
  ultima_entrada_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists conversaciones_canal_tel_uq
  on conversaciones (canal, telefono) where telefono is not null;

create table if not exists mensajes (
  id uuid primary key default gen_random_uuid(),
  conversacion_id uuid not null references conversaciones(id) on delete cascade,
  direccion text not null check (direccion in ('entrada','salida')),
  contenido text,
  meta_id text unique,
  payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists webhooks_log (
  id bigint generated always as identity primary key,
  origen text not null,
  payload jsonb,
  procesado boolean not null default false,
  error text,
  created_at timestamptz not null default now()
);

alter table conversaciones enable row level security;
alter table mensajes enable row level security;
alter table webhooks_log enable row level security;

-- Lectura para el equipo; escritura solo del backend (service role saltea RLS)
create policy conversaciones_sel on conversaciones for select to authenticated using (true);
create policy mensajes_sel on mensajes for select to authenticated using (true);
create policy webhooks_sel on webhooks_log for select to authenticated using (fn_es_gestor());

-- Auditoría en las tablas nuevas
create trigger tr_audit_conversaciones after insert or update or delete on conversaciones
  for each row execute function fn_audit();
create trigger tr_audit_mensajes after insert or update or delete on mensajes
  for each row execute function fn_audit();

-- ---------- 3. Procesador de webhooks de WhatsApp (Meta oficial) ----------
-- El endpoint valida la firma de Meta y llama acá. Registra el mensaje,
-- lo cuelga de la conversación (creándola si hace falta), la vincula al
-- cliente por teléfono y avisa a los gestores si el número es desconocido.
create or replace function fn_webhook_wa(p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_msg jsonb;
  v_tel text;
  v_digitos text;
  v_texto text;
  v_meta_id text;
  v_conv_id uuid;
  v_cliente_id uuid;
  v_nuevos int := 0;
  v_gestor record;
begin
  insert into webhooks_log (origen, payload, procesado)
  values ('whatsapp', p_payload, false);

  for v_msg in
    select m from jsonb_path_query(p_payload, '$.entry[*].changes[*].value.messages[*]') m
  loop
    v_tel := v_msg->>'from';
    v_meta_id := v_msg->>'id';
    v_texto := coalesce(v_msg#>>'{text,body}', '[' || coalesce(v_msg->>'type','mensaje') || ']');
    if v_tel is null or v_meta_id is null then continue; end if;

    -- Conversación por teléfono
    select id, cliente_id into v_conv_id, v_cliente_id
    from conversaciones where canal = 'whatsapp' and telefono = v_tel;

    if v_conv_id is null then
      v_digitos := regexp_replace(v_tel, '\D', '', 'g');
      if left(v_digitos, 3) = '549' then v_digitos := substr(v_digitos, 4); end if;
      if left(v_digitos, 2) = '54' then v_digitos := substr(v_digitos, 3); end if;
      select id into v_cliente_id from clientes
      where regexp_replace(coalesce(telefono,''), '\D', '', 'g') like '%' || v_digitos || '%'
        and deleted_at is null
      limit 1;

      insert into conversaciones (canal, telefono, cliente_id, ultima_entrada_at)
      values ('whatsapp', v_tel, v_cliente_id, now())
      returning id into v_conv_id;

      if v_cliente_id is null then
        for v_gestor in select id from usuarios where rol in ('direccion','admin') and activo loop
          insert into notificaciones (usuario_id, tipo, titulo, cuerpo, url)
          values (v_gestor.id, 'whatsapp_nuevo',
                  'WhatsApp de un número nuevo: ' || v_tel,
                  left(v_texto, 200), '/alta');
        end loop;
      end if;
    end if;

    begin
      insert into mensajes (conversacion_id, direccion, contenido, meta_id, payload)
      values (v_conv_id, 'entrada', left(v_texto, 4000), v_meta_id, v_msg);
      v_nuevos := v_nuevos + 1;
      update conversaciones set ultima_entrada_at = now() where id = v_conv_id;
    exception when unique_violation then
      -- Meta reintenta webhooks: mensaje ya registrado
      null;
    end;
  end loop;

  update webhooks_log set procesado = true
  where id = (select max(id) from webhooks_log where origen = 'whatsapp');

  return jsonb_build_object('ok', true, 'mensajes_nuevos', v_nuevos);
end $$;

revoke all on function fn_webhook_wa(jsonb) from public;
grant execute on function fn_webhook_wa(jsonb) to anon;
grant execute on function fn_webhook_wa(jsonb) to authenticated;
