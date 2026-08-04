-- 012: Catálogo profesional — ficha de venta por producto
-- descripcion: qué es, para el cliente. destacados: argumentos de venta
-- (bullets). imagen_url: foto del producto (bucket biblioteca, público).

alter table productos add column if not exists descripcion text;
alter table productos add column if not exists destacados jsonb not null default '[]';
alter table productos add column if not exists imagen_url text;
