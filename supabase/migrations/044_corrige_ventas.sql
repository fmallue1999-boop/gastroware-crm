-- 044: Permiso por persona para corregir el paso de una venta (v1.22).
-- "Puede corregir ventas" se tilda en Administración → Usuarios. Quien lo
-- tiene puede volver una venta a otro paso (por ejemplo, de "A preparar" a
-- "Facturado · esperando cobro" si el cobro se registró por error).
-- Como ve_contenidos, nadie se lo puede dar a sí mismo: solo los gestores.
-- Idempotente.

alter table usuarios add column if not exists corrige_ventas boolean not null default false;

create or replace function fn_protege_usuarios() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.rol is distinct from old.rol then
    if fn_rol() <> 'direccion' then
      raise exception 'Solo dirección puede cambiar puestos';
    end if;
    if old.id = auth.uid() then
      raise exception 'No podés cambiar tu propio puesto';
    end if;
  end if;
  if (new.distribuidor_id is distinct from old.distribuidor_id
      or new.activo is distinct from old.activo
      or new.territorio is distinct from old.territorio
      or new.ve_contenidos is distinct from old.ve_contenidos
      or new.corrige_ventas is distinct from old.corrige_ventas)
     and not fn_es_gestor() then
    raise exception 'Sin permiso para modificar territorio, distribuidor, estado o permisos del usuario';
  end if;
  return new;
end $$;

-- Lo pidió dirección para dos usuarios de dirección (2/10/2026); después se maneja desde Administración → Usuarios
update usuarios set corrige_ventas = true
 where id in ('c7449b44-3a55-4140-9b03-5018633fda36', '668cb957-14bd-4865-9347-0dd6a8405c2f');

-- Marca para saber que se aplicó
insert into config (clave, valor) values ('migracion_044', 'aplicada') on conflict (clave) do update set valor = excluded.valor;
