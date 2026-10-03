-- 047: Viáticos (v1.25). Pedido de dirección: "un área de viáticos para que
-- el vendedor cargue viáticos y comprobantes, y que la IA los interprete".
-- Eligió: rendición con aprobación — dirección aprueba, administración reintegra.
--
-- Circuito: cada uno carga sus gastos (con la foto o el PDF del comprobante)
-- → los rinde (una rendición agrupa los gastos sin rendir) → dirección
-- aprueba o rechaza cada gasto (con motivo) → con todo decidido la rendición
-- queda "aprobada" (si hay algo para devolver) o "cerrada" → administración
-- marca el reintegro con la fecha.
-- Solo se reintegra lo que la persona pagó con su plata (medio "propio");
-- lo pagado con la tarjeta de la empresa o con un adelanto se aprueba igual
-- (control) pero no se devuelve.
-- Idempotente.

-- Quién ve los viáticos de todos (dirección y administración) y quién aprueba
create or replace function fn_ve_viaticos() returns boolean
language sql security definer stable set search_path = public as
$$ select coalesce(fn_rol() in ('direccion','admin','administrativa'), false) $$;
revoke execute on function fn_ve_viaticos() from public, anon;
grant execute on function fn_ve_viaticos() to authenticated, service_role;

create or replace function fn_aprueba_viaticos() returns boolean
language sql security definer stable set search_path = public as
$$ select coalesce(fn_rol() in ('direccion','admin'), false) $$;
revoke execute on function fn_aprueba_viaticos() from public, anon;
grant execute on function fn_aprueba_viaticos() to authenticated, service_role;

create table if not exists rendiciones (
  id uuid primary key default gen_random_uuid(),
  numero int generated always as identity,
  usuario_id uuid not null default auth.uid() references usuarios(id),
  estado text not null default 'enviada' check (estado in ('enviada', 'aprobada', 'cerrada', 'reintegrada')),
  -- Comentario de quien rinde (ej: "viaje a Rosario")
  nota text,
  enviada_at timestamptz not null default now(),
  revisada_por uuid references usuarios(id),
  revisada_at timestamptz,
  reintegrada_por uuid references usuarios(id),
  reintegrada_at timestamptz,
  reintegro_fecha date,
  reintegro_nota text,
  created_at timestamptz not null default now()
);
create index if not exists rendiciones_usuario_idx on rendiciones (usuario_id, enviada_at desc);
create index if not exists rendiciones_estado_idx on rendiciones (estado);

create table if not exists gastos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references usuarios(id),
  -- null = todavía sin rendir
  rendicion_id uuid references rendiciones(id) on delete set null,
  fecha date not null,
  categoria text not null check (categoria in ('combustible', 'peaje', 'estacionamiento', 'comida', 'hotel', 'pasajes', 'taxi', 'otros')),
  importe numeric(14, 2) not null check (importe > 0),
  moneda text not null default 'ARS' check (moneda in ('ARS', 'USD')),
  medio_pago text not null default 'propio' check (medio_pago in ('propio', 'tarjeta_empresa', 'adelanto')),
  comercio text,
  cuit text,
  tipo_comprobante text,
  numero_comprobante text,
  iva numeric(14, 2) check (iva is null or iva >= 0),
  detalle text,
  -- Visita a un cliente (opcional)
  cliente_id uuid references clientes(id) on delete set null,
  -- Foto o PDF del comprobante en el bucket "viaticos" ({usuario}/{archivo})
  archivo_path text,
  leido_por_ia boolean not null default false,
  decision text check (decision in ('aprobado', 'rechazado')),
  motivo_rechazo text,
  decidido_por uuid references usuarios(id),
  decidido_at timestamptz,
  created_at timestamptz not null default now(),
  check (decision is distinct from 'rechazado' or length(trim(coalesce(motivo_rechazo, ''))) > 0)
);
create index if not exists gastos_usuario_idx on gastos (usuario_id, rendicion_id);
create index if not exists gastos_rendicion_idx on gastos (rendicion_id);
create index if not exists gastos_fecha_idx on gastos (fecha);

-- ---------------------------------------------------------------------
-- Guardias: qué se puede cambiar y quién (además de los permisos)
-- ---------------------------------------------------------------------
create or replace function fn_gasto_guardia() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_estado text;
begin
  -- Sin usuario (procesos del sistema): sin restricciones
  if auth.uid() is null then return new; end if;
  if new.usuario_id is distinct from old.usuario_id then
    raise exception 'No se puede cambiar de quién es el gasto';
  end if;

  -- Aprobar o rechazar: solo dirección, con la rendición enviada
  if (new.decision, new.motivo_rechazo) is distinct from (old.decision, old.motivo_rechazo) then
    if not fn_aprueba_viaticos() then raise exception 'Los gastos los aprueba dirección'; end if;
    select estado into v_estado from rendiciones where id = old.rendicion_id;
    if v_estado is distinct from 'enviada' then raise exception 'La rendición ya fue revisada'; end if;
    new.decidido_por := auth.uid();
    new.decidido_at := now();
  elsif (new.decidido_por, new.decidido_at) is distinct from (old.decidido_por, old.decidido_at) then
    raise exception 'No se puede cambiar quién decidió';
  end if;

  -- Los datos del gasto: solo quien lo cargó y mientras no lo rindió
  if (new.fecha, new.categoria, new.importe, new.moneda, new.medio_pago, new.comercio, new.cuit, new.tipo_comprobante,
      new.numero_comprobante, new.iva, new.detalle, new.cliente_id, new.archivo_path, new.leido_por_ia)
     is distinct from
     (old.fecha, old.categoria, old.importe, old.moneda, old.medio_pago, old.comercio, old.cuit, old.tipo_comprobante,
      old.numero_comprobante, old.iva, old.detalle, old.cliente_id, old.archivo_path, old.leido_por_ia) then
    if old.usuario_id <> auth.uid() or old.rendicion_id is not null then
      raise exception 'El gasto ya se rindió: no se puede cambiar';
    end if;
  end if;

  -- Rendir (sumarlo a una rendición propia) o retirarlo (la rendición se borró)
  if new.rendicion_id is distinct from old.rendicion_id then
    if old.rendicion_id is null then
      if old.usuario_id <> auth.uid() then raise exception 'Solo quien cargó el gasto lo rinde'; end if;
      if not exists (select 1 from rendiciones r where r.id = new.rendicion_id and r.usuario_id = auth.uid() and r.estado = 'enviada') then
        raise exception 'La rendición no es válida';
      end if;
    else
      if new.rendicion_id is not null then raise exception 'El gasto ya está en otra rendición'; end if;
      if old.decision is not null then raise exception 'La rendición ya se está revisando'; end if;
      select estado into v_estado from rendiciones where id = old.rendicion_id;
      -- v_estado null: la rendición se está borrando (retirar)
      if v_estado is not null and v_estado <> 'enviada' then raise exception 'La rendición ya fue revisada'; end if;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists tg_gasto_guardia on gastos;
create trigger tg_gasto_guardia before update on gastos
  for each row execute function fn_gasto_guardia();

create or replace function fn_rendicion_guardia() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if new.usuario_id is distinct from old.usuario_id then raise exception 'No se puede cambiar de quién es la rendición'; end if;
  if new.estado is distinct from old.estado then
    if old.estado = 'enviada' and new.estado in ('aprobada', 'cerrada') then
      -- Revisión terminada: dirección, con todos los gastos decididos
      if not fn_aprueba_viaticos() then raise exception 'La rendición la revisa dirección'; end if;
      if exists (select 1 from gastos g where g.rendicion_id = new.id and g.decision is null) then
        raise exception 'Faltan gastos por aprobar o rechazar';
      end if;
      new.revisada_por := auth.uid();
      new.revisada_at := now();
    elsif old.estado in ('aprobada', 'cerrada') and new.estado = 'enviada' then
      -- Reabrir la revisión (ej: se aprobó algo por error), antes del reintegro
      if not fn_aprueba_viaticos() then raise exception 'La revisión la reabre dirección'; end if;
      new.revisada_por := null;
      new.revisada_at := null;
    elsif old.estado = 'aprobada' and new.estado = 'reintegrada' then
      -- Reintegro: administración (o dirección), con la fecha
      if not fn_ve_viaticos() then raise exception 'El reintegro lo marca administración'; end if;
      if new.reintegro_fecha is null then raise exception 'Falta la fecha del reintegro'; end if;
      new.reintegrada_por := auth.uid();
      new.reintegrada_at := now();
    else
      raise exception 'Cambio de estado no permitido';
    end if;
  elsif (new.revisada_por, new.revisada_at, new.reintegrada_por, new.reintegrada_at, new.reintegro_fecha, new.reintegro_nota)
        is distinct from (old.revisada_por, old.revisada_at, old.reintegrada_por, old.reintegrada_at, old.reintegro_fecha, old.reintegro_nota) then
    raise exception 'Eso cambia solo con la revisión o el reintegro';
  end if;
  if new.nota is distinct from old.nota and (old.usuario_id <> auth.uid() or old.estado <> 'enviada') then
    raise exception 'La nota la cambia quien rinde, antes de la revisión';
  end if;
  return new;
end $$;
drop trigger if exists tg_rendicion_guardia on rendiciones;
create trigger tg_rendicion_guardia before update on rendiciones
  for each row execute function fn_rendicion_guardia();

-- ---------------------------------------------------------------------
-- Permisos: cada uno ve lo suyo; dirección y administración, todo
-- ---------------------------------------------------------------------
alter table rendiciones enable row level security;
alter table gastos enable row level security;

drop policy if exists rendiciones_select on rendiciones;
create policy rendiciones_select on rendiciones for select to authenticated
  using (usuario_id = (select auth.uid()) or (select fn_ve_viaticos()));
drop policy if exists rendiciones_insert on rendiciones;
create policy rendiciones_insert on rendiciones for insert to authenticated
  with check (usuario_id = (select auth.uid()) and estado = 'enviada');
drop policy if exists rendiciones_update on rendiciones;
create policy rendiciones_update on rendiciones for update to authenticated
  using (usuario_id = (select auth.uid()) or (select fn_ve_viaticos()))
  with check (usuario_id = (select auth.uid()) or (select fn_ve_viaticos()));
-- Retirar: quien rindió, antes de que se decida algún gasto
drop policy if exists rendiciones_delete on rendiciones;
create policy rendiciones_delete on rendiciones for delete to authenticated
  using (
    usuario_id = (select auth.uid()) and estado = 'enviada'
    and not exists (select 1 from gastos g where g.rendicion_id = rendiciones.id and g.decision is not null)
  );

drop policy if exists gastos_select on gastos;
create policy gastos_select on gastos for select to authenticated
  using (usuario_id = (select auth.uid()) or (select fn_ve_viaticos()));
drop policy if exists gastos_insert on gastos;
create policy gastos_insert on gastos for insert to authenticated
  with check (usuario_id = (select auth.uid()) and rendicion_id is null and decision is null and decidido_por is null);
drop policy if exists gastos_update on gastos;
create policy gastos_update on gastos for update to authenticated
  using (usuario_id = (select auth.uid()) or (select fn_aprueba_viaticos()))
  with check (usuario_id = (select auth.uid()) or (select fn_aprueba_viaticos()));
drop policy if exists gastos_delete on gastos;
create policy gastos_delete on gastos for delete to authenticated
  using (usuario_id = (select auth.uid()) and rendicion_id is null);

-- ---------------------------------------------------------------------
-- Comprobantes: bucket privado "viaticos", carpeta por usuario
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('viaticos', 'viaticos', false, 15728640, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists viaticos_obj_select on storage.objects;
create policy viaticos_obj_select on storage.objects for select to authenticated
  using (bucket_id = 'viaticos' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select fn_ve_viaticos())));
drop policy if exists viaticos_obj_insert on storage.objects;
create policy viaticos_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'viaticos' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists viaticos_obj_delete on storage.objects;
create policy viaticos_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'viaticos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Marca para saber que se aplicó
insert into config (clave, valor) values ('migracion_047', 'aplicada') on conflict (clave) do update set valor = excluded.valor;
