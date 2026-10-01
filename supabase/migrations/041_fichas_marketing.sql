-- 041: Marketing carga las fichas que salen en las cotizaciones (v1.15).
-- Cargar ya podía cualquiera del equipo (documentos_insert); faltaba que marketing
-- pueda quitar o reemplazar una ficha de producto que subió otra persona.
-- Mismas condiciones de antes + fichas de producto para quien gestiona Material
-- (marketing, dirección, administración). Idempotente.

drop policy if exists documentos_delete on documentos;
create policy documentos_delete on documentos for delete to authenticated
  using (
    (select fn_es_gestor())
    or subido_por = (select auth.uid())
    or (entidad = 'producto' and tipo = 'ficha' and (select fn_gestiona_material()))
  );

-- Marca para saber que se aplicó (la lee el control de despliegue)
insert into config (clave, valor) values ('migracion_041', 'aplicada') on conflict (clave) do update set valor = excluded.valor;
