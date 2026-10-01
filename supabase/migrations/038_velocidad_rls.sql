-- 038: Velocidad (v1.12.1).
-- Las reglas de acceso (RLS) llamaban a fn_rol(), fn_ve_todo(), fn_es_gestor(),
-- auth.uid()... UNA VEZ POR FILA: contar los 5.000 contactos eran miles de
-- consultas a usuarios. Envueltas en (select ...), Postgres las calcula una sola
-- vez por consulta. Además, fn_puede_ver_cliente(x) pasa a ser
-- ((select fn_ve_todo()) or fn_puede_ver_cliente(x)): da exactamente lo mismo
-- (la función ya empieza por fn_ve_todo()) pero quien ve todo no la llama.
--
-- No cambia QUIÉN ve QUÉ. Se verifica sola: antes y después cuenta lo que ve un
-- usuario de cada puesto activo en cada tabla tocada; si algún número cambia,
-- corta con error y no queda aplicado nada. Idempotente.
-- Deja en config.velocidad_038 cuánto tardaba y cuánto tarda una muestra.

create or replace function fn_rls_optimizar_expr(e text) returns text
language sql immutable set search_path = public as $$
  select regexp_replace(
           regexp_replace(
             regexp_replace(e,
               '(?<![.\w])(?<!SELECT )(fn_[a-z0-9_]+)\(\)', '(SELECT \1())', 'g'),
             '(?<![.\w])(?<!SELECT )auth\.uid\(\)', '(SELECT auth.uid())', 'g'),
           '(?<![.\w])(?<!OR )fn_puede_ver_cliente\(([a-z_.]+)\)', '((SELECT fn_ve_todo()) OR fn_puede_ver_cliente(\1))', 'g')
$$;
revoke execute on function fn_rls_optimizar_expr(text) from public, anon, authenticated;

do $$
declare
  p record;
  uid uuid;
  t text;
  n bigint;
  nq text;
  nc text;
  tablas text[];
  usuarios_prueba uuid[];
  antes jsonb := '{}';
  despues jsonb := '{}';
  cambiadas int := 0;
  ms_antes numeric;
  ms_despues numeric;
  director uuid;
  t0 timestamptz;
begin
  -- Tablas con alguna regla que cambia
  select coalesce(array_agg(distinct tablename::text), '{}') into tablas
    from pg_policies
   where schemaname = 'public'
     and (coalesce(qual, '') <> fn_rls_optimizar_expr(coalesce(qual, ''))
       or coalesce(with_check, '') <> fn_rls_optimizar_expr(coalesce(with_check, '')));
  if cardinality(tablas) = 0 then
    raise notice 'Nada para optimizar (ya aplicada)';
    return;
  end if;

  -- Un usuario activo de cada puesto
  select array_agg(id) into usuarios_prueba
    from (select distinct on (rol) id from usuarios where activo order by rol, created_at) x;
  select id into director from usuarios where activo and rol = 'direccion' order by created_at limit 1;

  -- 1. Lo que ve cada uno, ANTES
  foreach t in array tablas loop
    foreach uid in array usuarios_prueba loop
      begin
        perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
        set local role authenticated;
        execute format('select count(*) from public.%I', t) into n;
        reset role;
      exception when others then
        n := -1;
      end;
      antes := antes || jsonb_build_object(t || ':' || uid, n);
    end loop;
  end loop;

  -- Muestra de velocidad (como dirección): contar contactos + últimos movimientos
  if director is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', director, 'role', 'authenticated')::text, true);
    set local role authenticated;
    perform count(*) from clientes;
    t0 := clock_timestamp();
    perform count(*) from clientes where deleted_at is null;
    perform count(*) from (select cliente_id from actividades order by created_at desc limit 800) a;
    perform count(*) from sucursales;
    ms_antes := round(extract(epoch from clock_timestamp() - t0) * 1000);
    reset role;
  end if;

  -- 2. Reescribir las reglas
  for p in
    select schemaname, tablename, policyname, qual, with_check
      from pg_policies
     where schemaname = 'public'
  loop
    nq := case when p.qual is null then null else fn_rls_optimizar_expr(p.qual) end;
    nc := case when p.with_check is null then null else fn_rls_optimizar_expr(p.with_check) end;
    if nq is distinct from p.qual or nc is distinct from p.with_check then
      execute format('alter policy %I on public.%I', p.policyname, p.tablename)
        || case when nq is not null then format(' using (%s)', nq) else '' end
        || case when nc is not null then format(' with check (%s)', nc) else '' end;
      cambiadas := cambiadas + 1;
    end if;
  end loop;

  -- 3. Lo que ve cada uno, DESPUÉS: tiene que ser idéntico
  foreach t in array tablas loop
    foreach uid in array usuarios_prueba loop
      begin
        perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
        set local role authenticated;
        execute format('select count(*) from public.%I', t) into n;
        reset role;
      exception when others then
        n := -1;
      end;
      despues := despues || jsonb_build_object(t || ':' || uid, n);
    end loop;
  end loop;
  if antes <> despues then
    raise exception 'La verificación no coincide, no se aplicó nada. Antes: % / Después: %', antes, despues;
  end if;

  if director is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', director, 'role', 'authenticated')::text, true);
    set local role authenticated;
    perform count(*) from clientes;
    t0 := clock_timestamp();
    perform count(*) from clientes where deleted_at is null;
    perform count(*) from (select cliente_id from actividades order by created_at desc limit 800) a;
    perform count(*) from sucursales;
    ms_despues := round(extract(epoch from clock_timestamp() - t0) * 1000);
    reset role;
  end if;

  insert into config (clave, valor)
  values ('velocidad_038', json_build_object(
    'reglas', cambiadas,
    'tablas', cardinality(tablas),
    'verificadas', (select count(*) from jsonb_object_keys(antes)),
    'ms_antes', ms_antes,
    'ms_despues', ms_despues)::text)
  on conflict (clave) do update set valor = excluded.valor;
end $$;
