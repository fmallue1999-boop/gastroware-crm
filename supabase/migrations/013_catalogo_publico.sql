-- 013: fn_catalogo — catálogo público para la web SIN exponer la tabla
-- productos al rol anon (los precios y el resto de columnas quedan privados;
-- la función devuelve únicamente los campos de la ficha pública).

create or replace function fn_catalogo() returns jsonb
language sql security definer stable set search_path = public as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'nombre', nombre,
        'marca', marca,
        'categoria', categoria,
        'descripcion', descripcion,
        'destacados', destacados,
        'imagen_url', imagen_url,
        'garantia_meses', garantia_meses,
        'es_consumible', es_consumible
      )
      order by categoria, nombre
    ),
    '[]'::jsonb
  )
  from productos
  where activo
$$;

revoke all on function fn_catalogo() from public;
grant execute on function fn_catalogo() to anon;
grant execute on function fn_catalogo() to authenticated;
