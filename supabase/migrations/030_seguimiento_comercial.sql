-- 030: Seguimiento comercial (v1.3).
-- Organización comercial en tres apartados (equipos, consumibles, repuestos)
-- sobre la misma base de clientes, actividades con medio y resultado, la
-- próxima acción de cada operación y las personas separadas de la empresa.
-- Solo agrega columnas, índices y las personas que hoy están escritas en las
-- notas ("Contacto: ..."); no cambia ni borra datos existentes.
-- Idempotente: se puede volver a correr.

-- =====================================================================
-- 1. Cada operación pertenece a un apartado
-- =====================================================================
alter table oportunidades add column if not exists linea text not null default 'equipos'
  check (linea in ('equipos','consumibles','repuestos'));

-- Qué hay que hacer en el próximo contacto (la fecha ya existe: proximo_contacto)
alter table oportunidades add column if not exists proxima_accion text
  check (proxima_accion in ('llamar','escribir','cotizar','demo','visitar','otra'));

create index if not exists oportunidades_linea_idx on oportunidades (linea, etapa);

-- Las que ya existen: por el producto
update oportunidades o
   set linea = case when p.es_consumible then 'consumibles' else 'repuestos' end
  from productos p
 where p.id = o.producto_id
   and o.linea = 'equipos'
   and (p.es_consumible or p.categoria = 'repuesto');

-- Las nuevas: si no se indicó, el apartado sale del producto
create or replace function fn_linea_oportunidad() returns trigger
language plpgsql set search_path = public as $$
declare v_cons boolean; v_cat text;
begin
  if new.linea = 'equipos' and new.producto_id is not null then
    select es_consumible, categoria into v_cons, v_cat from productos where id = new.producto_id;
    if v_cons then new.linea := 'consumibles';
    elsif v_cat = 'repuesto' then new.linea := 'repuestos';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists tg_linea_oportunidad on oportunidades;
create trigger tg_linea_oportunidad before insert on oportunidades
  for each row execute function fn_linea_oportunidad();

-- =====================================================================
-- 2. Actividades: cómo fue el contacto y qué resultado tuvo
--    (un intento sin respuesta no es una conversación)
-- =====================================================================
alter table actividades add column if not exists medio text
  check (medio in ('llamada','whatsapp','email','visita','demo'));
alter table actividades add column if not exists resultado text
  check (resultado in ('conversamos','no_respondio','quedo_en_responder','no_interesado','enviado','no_se_hizo'));
-- Cuándo pasó, si no fue en el momento de cargarlo
alter table actividades add column if not exists ocurrio_at timestamptz;

-- Los "Intento sin respuesta" que ya se cargaron con el botón
update actividades set medio = 'llamada', resultado = 'no_respondio'
 where medio is null and contenido like 'Intento sin respuesta%';

create index if not exists activ_medio_idx on actividades (created_by, created_at) where medio is not null;

-- =====================================================================
-- 3. Personas (contactos) separadas de la empresa
-- =====================================================================
alter table contactos add column if not exists created_at timestamptz not null default now();
create index if not exists contactos_cliente_idx on contactos (cliente_id) where deleted_at is null;
create index if not exists contactos_tel_idx on contactos (telefono) where deleted_at is null;
create index if not exists contactos_email_idx on contactos (lower(email)) where deleted_at is null;

-- Mismo formato de teléfono que los clientes (sin 54/9/0 adelante)
drop trigger if exists tg_contactos_tel on contactos;
create trigger tg_contactos_tel before insert or update of telefono on contactos
  for each row execute function fn_normaliza_telefono();

-- Quién cargó o cambió cada persona
drop trigger if exists tg_audit_contactos on contactos;
create trigger tg_audit_contactos after insert or update or delete on contactos
  for each row execute function fn_audit();

-- Con quién se habló en cada actividad (va después de tener las personas)
alter table actividades add column if not exists contacto_id uuid references contactos(id) on delete set null;

-- Las personas que hoy están escritas en las notas del cliente
-- ("Contacto: Martín | ...") pasan a ser personas de verdad. Las notas no se tocan.
insert into contactos (cliente_id, nombre, telefono, email, es_decisor)
select c.id,
       btrim(split_part(substr(c.notas, 11), ' | ', 1)),
       c.telefono,
       c.email,
       true
  from clientes c
 where c.deleted_at is null
   and c.notas like 'Contacto: %'
   and char_length(btrim(split_part(substr(c.notas, 11), ' | ', 1))) between 1 and 120
   and not exists (select 1 from contactos k where k.cliente_id = c.id and k.deleted_at is null);
