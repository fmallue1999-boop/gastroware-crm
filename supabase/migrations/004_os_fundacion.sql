-- =============================================================
-- Migración 004 — GastroWare OS: fundación
-- BASE LIMPIA: borra los datos de prueba existentes (aprobado por
-- dirección el 2026-08-03) y recrea el modelo núcleo con:
--   roles nuevos, distribuidores, clientes fiscales, sucursales,
--   documentos, notificaciones, aprobaciones, AUDITORÍA por triggers,
--   RLS REAL por rol, soft delete, estados de OT configurables,
--   time-tracking, repuestos, cotizaciones versionadas y outbox.
-- Ejecutar completa en Supabase → SQL Editor → Run.
-- =============================================================

-- ---------- 0. Limpieza (orden de dependencias) ----------
drop table if exists ot_checklists, checklist_plantillas, ot_comentarios,
  ot_fotos, ot_items, ot_tiempos, status_history, ordenes_trabajo,
  ot_transiciones, ot_estados, cotizacion_items, cotizacion_versiones,
  cotizaciones, tareas, actividades, oportunidades, recurrencias,
  equipo_fotos, equipos_instalados, equipos, repuesto_modelos, repuestos,
  materiales, plantillas, cliente_etiquetas, etiquetas, documentos,
  contactos, sucursales, clientes, notificaciones, aprobaciones, outbox,
  push_subs, audit_log, productos, modelos, distribuidores, config,
  usuarios cascade;

drop function if exists fn_rol, fn_distribuidor, fn_es_gestor, fn_audit,
  fn_normaliza_telefono, fn_valida_transicion_ot, handle_new_user cascade;

-- ---------- 1. Usuarios, roles y distribuidores ----------
create table distribuidores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  cuit text,
  telefono text,
  email text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table usuarios (
  id uuid primary key references auth.users on delete cascade,
  nombre text not null,
  rol text not null default 'comercial' check (rol in
    ('direccion','admin','comercial','marketing','tecnico','distribuidor')),
  distribuidor_id uuid references distribuidores(id),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Funciones de contexto (security definer evita recursión en RLS)
create or replace function fn_rol() returns text
language sql security definer stable set search_path = public as
$$ select rol from usuarios where id = auth.uid() $$;

create or replace function fn_distribuidor() returns uuid
language sql security definer stable set search_path = public as
$$ select distribuidor_id from usuarios where id = auth.uid() $$;

-- gestor = dirección o admin (acceso operativo total)
create or replace function fn_es_gestor() returns boolean
language sql security definer stable set search_path = public as
$$ select fn_rol() in ('direccion','admin') $$;

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into usuarios (id, nombre)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- Usuario existente de dirección (Franco)
insert into usuarios (id, nombre, rol)
select id, 'Franco', 'direccion' from auth.users
where email = 'fmallue1999@gmail.com'
on conflict (id) do update set rol = 'direccion', nombre = 'Franco';

-- ---------- 2. Auditoría inmutable ----------
create table audit_log (
  id bigint generated always as identity primary key,
  tabla text not null,
  registro_id uuid,
  accion text not null,
  usuario_id uuid,
  diff jsonb,
  created_at timestamptz not null default now()
);
create index audit_tabla_idx on audit_log (tabla, registro_id, created_at desc);
create index audit_usuario_idx on audit_log (usuario_id, created_at desc);

create or replace function fn_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_diff jsonb; v_id uuid;
begin
  if tg_op = 'INSERT' then
    v_diff := to_jsonb(new);
    v_id := (to_jsonb(new)->>'id')::uuid;
  elsif tg_op = 'DELETE' then
    v_diff := to_jsonb(old);
    v_id := (to_jsonb(old)->>'id')::uuid;
  else
    select jsonb_object_agg(key, jsonb_build_object('antes', o.value, 'despues', n.value))
      into v_diff
    from jsonb_each(to_jsonb(old)) o
    join jsonb_each(to_jsonb(new)) n using (key)
    where o.value is distinct from n.value;
    v_id := (to_jsonb(new)->>'id')::uuid;
    if v_diff is null then return new; end if;
  end if;
  insert into audit_log (tabla, registro_id, accion, usuario_id, diff)
  values (tg_table_name, v_id, tg_op, auth.uid(), v_diff);
  return coalesce(new, old);
end $$;

-- ---------- 3. Clientes 360 ----------
create table clientes (
  id uuid primary key default gen_random_uuid(),
  razon_social text,
  nombre_comercial text not null,
  cuit text,
  condicion_fiscal text check (condicion_fiscal in
    ('responsable_inscripto','monotributo','exento','consumidor_final')),
  rubro text not null default 'Otro',
  telefono text,
  email text,
  instagram_web text,
  estado text not null default 'prospecto' check (estado in ('prospecto','cliente_activo','inactivo')),
  potencial text check (potencial in ('alto','medio','bajo')),
  comercial_id uuid references usuarios(id),
  distribuidor_id uuid references distribuidores(id),
  notas text,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index clientes_cuit_uq on clientes (cuit) where cuit is not null and deleted_at is null;
create index clientes_tel_idx on clientes (telefono);
create index clientes_comercial_idx on clientes (comercial_id);
create index clientes_distribuidor_idx on clientes (distribuidor_id);

create or replace function fn_normaliza_telefono() returns trigger
language plpgsql as $$
declare d text;
begin
  if new.telefono is not null then
    d := regexp_replace(new.telefono, '\D', '', 'g');
    if left(d, 3) = '549' then d := substr(d, 4);
    elsif left(d, 2) = '54' then d := substr(d, 3); end if;
    if left(d, 1) = '0' then d := substr(d, 2); end if;
    new.telefono := d;
  end if;
  return new;
end $$;
create trigger tg_clientes_tel before insert or update of telefono on clientes
  for each row execute function fn_normaliza_telefono();

create table sucursales (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  nombre text not null,
  direccion text,
  ciudad text,
  provincia text,
  telefono text,
  es_principal boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table contactos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  sucursal_id uuid references sucursales(id) on delete set null,
  nombre text not null,
  cargo text,
  telefono text,
  email text,
  es_decisor boolean not null default false,
  consentimiento_email boolean not null default true,
  consentimiento_whatsapp boolean not null default true,
  baja_at timestamptz,
  deleted_at timestamptz
);

create table etiquetas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  color text
);
create table cliente_etiquetas (
  cliente_id uuid references clientes(id) on delete cascade,
  etiqueta_id uuid references etiquetas(id) on delete cascade,
  primary key (cliente_id, etiqueta_id)
);

create table documentos (
  id uuid primary key default gen_random_uuid(),
  entidad text not null check (entidad in ('cliente','equipo','orden','oportunidad','repuesto')),
  entidad_id uuid not null,
  tipo text not null default 'otro' check (tipo in ('factura','remito','manual','contrato','foto','otro')),
  nombre text not null,
  path text not null,
  subido_por uuid references usuarios(id),
  created_at timestamptz not null default now()
);
create index documentos_entidad_idx on documentos (entidad, entidad_id);

create table notificaciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  tipo text not null,
  titulo text not null,
  cuerpo text,
  url text,
  leida_at timestamptz,
  created_at timestamptz not null default now()
);
create index notif_usuario_idx on notificaciones (usuario_id, leida_at, created_at desc);

create table aprobaciones (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  entidad text,
  entidad_id uuid,
  solicitante uuid references usuarios(id),
  aprobador uuid references usuarios(id),
  estado text not null default 'pendiente' check (estado in ('pendiente','aprobada','rechazada')),
  detalle jsonb,
  created_at timestamptz not null default now(),
  resuelto_at timestamptz
);

create table config (
  clave text primary key,
  valor text not null
);
insert into config (clave, valor) values
  ('tarifa_hora', '0'), ('meses_cliente_dormido', '6');

create table outbox (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  payload jsonb not null,
  clave_idempotencia text unique,
  intentos int not null default 0,
  estado text not null default 'pendiente' check (estado in ('pendiente','enviado','error')),
  ultimo_error text,
  created_at timestamptz not null default now(),
  procesado_at timestamptz
);

create table push_subs (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references usuarios(id) on delete cascade,
  endpoint text unique not null,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);

-- ---------- 4. Catálogos ----------
create table modelos (
  id uuid primary key default gen_random_uuid(),
  marca text not null,
  nombre text not null,
  categoria text not null,
  garantia_meses int,
  activo boolean not null default true,
  unique (marca, nombre)
);

create table productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  marca text,
  categoria text not null,
  modelo_id uuid references modelos(id),
  es_consumible boolean not null default false,
  frecuencia_recompra_dias int,
  consumible_de uuid references productos(id),
  precio_referencia numeric,
  moneda text not null default 'ARS',
  garantia_meses int,
  activo boolean not null default true
);

create table plantillas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  uso text not null,
  producto_id uuid references productos(id),
  contenido text not null
);

create table materiales (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text not null,
  producto_id uuid references productos(id),
  url text,
  prioridad text not null default 'alta'
);

create table repuestos (
  id uuid primary key default gen_random_uuid(),
  codigo_interno text unique,
  codigo_fabricante text,
  descripcion text not null,
  marca text,
  costo numeric,
  precio numeric,
  moneda text not null default 'ARS',
  stock int,
  ubicacion text,
  garantia_meses int,
  activo boolean not null default true,
  deleted_at timestamptz
);
create table repuesto_modelos (
  repuesto_id uuid references repuestos(id) on delete cascade,
  modelo_id uuid references modelos(id) on delete cascade,
  primary key (repuesto_id, modelo_id)
);

-- ---------- 5. Equipos ----------
create table equipos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  sucursal_id uuid references sucursales(id) on delete set null,
  modelo_id uuid references modelos(id),
  producto_id uuid references productos(id),
  marca_modelo_libre text,
  numero_serie text,
  origen text not null default 'vendido' check (origen in ('vendido','externo')),
  estado text not null default 'activo' check (estado in ('activo','en_reparacion','baja')),
  fecha_venta date,
  fecha_instalacion date,
  garantia_hasta date,
  proximo_service date,
  comercial_id uuid references usuarios(id),
  distribuidor_id uuid references distribuidores(id),
  oportunidad_id uuid,
  config jsonb not null default '{}',
  observaciones text,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index equipos_serie_uq on equipos (numero_serie)
  where numero_serie is not null and deleted_at is null;
create index equipos_cliente_idx on equipos (cliente_id);

create table equipo_fotos (
  id uuid primary key default gen_random_uuid(),
  equipo_id uuid not null references equipos(id) on delete cascade,
  path text not null,
  created_at timestamptz not null default now()
);

create table recurrencias (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  producto_id uuid not null references productos(id),
  frecuencia_dias int not null,
  ultima_compra date,
  proxima_alerta date not null,
  activa boolean not null default true
);

-- ---------- 6. Ventas ----------
create table oportunidades (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  sucursal_id uuid references sucursales(id) on delete set null,
  producto_id uuid references productos(id),
  comercial_id uuid references usuarios(id),
  etapa text not null default 'nueva' check (etapa in
    ('nueva','diagnostico','cotizada','seguimiento','negociacion','ganada','perdida')),
  temperatura text check (temperatura in ('caliente','tibio','frio')),
  origen text not null,
  monto_estimado numeric,
  moneda text not null default 'ARS',
  diagnostico jsonb not null default '{}',
  objecion_principal text,
  motivo_perdida text,
  fecha_cierre_estimada date,
  mensaje_inicial text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create index opps_etapa_idx on oportunidades (etapa, comercial_id);
alter table equipos add constraint equipos_opp_fk
  foreign key (oportunidad_id) references oportunidades(id) on delete set null;

create table cotizaciones (
  id uuid primary key default gen_random_uuid(),
  oportunidad_id uuid not null references oportunidades(id) on delete cascade,
  numero int generated always as identity,
  estado text not null default 'enviada' check (estado in ('borrador','enviada','aceptada','rechazada')),
  created_at timestamptz not null default now()
);
create table cotizacion_versiones (
  id uuid primary key default gen_random_uuid(),
  cotizacion_id uuid not null references cotizaciones(id) on delete cascade,
  version int not null default 1,
  total numeric,
  moneda text not null default 'ARS',
  forma_pago text,
  vigencia_dias int,
  condiciones text,
  archivo_path text,
  creado_por uuid references usuarios(id),
  created_at timestamptz not null default now(),
  unique (cotizacion_id, version)
);
create table cotizacion_items (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references cotizacion_versiones(id) on delete cascade,
  producto_id uuid references productos(id),
  descripcion text not null,
  cantidad numeric not null default 1,
  precio_unit numeric not null default 0,
  descuento_pct numeric not null default 0
);

create table tareas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  oportunidad_id uuid references oportunidades(id) on delete cascade,
  recurrencia_id uuid references recurrencias(id) on delete set null,
  usuario_id uuid references usuarios(id),
  tipo text not null default 'seguimiento' check (tipo in
    ('seguimiento','reactivacion','recompra','postventa','otro')),
  titulo text not null,
  plantilla_id uuid references plantillas(id),
  vence_el date not null,
  auto boolean not null default false,
  completada_at timestamptz,
  cancelada boolean not null default false
);
create index tareas_pend_idx on tareas (usuario_id, vence_el)
  where completada_at is null and not cancelada;

create table actividades (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  oportunidad_id uuid references oportunidades(id) on delete cascade,
  tipo text not null,
  contenido text,
  created_by uuid references usuarios(id),
  created_at timestamptz not null default now()
);
create index activ_cliente_idx on actividades (cliente_id, created_at desc);

-- ---------- 7. Servicio técnico ----------
create table ot_estados (
  codigo text primary key,
  nombre text not null,
  orden int not null,
  es_final boolean not null default false,
  grupo text not null default 'tecnico' check (grupo in ('tecnico','admin'))
);
insert into ot_estados (codigo, nombre, orden, es_final, grupo) values
  ('solicitud_recibida','Solicitud recibida',1,false,'admin'),
  ('pendiente_revision','Pendiente de revisión',2,false,'admin'),
  ('pendiente_asignacion','Pendiente de asignación',3,false,'admin'),
  ('programado','Programado',4,false,'tecnico'),
  ('asignado','Asignado',5,false,'tecnico'),
  ('en_camino','En camino',6,false,'tecnico'),
  ('en_proceso','En proceso',7,false,'tecnico'),
  ('esperando_repuesto','Esperando repuesto',8,false,'tecnico'),
  ('esperando_cliente','Esperando respuesta del cliente',9,false,'tecnico'),
  ('finalizado_tecnico','Finalizado por el técnico',10,false,'tecnico'),
  ('revision_admin','Pendiente de revisión administrativa',11,false,'admin'),
  ('devuelto_tecnico','Devuelto al técnico',12,false,'tecnico'),
  ('aprobado_facturar','Aprobado para facturar',13,false,'admin'),
  ('facturado','Facturado',14,false,'admin'),
  ('cerrado','Cerrado',15,true,'admin'),
  ('cancelado','Cancelado',16,true,'admin');

create table ot_transiciones (
  desde text not null references ot_estados(codigo),
  hacia text not null references ot_estados(codigo),
  requiere_rol text not null default 'cualquiera' check (requiere_rol in
    ('cualquiera','tecnico','gestor')),
  primary key (desde, hacia)
);
insert into ot_transiciones (desde, hacia, requiere_rol) values
  ('solicitud_recibida','pendiente_revision','gestor'),
  ('solicitud_recibida','pendiente_asignacion','gestor'),
  ('solicitud_recibida','cancelado','gestor'),
  ('pendiente_revision','pendiente_asignacion','gestor'),
  ('pendiente_revision','cancelado','gestor'),
  ('pendiente_asignacion','asignado','gestor'),
  ('pendiente_asignacion','programado','gestor'),
  ('pendiente_asignacion','cancelado','gestor'),
  ('programado','asignado','gestor'),
  ('programado','en_camino','tecnico'),
  ('programado','cancelado','gestor'),
  ('asignado','en_camino','tecnico'),
  ('asignado','en_proceso','tecnico'),
  ('asignado','programado','gestor'),
  ('asignado','cancelado','gestor'),
  ('en_camino','en_proceso','tecnico'),
  ('en_proceso','esperando_repuesto','tecnico'),
  ('en_proceso','esperando_cliente','tecnico'),
  ('en_proceso','finalizado_tecnico','tecnico'),
  ('esperando_repuesto','en_proceso','tecnico'),
  ('esperando_cliente','en_proceso','tecnico'),
  ('finalizado_tecnico','revision_admin','cualquiera'),
  ('revision_admin','devuelto_tecnico','gestor'),
  ('revision_admin','aprobado_facturar','gestor'),
  ('devuelto_tecnico','en_proceso','tecnico'),
  ('aprobado_facturar','facturado','gestor'),
  ('facturado','cerrado','gestor'),
  ('cerrado','revision_admin','gestor'),
  ('cancelado','pendiente_revision','gestor');

create table ordenes_trabajo (
  id uuid primary key default gen_random_uuid(),
  numero int generated always as identity,
  cliente_id uuid not null references clientes(id) on delete cascade,
  sucursal_id uuid references sucursales(id) on delete set null,
  equipo_id uuid references equipos(id) on delete set null,
  tecnico_id uuid references usuarios(id),
  admin_id uuid references usuarios(id),
  creado_por uuid references usuarios(id),
  estado text not null default 'solicitud_recibida' references ot_estados(codigo),
  prioridad text not null default 'normal' check (prioridad in ('baja','normal','alta','urgente')),
  tipo text not null default 'correctivo' check (tipo in ('correctivo','preventivo','instalacion','garantia')),
  tipo_problema text,
  cobertura text not null default 'facturable' check (cobertura in ('facturable','garantia','contrato')),
  fecha_solicitada date,
  fecha_programada date,
  problema text,
  diagnostico text,
  trabajo_realizado text,
  firma_path text,
  firmante text,
  observacion_admin text,
  total numeric,
  nro_factura text,
  facturada_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  cerrada_tecnico_at timestamptz,
  cerrada_admin_at timestamptz
);
create index ot_estado_idx on ordenes_trabajo (estado, tecnico_id);
create index ot_agenda_idx on ordenes_trabajo (fecha_programada, tecnico_id);

create table status_history (
  id uuid primary key default gen_random_uuid(),
  ot_id uuid not null references ordenes_trabajo(id) on delete cascade,
  desde text,
  hacia text not null,
  usuario_id uuid,
  observacion text,
  created_at timestamptz not null default now()
);

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
  if v_req = 'gestor' and v_rol not in ('direccion','admin') then
    raise exception 'Solo administración puede pasar a %', new.estado;
  end if;
  if v_req = 'tecnico' and v_rol not in ('direccion','admin','tecnico') then
    raise exception 'Solo el técnico puede pasar a %', new.estado;
  end if;
  -- Requisitos de cierre técnico (salvo excepción aprobada)
  if new.estado = 'finalizado_tecnico' then
    if (new.diagnostico is null or new.trabajo_realizado is null
        or new.firma_path is null
        or not exists (select 1 from ot_tiempos t where t.ot_id = new.id))
       and not exists (
         select 1 from aprobaciones a
         where a.tipo = 'excepcion_cierre_ot' and a.entidad_id = new.id
           and a.estado = 'aprobada')
    then
      raise exception 'Faltan datos obligatorios para finalizar (diagnóstico, trabajo, tiempo y firma) y no hay excepción aprobada';
    end if;
    new.cerrada_tecnico_at := now();
  end if;
  if new.estado = 'cerrado' then new.cerrada_admin_at := now(); end if;
  insert into status_history (ot_id, desde, hacia, usuario_id)
  values (new.id, old.estado, new.estado, auth.uid());
  return new;
end $$;
create trigger tg_ot_transicion before update of estado on ordenes_trabajo
  for each row execute function fn_valida_transicion_ot();

create table ot_tiempos (
  id uuid primary key default gen_random_uuid(),
  ot_id uuid not null references ordenes_trabajo(id) on delete cascade,
  tecnico_id uuid references usuarios(id),
  inicio timestamptz not null default now(),
  fin timestamptz,
  minutos int,
  manual boolean not null default false,
  justificacion text,
  constraint manual_justificado check (not manual or justificacion is not null)
);

create table ot_items (
  id uuid primary key default gen_random_uuid(),
  ot_id uuid not null references ordenes_trabajo(id) on delete cascade,
  tipo text not null check (tipo in ('refaccion','gasto')),
  repuesto_id uuid references repuestos(id),
  descripcion text not null,
  cantidad numeric not null default 1,
  costo_unit numeric,
  precio_unit numeric not null default 0,
  estado text not null default 'pendiente' check (estado in
    ('facturable','garantia','cortesia','pendiente')),
  aprobado_admin boolean not null default false,
  comprobante_path text,
  created_at timestamptz not null default now()
);

create table ot_fotos (
  id uuid primary key default gen_random_uuid(),
  ot_id uuid not null references ordenes_trabajo(id) on delete cascade,
  momento text not null default 'otro' check (momento in ('antes','despues','otro')),
  path text not null,
  created_at timestamptz not null default now()
);

create table ot_comentarios (
  id uuid primary key default gen_random_uuid(),
  ot_id uuid not null references ordenes_trabajo(id) on delete cascade,
  usuario_id uuid references usuarios(id),
  texto text not null,
  created_at timestamptz not null default now()
);

create table checklist_plantillas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  modelo_id uuid references modelos(id),
  items jsonb not null default '[]'
);
create table ot_checklists (
  id uuid primary key default gen_random_uuid(),
  ot_id uuid not null references ordenes_trabajo(id) on delete cascade,
  plantilla_id uuid references checklist_plantillas(id),
  respuestas jsonb not null default '{}'
);

-- ---------- 8. Seeds de catálogo ----------
insert into modelos (marca, nombre, categoria, garantia_meses) values
  ('GastroWare','GX22','licuadora',12),
  ('GastroWare','GX18','licuadora',12),
  ('Zumex','Speed Pro','exprimidora',60),
  ('Zumex','Versatile Pro','exprimidora',60),
  ('Zumex','Minex','exprimidora',60),
  ('Rational','iCombi Pro','horno',12),
  ('Jetinno','JL-serie','maquina_cafe',12);

insert into productos (nombre, marca, categoria, modelo_id, moneda, garantia_meses)
select m.marca || ' ' || m.nombre, m.marca,
       case when m.categoria = 'licuadora' then 'licuadora'
            when m.categoria = 'exprimidora' then 'exprimidora'
            else m.categoria end,
       m.id,
       case when m.marca = 'GastroWare' then 'ARS' else 'USD' end,
       m.garantia_meses
from modelos m;

insert into productos (nombre, marca, categoria, es_consumible, frecuencia_recompra_dias, consumible_de, moneda)
select 'Pastillas de limpieza Rational', 'Rational', 'consumible', true, 45, p.id, 'ARS'
from productos p where p.nombre = 'Rational iCombi Pro';

insert into repuestos (codigo_interno, descripcion, marca, moneda) values
  ('GW-JARRA-GX22','Jarra Tritan GX22','GastroWare','ARS'),
  ('GW-CUCH-GX22','Cuchilla GX22','GastroWare','ARS'),
  ('ZX-GOMAS-KIT','Kit gomas exprimidora Zumex','Zumex','ARS');

insert into plantillas (nombre, uso, contenido) values
  ('Seguimiento D+2','d2','Buen día {nombre}, ¿cómo estás? Te escribo para hacer seguimiento de la propuesta que vimos. ¿Querés que lo veamos con alguna alternativa de financiación?'),
  ('Seguimiento D+5 con contenido','d5','Hola {nombre}, te comparto este material para que veas mejor el equipo en funcionamiento. Está pensado para uso gastronómico exigente.'),
  ('Seguimiento D+10 diagnóstico','d10','Hola {nombre}, ¿qué es lo que más te frena hoy: el valor, el momento o estás comparando alternativas?'),
  ('Reactivación D+20','d20','Hola {nombre}, cierro el seguimiento de la consulta. Si quedó para más adelante lo agendamos y te vuelvo a escribir.'),
  ('Objeción: precio','objecion:precio','Entiendo {nombre}. Más que el precio inicial, conviene ver qué problema resuelve y cuánto cuesta trabajar con un equipo que se queda corto. ¿Lo vemos con un pago más gradual?'),
  ('Guion diagnóstico GX','diagnostico:gx','¿La usarían para licuados, smoothies, frappés o hielo? ¿Cuántos usos por día calculan? ¿Hoy tienen licuadora o sería incorporación nueva?'),
  ('Guion diagnóstico Zumex','diagnostico:zumex','¿Para qué tipo de negocio sería? ¿Suman jugo natural como producto nuevo o reemplazan equipo? ¿Cuántos vasos por día estiman?'),
  ('Pasar precio GX','precio:gx','Por el uso que me comentás, te recomiendo la GX22: pensada para operación gastronómica, con respaldo local, garantía y repuestos. El valor es {monto} + IVA, con opciones de financiación.'),
  ('Pasar precio Zumex','precio:zumex','Conviene analizar Zumex como unidad de negocio: vasos por día, precio y recupero. El valor es {monto}, con anticipo + cuotas o e-cheqs.'),
  ('Recompra de consumible','recompra','Hola {nombre}, ¿cómo va todo? Calculo que ya deben estar por reponer {producto}. ¿Te preparo un pedido como el anterior?');

-- ---------- 9. RLS ----------
-- Habilitar en todas
do $$
declare t text;
begin
  foreach t in array array['usuarios','distribuidores','clientes','sucursales',
    'contactos','etiquetas','cliente_etiquetas','documentos','notificaciones',
    'aprobaciones','config','outbox','push_subs','modelos','productos',
    'plantillas','materiales','repuestos','repuesto_modelos','equipos',
    'equipo_fotos','recurrencias','oportunidades','cotizaciones',
    'cotizacion_versiones','cotizacion_items','tareas','actividades',
    'ot_estados','ot_transiciones','ordenes_trabajo','status_history',
    'ot_tiempos','ot_items','ot_fotos','ot_comentarios',
    'checklist_plantillas','ot_checklists','audit_log']
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- Helpers de acceso por cliente (evita repetir subconsultas)
create or replace function fn_puede_ver_cliente(cid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select fn_es_gestor()
    or fn_rol() = 'marketing'
    or (fn_rol() = 'comercial' and exists (
          select 1 from clientes c where c.id = cid
            and (c.comercial_id = auth.uid() or c.comercial_id is null)))
    or (fn_rol() = 'distribuidor' and exists (
          select 1 from clientes c where c.id = cid
            and c.distribuidor_id = fn_distribuidor()))
    or (fn_rol() = 'tecnico' and exists (
          select 1 from ordenes_trabajo o where o.cliente_id = cid
            and o.tecnico_id = auth.uid()))
$$;

-- usuarios: cada uno se ve; gestores ven todo; solo dirección cambia roles ajenos
create policy usuarios_select on usuarios for select to authenticated
  using (id = auth.uid() or fn_es_gestor() or activo);
create policy usuarios_update_propio on usuarios for update to authenticated
  using (id = auth.uid() or fn_es_gestor())
  with check (id = auth.uid() or fn_es_gestor());
create policy usuarios_insert_gestor on usuarios for insert to authenticated
  with check (fn_es_gestor());

-- distribuidores
create policy distribuidores_select on distribuidores for select to authenticated
  using (fn_es_gestor() or fn_rol() in ('comercial','marketing') or id = fn_distribuidor());
create policy distribuidores_write on distribuidores for all to authenticated
  using (fn_es_gestor()) with check (fn_es_gestor());

-- clientes
create policy clientes_select on clientes for select to authenticated
  using (
    (deleted_at is null or fn_es_gestor()) and (
      fn_es_gestor() or fn_rol() = 'marketing'
      or (fn_rol() = 'comercial' and (comercial_id = auth.uid() or comercial_id is null))
      or (fn_rol() = 'distribuidor' and distribuidor_id = fn_distribuidor())
      or (fn_rol() = 'tecnico' and exists (
            select 1 from ordenes_trabajo o
            where o.cliente_id = clientes.id and o.tecnico_id = auth.uid()))
    ));
create policy clientes_insert on clientes for insert to authenticated
  with check (fn_es_gestor() or fn_rol() in ('comercial','tecnico')
    or (fn_rol() = 'distribuidor' and distribuidor_id = fn_distribuidor()));
create policy clientes_update on clientes for update to authenticated
  using (fn_es_gestor()
    or (fn_rol() = 'comercial' and (comercial_id = auth.uid() or comercial_id is null))
    or (fn_rol() = 'distribuidor' and distribuidor_id = fn_distribuidor()));
create policy clientes_delete on clientes for delete to authenticated
  using (fn_es_gestor());

-- sucursales / contactos / etiquetas de cliente: siguen al cliente
create policy sucursales_all on sucursales for all to authenticated
  using (fn_puede_ver_cliente(cliente_id)) with check (fn_puede_ver_cliente(cliente_id));
create policy contactos_all on contactos for all to authenticated
  using (fn_puede_ver_cliente(cliente_id)) with check (fn_puede_ver_cliente(cliente_id));
create policy etiquetas_select on etiquetas for select to authenticated using (true);
create policy etiquetas_write on etiquetas for all to authenticated
  using (fn_es_gestor() or fn_rol() = 'marketing')
  with check (fn_es_gestor() or fn_rol() = 'marketing');
create policy cliente_etiquetas_all on cliente_etiquetas for all to authenticated
  using (fn_puede_ver_cliente(cliente_id)) with check (fn_puede_ver_cliente(cliente_id));

-- documentos: por entidad (cliente directo; resto gestor/tecnico asignado)
create policy documentos_select on documentos for select to authenticated
  using (
    fn_es_gestor()
    or (entidad = 'cliente' and fn_puede_ver_cliente(entidad_id))
    or (entidad = 'equipo' and exists (
          select 1 from equipos e where e.id = entidad_id and fn_puede_ver_cliente(e.cliente_id)))
    or (entidad = 'orden' and exists (
          select 1 from ordenes_trabajo o where o.id = entidad_id
            and (o.tecnico_id = auth.uid() or fn_puede_ver_cliente(o.cliente_id))))
    or (entidad = 'oportunidad' and exists (
          select 1 from oportunidades op where op.id = entidad_id
            and (fn_es_gestor() or op.comercial_id = auth.uid())))
    or entidad = 'repuesto');
create policy documentos_insert on documentos for insert to authenticated
  with check (auth.uid() is not null);
create policy documentos_delete on documentos for delete to authenticated
  using (fn_es_gestor() or subido_por = auth.uid());

-- notificaciones: propias
create policy notif_own on notificaciones for all to authenticated
  using (usuario_id = auth.uid()) with check (true);

-- aprobaciones
create policy aprob_select on aprobaciones for select to authenticated
  using (fn_es_gestor() or solicitante = auth.uid());
create policy aprob_insert on aprobaciones for insert to authenticated
  with check (solicitante = auth.uid());
create policy aprob_update on aprobaciones for update to authenticated
  using (fn_es_gestor());

-- config: leer todos, escribir gestores
create policy config_select on config for select to authenticated using (true);
create policy config_write on config for all to authenticated
  using (fn_es_gestor()) with check (fn_es_gestor());

-- outbox: solo gestores (los crons usan service role)
create policy outbox_gestor on outbox for all to authenticated
  using (fn_es_gestor()) with check (fn_es_gestor());

-- push_subs: propias
create policy push_own on push_subs for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- catálogos: leer todos, escribir gestores
do $$
declare t text;
begin
  foreach t in array array['modelos','productos','plantillas','materiales',
    'repuestos','repuesto_modelos','ot_estados','ot_transiciones','checklist_plantillas']
  loop
    execute format('create policy %I_select on %I for select to authenticated using (true)', t, t);
    execute format('create policy %I_write on %I for all to authenticated using (fn_es_gestor()) with check (fn_es_gestor())', t, t);
  end loop;
end $$;

-- equipos: siguen al cliente
create policy equipos_select on equipos for select to authenticated
  using ((deleted_at is null or fn_es_gestor()) and fn_puede_ver_cliente(cliente_id));
create policy equipos_write on equipos for insert to authenticated
  with check (fn_puede_ver_cliente(cliente_id));
create policy equipos_update on equipos for update to authenticated
  using (fn_puede_ver_cliente(cliente_id));
create policy equipos_delete on equipos for delete to authenticated
  using (fn_es_gestor());
create policy equipo_fotos_all on equipo_fotos for all to authenticated
  using (exists (select 1 from equipos e where e.id = equipo_id and fn_puede_ver_cliente(e.cliente_id)))
  with check (exists (select 1 from equipos e where e.id = equipo_id and fn_puede_ver_cliente(e.cliente_id)));
create policy recurrencias_all on recurrencias for all to authenticated
  using (fn_puede_ver_cliente(cliente_id)) with check (fn_puede_ver_cliente(cliente_id));

-- oportunidades: TÉCNICO SIN ACCESO; comercial propias o sin dueño
create policy opps_select on oportunidades for select to authenticated
  using (
    (deleted_at is null or fn_es_gestor()) and (
      fn_es_gestor()
      or (fn_rol() = 'comercial' and (comercial_id = auth.uid() or comercial_id is null))
      or (fn_rol() = 'distribuidor' and exists (
            select 1 from clientes c where c.id = cliente_id and c.distribuidor_id = fn_distribuidor()))
    ));
create policy opps_insert on oportunidades for insert to authenticated
  with check (fn_es_gestor() or fn_rol() in ('comercial','distribuidor'));
create policy opps_update on oportunidades for update to authenticated
  using (fn_es_gestor() or (fn_rol() = 'comercial' and (comercial_id = auth.uid() or comercial_id is null)));
create policy opps_delete on oportunidades for delete to authenticated
  using (fn_es_gestor());

-- cotizaciones: siguen a la oportunidad
create policy cotiz_all on cotizaciones for all to authenticated
  using (exists (select 1 from oportunidades o where o.id = oportunidad_id
    and (fn_es_gestor() or o.comercial_id = auth.uid() or o.comercial_id is null)))
  with check (true);
create policy cotizv_all on cotizacion_versiones for all to authenticated
  using (exists (select 1 from cotizaciones c join oportunidades o on o.id = c.oportunidad_id
    where c.id = cotizacion_id and (fn_es_gestor() or o.comercial_id = auth.uid() or o.comercial_id is null)))
  with check (true);
create policy cotizi_all on cotizacion_items for all to authenticated
  using (exists (select 1 from cotizacion_versiones v
    join cotizaciones c on c.id = v.cotizacion_id
    join oportunidades o on o.id = c.oportunidad_id
    where v.id = version_id and (fn_es_gestor() or o.comercial_id = auth.uid() or o.comercial_id is null)))
  with check (true);

-- tareas y actividades: propias o de clientes visibles
create policy tareas_all on tareas for all to authenticated
  using (fn_es_gestor() or usuario_id = auth.uid() or usuario_id is null
    or fn_puede_ver_cliente(cliente_id))
  with check (fn_puede_ver_cliente(cliente_id));
create policy activ_select on actividades for select to authenticated
  using (fn_puede_ver_cliente(cliente_id));
create policy activ_insert on actividades for insert to authenticated
  with check (fn_puede_ver_cliente(cliente_id));

-- ordenes_trabajo: técnico solo asignadas; comercial lee de sus clientes
create policy ot_select on ordenes_trabajo for select to authenticated
  using (
    (deleted_at is null or fn_es_gestor()) and (
      fn_es_gestor()
      or (fn_rol() = 'tecnico' and tecnico_id = auth.uid())
      or (fn_rol() = 'comercial' and fn_puede_ver_cliente(cliente_id))
      or (fn_rol() = 'distribuidor' and exists (
            select 1 from clientes c where c.id = cliente_id and c.distribuidor_id = fn_distribuidor()))
    ));
create policy ot_insert on ordenes_trabajo for insert to authenticated
  with check (fn_es_gestor() or fn_rol() in ('tecnico','comercial','distribuidor'));
create policy ot_update on ordenes_trabajo for update to authenticated
  using (fn_es_gestor() or (fn_rol() = 'tecnico' and tecnico_id = auth.uid()));
create policy ot_delete on ordenes_trabajo for delete to authenticated
  using (fn_es_gestor());

-- detalle de OT: sigue a la OT
create or replace function fn_puede_ver_ot(oid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from ordenes_trabajo o where o.id = oid and (
    fn_es_gestor()
    or (fn_rol() = 'tecnico' and o.tecnico_id = auth.uid())
    or (fn_rol() = 'comercial' and fn_puede_ver_cliente(o.cliente_id))
    or (fn_rol() = 'distribuidor' and exists (
          select 1 from clientes c where c.id = o.cliente_id and c.distribuidor_id = fn_distribuidor()))))
$$;
do $$
declare t text;
begin
  foreach t in array array['status_history','ot_tiempos','ot_items','ot_fotos',
    'ot_comentarios','ot_checklists']
  loop
    execute format('create policy %I_sel on %I for select to authenticated using (fn_puede_ver_ot(ot_id))', t, t);
    execute format('create policy %I_ins on %I for insert to authenticated with check (fn_puede_ver_ot(ot_id))', t, t);
  end loop;
end $$;
create policy ot_items_upd on ot_items for update to authenticated
  using (fn_puede_ver_ot(ot_id));
create policy ot_items_del on ot_items for delete to authenticated
  using (fn_puede_ver_ot(ot_id));
create policy ot_tiempos_upd on ot_tiempos for update to authenticated
  using (fn_puede_ver_ot(ot_id));

-- audit_log: inmutable; solo lectura de gestores (INSERT lo hace el trigger security definer)
create policy audit_select on audit_log for select to authenticated
  using (fn_es_gestor());

-- ---------- 10. Triggers de auditoría ----------
do $$
declare t text;
begin
  foreach t in array array['usuarios','distribuidores','clientes','sucursales',
    'contactos','documentos','aprobaciones','config','equipos','equipo_fotos',
    'recurrencias','oportunidades','cotizaciones','cotizacion_versiones',
    'tareas','ordenes_trabajo','ot_tiempos','ot_items','ot_fotos','repuestos',
    'productos','modelos','plantillas']
  loop
    execute format('create trigger tg_audit_%I after insert or update or delete on %I for each row execute function fn_audit()', t, t);
  end loop;
end $$;

-- ---------- 11. Storage: privado ----------
update storage.buckets set public = false where id = 'servicio';
insert into storage.buckets (id, name, public) values ('documentos','documentos', false)
  on conflict (id) do nothing;
update storage.buckets set public = false where id = 'cotizaciones';

drop policy if exists "auth sube servicio" on storage.objects;
drop policy if exists "auth sube cotizaciones" on storage.objects;
create policy "storage_insert_auth" on storage.objects for insert to authenticated
  with check (bucket_id in ('servicio','documentos'));
create policy "storage_select_auth" on storage.objects for select to authenticated
  using (bucket_id in ('servicio','documentos'));
