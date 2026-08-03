-- 006: Cierra la escalada de privilegios detectada en la verificación de Etapa 1.
-- La política usuarios_update_propio permite editar la propia fila, pero RLS no
-- restringe columnas: cualquier usuario podía subirse el rol por la API REST.
-- Este trigger protege rol / distribuidor_id / activo.
--   - Servicio (service role, auth.uid() null): pasa siempre (crearUsuario, seeds).
--   - rol: solo dirección, y nunca sobre uno mismo.
--   - distribuidor_id y activo: solo gestores (dirección o admin).

create or replace function fn_protege_usuarios() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Contexto de sistema (service role / migraciones): sin restricciones
  if auth.uid() is null then
    return new;
  end if;

  if new.rol is distinct from old.rol then
    if fn_rol() <> 'direccion' then
      raise exception 'Solo dirección puede cambiar roles';
    end if;
    if old.id = auth.uid() then
      raise exception 'No podés cambiar tu propio rol';
    end if;
  end if;

  if (new.distribuidor_id is distinct from old.distribuidor_id
      or new.activo is distinct from old.activo)
     and not fn_es_gestor() then
    raise exception 'Sin permiso para modificar distribuidor o estado del usuario';
  end if;

  return new;
end $$;

drop trigger if exists usuarios_protege on usuarios;
create trigger usuarios_protege before update on usuarios
  for each row execute function fn_protege_usuarios();

-- En el alta directa por API, un admin no puede darse ni dar rol de dirección/admin
create or replace function fn_protege_usuarios_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.rol in ('direccion','admin') and fn_rol() <> 'direccion' then
    raise exception 'Solo dirección puede crear usuarios de dirección o administración';
  end if;
  return new;
end $$;

drop trigger if exists usuarios_protege_insert on usuarios;
create trigger usuarios_protege_insert before insert on usuarios
  for each row execute function fn_protege_usuarios_insert();
