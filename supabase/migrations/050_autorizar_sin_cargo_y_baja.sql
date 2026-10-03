-- 050: Servicio técnico (v1.28). Pedido de dirección: "que Emilia autorice
-- no cobrar la orden o darla de baja por un motivo".
-- - No cobrar (sin cargo): lo autoriza dirección con el motivo; la orden
--   queda en $0 y se cierra sin facturar. Se puede volver a cobrar antes
--   de cerrarla.
-- - Dar de baja (anular): la decide dirección con el motivo, desde cualquier
--   estado antes de facturar.
-- - Una orden con importe ya no se cierra sin facturar si dirección no
--   autorizó no cobrarla (salvo que el presupuesto ya se haya cobrado).
-- Idempotente.

alter table ordenes_trabajo
  add column if not exists sin_cargo boolean not null default false,
  add column if not exists sin_cargo_motivo text,
  add column if not exists sin_cargo_por uuid references usuarios(id),
  add column if not exists sin_cargo_at timestamptz,
  add column if not exists baja_motivo text,
  add column if not exists baja_por uuid references usuarios(id),
  add column if not exists baja_at timestamptz;

-- Transiciones que decide dirección
alter table ot_transiciones drop constraint if exists ot_transiciones_requiere_rol_check;
alter table ot_transiciones add constraint ot_transiciones_requiere_rol_check
  check (requiere_rol in ('cualquiera', 'tecnico', 'gestor', 'administracion', 'direccion'));
-- Dar de baja: desde cualquier estado abierto
insert into ot_transiciones (desde, hacia, requiere_rol)
  select codigo, 'cancelado', 'direccion' from ot_estados where codigo not in ('facturado', 'cerrado', 'cancelado')
on conflict (desde, hacia) do update set requiere_rol = 'direccion';
-- No cobrar y cerrar, con el trabajo terminado (sin pasar por facturar)
insert into ot_transiciones (desde, hacia, requiere_rol) values
  ('finalizado_tecnico', 'cerrado', 'direccion'),
  ('revision_admin', 'cerrado', 'direccion')
on conflict (desde, hacia) do update set requiere_rol = excluded.requiere_rol;

-- Quién autoriza: solo dirección marca sin cargo o da de baja (quién y cuándo, solos)
create or replace function fn_ot_autorizacion_guardia() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if (new.sin_cargo, new.sin_cargo_motivo) is distinct from (old.sin_cargo, old.sin_cargo_motivo) then
    if coalesce(fn_rol(), '') <> 'direccion' then raise exception 'No cobrar una orden lo autoriza dirección'; end if;
    if new.sin_cargo then
      if length(trim(coalesce(new.sin_cargo_motivo, ''))) = 0 then raise exception 'Falta el motivo para no cobrarla'; end if;
      new.sin_cargo_por := auth.uid();
      new.sin_cargo_at := now();
    else
      new.sin_cargo_motivo := null;
      new.sin_cargo_por := null;
      new.sin_cargo_at := null;
    end if;
  elsif (new.sin_cargo_por, new.sin_cargo_at) is distinct from (old.sin_cargo_por, old.sin_cargo_at) then
    raise exception 'No se puede cambiar quién autorizó';
  end if;
  if new.baja_motivo is distinct from old.baja_motivo then
    if coalesce(fn_rol(), '') <> 'direccion' then raise exception 'Dar de baja una orden lo decide dirección'; end if;
    new.baja_por := case when new.baja_motivo is null then null else auth.uid() end;
    new.baja_at := case when new.baja_motivo is null then null else now() end;
  elsif (new.baja_por, new.baja_at) is distinct from (old.baja_por, old.baja_at) then
    raise exception 'No se puede cambiar quién dio de baja';
  end if;
  return new;
end $$;
drop trigger if exists tg_ot_autorizacion on ordenes_trabajo;
-- Corre antes que tg_ot_transicion (orden alfabético): la validación de estado ya ve lo autorizado
create trigger tg_ot_autorizacion before update on ordenes_trabajo
  for each row execute function fn_ot_autorizacion_guardia();

-- Validación de transiciones (028) + lo que decide dirección
create or replace function fn_valida_transicion_ot() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_rol text := fn_rol(); v_req text;
begin
  if new.estado = old.estado then return new; end if;
  select requiere_rol into v_req from ot_transiciones
    where desde = old.estado and hacia = new.estado;
  if v_req is null then
    raise exception 'Transición de estado no permitida: % → %', old.estado, new.estado;
  end if;
  if v_req = 'gestor' and coalesce(v_rol, '') not in ('direccion','admin','servicio') then
    raise exception 'Solo dirección de administración o servicio técnico puede pasar a %', new.estado;
  end if;
  if v_req = 'administracion' and coalesce(v_rol, '') not in ('direccion','admin','administrativa') then
    raise exception 'Solo administración puede pasar a %', new.estado;
  end if;
  if v_req = 'tecnico' and coalesce(v_rol, '') not in ('direccion','admin','servicio','tecnico') then
    raise exception 'Solo el técnico puede pasar a %', new.estado;
  end if;
  if v_req = 'direccion' and coalesce(v_rol, '') <> 'direccion' then
    raise exception 'Eso lo autoriza dirección';
  end if;
  -- Dar de baja: siempre con el motivo
  if new.estado = 'cancelado' and length(trim(coalesce(new.baja_motivo, ''))) = 0 then
    raise exception 'Falta el motivo para dar de baja la orden';
  end if;
  -- Cerrar sin facturar: sin importe, ya cobrada, o con el "no cobrar" de dirección
  if new.estado = 'cerrado' and old.estado in ('finalizado_tecnico', 'revision_admin') and not new.sin_cargo then
    raise exception 'Para cerrarla sin facturar, dirección tiene que autorizar no cobrarla';
  end if;
  if new.estado = 'cerrado' and old.estado = 'aprobado_facturar' and coalesce(new.total, 0) > 0
     and not new.sin_cargo and new.cobro_ok_at is null then
    raise exception 'Tiene importe para facturar: facturala o que dirección autorice no cobrarla';
  end if;
  if new.estado = 'finalizado_tecnico' then
    if (new.trabajo_realizado is null
        or (new.firma_path is null and not exists (
              select 1 from ot_fotos f where f.ot_id = new.id and f.momento = 'remito'))
        or not exists (select 1 from ot_fotos f where f.ot_id = new.id and f.momento = 'despues'))
       and not exists (
         select 1 from aprobaciones a
         where a.tipo = 'excepcion_cierre_ot' and a.entidad_id = new.id and a.estado = 'aprobada')
    then
      raise exception 'Para cerrar el trabajo falta: qué se hizo, foto del remito firmado y foto del equipo funcionando';
    end if;
    new.cerrada_tecnico_at := coalesce(new.cerrada_tecnico_at, now());
  end if;
  if new.estado = 'cerrado' then new.cerrada_admin_at := now(); end if;
  -- Reabrir una orden dada de baja: se limpia la baja
  if old.estado = 'cancelado' then
    new.baja_motivo := null;
    new.baja_por := null;
    new.baja_at := null;
  end if;
  insert into status_history (ot_id, desde, hacia, usuario_id)
  values (new.id, old.estado, new.estado, auth.uid());
  return new;
end $$;

-- Marca para saber que se aplicó
insert into config (clave, valor) values ('migracion_050', 'aplicada') on conflict (clave) do update set valor = excluded.valor;
