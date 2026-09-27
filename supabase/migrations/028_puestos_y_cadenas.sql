-- 028: Modelo operativo por puestos (octubre 2026).
-- Traduce el "Manual e instructivo por áreas" v2 (docs/MODELO-OPERATIVO.md):
-- puestos nuevos, territorios con responsable, datos de calificación y de la
-- venta, facturas y cobranzas, casos de postventa, técnicos aliados, remito y
-- control del trabajo técnico, aprobación fuera de lista, informe semanal,
-- pedidos a marketing y los permisos para que cada puesto haga lo suyo.
-- Todo el texto corre en una transacción: si algo falla no queda nada a medias.

-- =====================================================================
-- 1. Puestos
-- =====================================================================
do $$
declare c text;
begin
  for c in select conname from pg_constraint
           where conrelid = 'usuarios'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) ilike '%rol%'
  loop
    execute format('alter table usuarios drop constraint %I', c);
  end loop;
end $$;
alter table usuarios add constraint usuarios_rol_check check (rol in
  ('direccion','admin','administrativa','comercial','servicio','marketing','tecnico','distribuidor'));
alter table usuarios add column if not exists telefono text;

-- Ve toda la operación (no aprueba lo que es de dirección): dirección general,
-- dirección de administración, administrativa y responsable de servicio.
create or replace function fn_ve_todo() returns boolean
language sql security definer stable set search_path = public as
$$ select coalesce(fn_rol() in ('direccion','admin','administrativa','servicio'), false) $$;
revoke execute on function fn_ve_todo() from public, anon;
grant execute on function fn_ve_todo() to authenticated, service_role;

-- =====================================================================
-- 2. Territorios (asignación por lugar de entrega)
-- =====================================================================
create table if not exists territorios (
  codigo text primary key,
  nombre text not null,
  zonas text[] not null default '{}',
  responsable_id uuid references usuarios(id) on delete set null,
  orden int not null default 0
);
insert into territorios (codigo, nombre, zonas, orden) values
  ('amba', 'CABA y AMBA', array['CABA', 'AMBA (Gran Buenos Aires)'], 1),
  ('interior', 'Mar del Plata, costa e interior',
   array['Mar del Plata y zona', 'Costa atlántica', 'Interior de Buenos Aires', 'Otra provincia'], 2)
on conflict (codigo) do nothing;
alter table territorios enable row level security;
drop policy if exists territorios_select on territorios;
create policy territorios_select on territorios for select to authenticated using (true);
drop policy if exists territorios_write on territorios;
create policy territorios_write on territorios for all to authenticated
  using (fn_es_gestor()) with check (fn_es_gestor());

alter table usuarios add column if not exists territorio text references territorios(codigo);

-- =====================================================================
-- 3. Interés: calificación y entrega · Venta: datos para facturar y despachar
-- =====================================================================
alter table oportunidades
  add column if not exists zona_entrega text,
  add column if not exists territorio text references territorios(codigo),
  add column if not exists cantidad int,
  add column if not exists plazo_compra text,
  add column if not exists decisor text,
  add column if not exists asignado_at timestamptz,
  add column if not exists primer_contacto_at timestamptz,
  add column if not exists forma_pago text,
  add column if not exists direccion_entrega text,
  add column if not exists lleva_instalacion boolean not null default false,
  add column if not exists relevamiento jsonb,
  add column if not exists remito_nro text,
  add column if not exists prioridad_despacho int,
  add column if not exists transporte text,
  add column if not exists nro_seguimiento text,
  add column if not exists despachado_at timestamptz,
  add column if not exists videos_enviados_at timestamptz,
  add column if not exists vendido_at timestamptz;

-- Circuito de la venta según el manual: vendido → facturado → (cobro
-- acreditado o condición aprobada) preparar → despachado → entregado.
alter table oportunidades drop constraint if exists oportunidades_pedido_estado_check;
update oportunidades set pedido_estado = case
    when pedido_estado = 'facturar' then 'comprometido'
    when pedido_estado = 'preparar_envio' and nro_factura is null then 'comprometido'
    when pedido_estado = 'para_entregar' then 'preparar_envio'
    when pedido_estado = 'pendiente_pago' then 'facturado'
    when pedido_estado = 'finalizado' then 'entregado'
    else pedido_estado end
 where pedido_estado is not null;
alter table oportunidades add constraint oportunidades_pedido_estado_check
  check (pedido_estado in ('comprometido','facturado','preparar_envio','despachado','entregado'));

create index if not exists opps_territorio_idx on oportunidades (territorio, etapa);
create index if not exists opps_pedido_idx on oportunidades (pedido_estado) where etapa = 'ganada';

-- =====================================================================
-- 4. Facturas y cobranzas (lo que se factura desde el CRM; ZEUS emite)
-- =====================================================================
create table if not exists facturas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete restrict,
  sucursal_id uuid references sucursales(id) on delete set null,
  oportunidad_id uuid references oportunidades(id) on delete set null,
  ot_id uuid references ordenes_trabajo(id) on delete set null,
  tipo text not null default 'venta' check (tipo in ('venta','servicio','consumible','repuesto')),
  numero text not null,
  fecha date not null default current_date,
  vencimiento date,
  monto numeric,
  moneda text not null default 'ARS',
  cobro_estado text not null default 'pendiente'
    check (cobro_estado in ('pendiente','prometido','sin_respuesta','cobrado')),
  promesa_fecha date,
  cobrado_at timestamptz,
  condicion_aprobada_por uuid references usuarios(id),
  condicion_aprobada_at timestamptz,
  condicion_nota text,
  ultimo_reclamo_at timestamptz,
  nota text,
  created_by uuid references usuarios(id),
  created_at timestamptz not null default now()
);
create index if not exists facturas_cobro_idx on facturas (cobro_estado, vencimiento);
create index if not exists facturas_cliente_idx on facturas (cliente_id);
create index if not exists facturas_opp_idx on facturas (oportunidad_id);
create index if not exists facturas_ot_idx on facturas (ot_id);
alter table facturas enable row level security;
drop policy if exists facturas_select on facturas;
create policy facturas_select on facturas for select to authenticated
  using (fn_ve_todo() or (fn_rol() = 'comercial' and fn_puede_ver_cliente(cliente_id)));
drop policy if exists facturas_write on facturas;
create policy facturas_write on facturas for all to authenticated
  using (fn_rol() in ('direccion','admin','administrativa'))
  with check (fn_rol() in ('direccion','admin','administrativa'));

-- La "condición aprobada" (despachar sin cobro) la da dirección de
-- administración o dirección general, nunca la administrativa sola.
create or replace function fn_protege_condicion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT' and new.condicion_aprobada_por is not null)
     or (tg_op = 'UPDATE' and new.condicion_aprobada_por is distinct from old.condicion_aprobada_por) then
    if not fn_es_gestor() then
      raise exception 'Solo dirección puede aprobar despachar sin cobro';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_protege_condicion on facturas;
create trigger trg_protege_condicion before insert or update on facturas
  for each row execute function fn_protege_condicion();

-- =====================================================================
-- 5. Técnicos aliados (terceros, sin usuario)
-- =====================================================================
create table if not exists tecnicos_aliados (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  zona text,
  telefono text,
  email text,
  tarifa text,
  notas text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);
alter table tecnicos_aliados enable row level security;
drop policy if exists aliados_select on tecnicos_aliados;
create policy aliados_select on tecnicos_aliados for select to authenticated
  using (fn_ve_todo() or fn_rol() = 'tecnico');
drop policy if exists aliados_write on tecnicos_aliados;
create policy aliados_write on tecnicos_aliados for all to authenticated
  using (fn_rol() in ('direccion','admin','servicio'))
  with check (fn_rol() in ('direccion','admin','servicio'));

-- =====================================================================
-- 6. Casos de postventa (reclamos)
-- =====================================================================
create table if not exists casos (
  id uuid primary key default gen_random_uuid(),
  numero int generated always as identity,
  cliente_id uuid not null references clientes(id) on delete restrict,
  sucursal_id uuid references sucursales(id) on delete set null,
  equipo_id uuid references equipos(id) on delete set null,
  responsable_id uuid references usuarios(id),
  abierto_por uuid references usuarios(id),
  prioridad text not null default 'anda_mal' check (prioridad in ('parado','anda_mal','consulta')),
  descripcion text not null,
  estado text not null default 'abierto' check (estado in ('abierto','derivado','cerrado')),
  primera_respuesta_at timestamptz,
  derivado_at timestamptz,
  ot_id uuid references ordenes_trabajo(id) on delete set null,
  cerrado_at timestamptz,
  causa text,
  solucion text,
  created_at timestamptz not null default now()
);
create index if not exists casos_estado_idx on casos (estado, responsable_id);
alter table casos enable row level security;
drop policy if exists casos_select on casos;
create policy casos_select on casos for select to authenticated
  using (fn_ve_todo() or responsable_id = auth.uid() or fn_puede_ver_cliente(cliente_id));
drop policy if exists casos_insert on casos;
create policy casos_insert on casos for insert to authenticated
  with check (fn_puede_ver_cliente(cliente_id));
drop policy if exists casos_update on casos;
create policy casos_update on casos for update to authenticated
  using (fn_ve_todo() or responsable_id = auth.uid() or fn_rol() = 'tecnico');

-- =====================================================================
-- 7. Trabajo técnico: remito, cobro previo, aliado, instalación, garantía
-- =====================================================================
alter table ordenes_trabajo
  add column if not exists caso_id uuid references casos(id) on delete set null,
  add column if not exists aliado_id uuid references tecnicos_aliados(id) on delete set null,
  add column if not exists oportunidad_id uuid references oportunidades(id) on delete set null,
  add column if not exists remito_nro text,
  add column if not exists tiempo_min int,
  add column if not exists presupuesto_monto numeric,
  add column if not exists presupuesto_moneda text,
  add column if not exists presupuesto_aprobado_at timestamptz,
  add column if not exists cobro_ok_at timestamptz,
  add column if not exists acta_capacitado text,
  add column if not exists acta_garantia_desde date,
  add column if not exists garantia_reclamo text,
  add column if not exists garantia_reclamo_nota text;
alter table ordenes_trabajo drop constraint if exists ordenes_trabajo_garantia_reclamo_check;
alter table ordenes_trabajo add constraint ordenes_trabajo_garantia_reclamo_check
  check (garantia_reclamo is null or garantia_reclamo in
    ('a_presentar','presentado','repuesto_recibido','cerrado','rechazado'));

-- Fotos del remito firmado y del acta de instalación
alter table ot_fotos drop constraint if exists ot_fotos_momento_check;
alter table ot_fotos add constraint ot_fotos_momento_check
  check (momento in ('antes','despues','otro','remito','acta'));

-- Local / razón social de facturación (cuentas con varias razones sociales)
alter table sucursales
  add column if not exists razon_social text,
  add column if not exists cuit text,
  add column if not exists contacto_facturacion text,
  add column if not exists email_facturacion text;

-- Repuestos críticos con mínimo; video instructivo por modelo
alter table repuestos add column if not exists stock_minimo int;
alter table productos add column if not exists video_url text;

-- Transiciones: la administrativa factura y cierra; el técnico puede cerrar
-- un trabajo programado directo con el remito; un remito devuelto vuelve a
-- revisión cuando el técnico lo corrige.
do $$
declare c text;
begin
  for c in select conname from pg_constraint
           where conrelid = 'ot_transiciones'::regclass and contype = 'c'
  loop
    execute format('alter table ot_transiciones drop constraint %I', c);
  end loop;
end $$;
alter table ot_transiciones add constraint ot_transiciones_requiere_rol_check
  check (requiere_rol in ('cualquiera','tecnico','gestor','administracion'));
update ot_transiciones set requiere_rol = 'administracion'
 where (desde, hacia) in (('aprobado_facturar','facturado'), ('facturado','cerrado'));
insert into ot_transiciones (desde, hacia, requiere_rol) values
  ('programado','finalizado_tecnico','tecnico'),
  ('asignado','finalizado_tecnico','tecnico'),
  ('en_camino','finalizado_tecnico','tecnico'),
  ('esperando_repuesto','finalizado_tecnico','tecnico'),
  ('esperando_cliente','finalizado_tecnico','tecnico'),
  ('devuelto_tecnico','finalizado_tecnico','tecnico'),
  ('solicitud_recibida','programado','gestor'),
  ('solicitud_recibida','asignado','gestor'),
  ('aprobado_facturar','cerrado','gestor')
on conflict (desde, hacia) do nothing;

-- Cierre técnico: trabajo hecho + remito (firma o foto del remito) + foto del
-- equipo andando. El tiempo va en el remito, ya no se exige el cronómetro.
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
  insert into status_history (ot_id, desde, hacia, usuario_id)
  values (new.id, old.estado, new.estado, auth.uid());
  return new;
end $$;

-- =====================================================================
-- 8. Propuesta fuera de lista: aprobación de dirección antes de enviar
-- =====================================================================
alter table cotizacion_versiones
  add column if not exists aprobacion text not null default 'no_requiere',
  add column if not exists aprobacion_motivo text,
  add column if not exists aprobado_por uuid references usuarios(id),
  add column if not exists aprobado_at timestamptz,
  add column if not exists aprobacion_nota text;
alter table cotizacion_versiones drop constraint if exists cotizacion_versiones_aprobacion_check;
alter table cotizacion_versiones add constraint cotizacion_versiones_aprobacion_check
  check (aprobacion in ('no_requiere','pendiente','aprobada','rechazada'));

create or replace function fn_protege_aprobacion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.aprobacion in ('aprobada','rechazada')
     and (tg_op = 'INSERT' or new.aprobacion is distinct from old.aprobacion)
     and coalesce(fn_rol(), '') <> 'direccion' then
    raise exception 'Solo dirección general aprueba propuestas fuera de lista';
  end if;
  return new;
end $$;
drop trigger if exists trg_protege_aprobacion on cotizacion_versiones;
create trigger trg_protege_aprobacion before insert or update on cotizacion_versiones
  for each row execute function fn_protege_aprobacion();

-- =====================================================================
-- 9. Informe comercial semanal y pedidos a marketing
-- =====================================================================
create table if not exists informes_semanales (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  semana date not null,
  numeros jsonb not null default '{}',
  bloqueos text,
  decisiones text,
  agenda text,
  enviado_at timestamptz,
  respuesta text,
  respondido_por uuid references usuarios(id),
  respondido_at timestamptz,
  created_at timestamptz not null default now(),
  unique (usuario_id, semana)
);
alter table informes_semanales enable row level security;
drop policy if exists informes_select on informes_semanales;
create policy informes_select on informes_semanales for select to authenticated
  using (usuario_id = auth.uid() or fn_es_gestor());
drop policy if exists informes_write on informes_semanales;
create policy informes_write on informes_semanales for all to authenticated
  using (usuario_id = auth.uid() or fn_es_gestor())
  with check (usuario_id = auth.uid() or fn_es_gestor());

create table if not exists pedidos_material (
  id uuid primary key default gen_random_uuid(),
  pedido_por uuid references usuarios(id),
  titulo text not null,
  detalle text,
  para_fecha date,
  estado text not null default 'pedido' check (estado in ('pedido','en_curso','entregado')),
  fecha_comprometida date,
  entregado_at timestamptz,
  created_at timestamptz not null default now()
);
alter table pedidos_material enable row level security;
drop policy if exists pedidos_material_select on pedidos_material;
create policy pedidos_material_select on pedidos_material for select to authenticated using (true);
drop policy if exists pedidos_material_insert on pedidos_material;
create policy pedidos_material_insert on pedidos_material for insert to authenticated
  with check (auth.uid() is not null);
drop policy if exists pedidos_material_update on pedidos_material;
create policy pedidos_material_update on pedidos_material for update to authenticated
  using (fn_es_gestor() or fn_rol() = 'marketing' or pedido_por = auth.uid());

-- =====================================================================
-- 10. Reglas "a definir" como ajustes editables por dirección
-- =====================================================================
insert into config (clave, valor) values
  ('dias_atraso_frena_despacho', '30'),
  ('descuento_libre_pct', '0'),
  ('plazo_pago_aliados_dias', '')
on conflict (clave) do nothing;

-- =====================================================================
-- 11. Permisos: cada puesto ve y hace lo suyo
-- =====================================================================
-- Un contacto con dueño es privado de ese dueño solo si el dueño es un
-- vendedor de territorio. Los de dirección, administración, etc. son de todos.
create or replace function fn_comercial_ve_cliente(cid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from clientes c
    left join usuarios u on u.id = c.comercial_id
    where c.id = cid
      and (c.comercial_id is null or c.comercial_id = auth.uid() or coalesce(u.rol, '') <> 'comercial')
  )
$$;

create or replace function fn_puede_ver_cliente(cid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select fn_ve_todo()
    or fn_rol() in ('marketing','tecnico')
    or (fn_rol() = 'comercial' and fn_comercial_ve_cliente(cid))
    or (fn_rol() = 'distribuidor' and exists (
          select 1 from clientes c where c.id = cid and c.distribuidor_id = fn_distribuidor()))
$$;

create or replace function fn_puede_ver_ot(oid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from ordenes_trabajo o where o.id = oid and (
    fn_ve_todo()
    or (fn_rol() = 'tecnico' and (o.tecnico_id = auth.uid() or o.tecnico_id is null))
    or (fn_rol() = 'comercial' and fn_puede_ver_cliente(o.cliente_id))
    or (fn_rol() = 'distribuidor' and exists (
          select 1 from clientes c where c.id = o.cliente_id and c.distribuidor_id = fn_distribuidor()))))
$$;

drop policy if exists clientes_select on clientes;
create policy clientes_select on clientes for select to authenticated
  using (
    (deleted_at is null or fn_es_gestor()) and (
      fn_ve_todo() or fn_rol() in ('marketing','tecnico')
      or (fn_rol() = 'comercial' and fn_comercial_ve_cliente(id))
      or (fn_rol() = 'distribuidor' and distribuidor_id = fn_distribuidor())
    ));
drop policy if exists clientes_update on clientes;
create policy clientes_update on clientes for update to authenticated
  using (
    fn_ve_todo() or fn_rol() = 'tecnico'
    or (fn_rol() = 'comercial' and fn_comercial_ve_cliente(id))
    or (fn_rol() = 'distribuidor' and distribuidor_id = fn_distribuidor())
  );
drop policy if exists clientes_insert on clientes;
create policy clientes_insert on clientes for insert to authenticated
  with check (fn_ve_todo() or fn_rol() in ('comercial','tecnico')
    or (fn_rol() = 'distribuidor' and distribuidor_id = fn_distribuidor()));

drop policy if exists opps_select on oportunidades;
create policy opps_select on oportunidades for select to authenticated
  using (
    (deleted_at is null or fn_es_gestor()) and (
      fn_ve_todo()
      or (fn_rol() = 'comercial' and fn_comercial_ve_cliente(cliente_id))
      or (fn_rol() = 'tecnico')
      or (fn_rol() = 'distribuidor' and exists (
            select 1 from clientes c where c.id = cliente_id and c.distribuidor_id = fn_distribuidor()))
    ));
drop policy if exists opps_update on oportunidades;
create policy opps_update on oportunidades for update to authenticated
  using (fn_ve_todo() or (fn_rol() = 'comercial' and fn_comercial_ve_cliente(cliente_id)));
drop policy if exists opps_insert on oportunidades;
create policy opps_insert on oportunidades for insert to authenticated
  with check (fn_ve_todo() or fn_rol() in ('comercial','distribuidor'));

drop policy if exists ot_select on ordenes_trabajo;
create policy ot_select on ordenes_trabajo for select to authenticated
  using (
    (deleted_at is null or fn_es_gestor()) and (
      fn_ve_todo()
      or (fn_rol() = 'tecnico' and (tecnico_id = auth.uid() or tecnico_id is null))
      or (fn_rol() = 'comercial' and fn_puede_ver_cliente(cliente_id))
      or (fn_rol() = 'distribuidor' and fn_cliente_de_mi_cartera(cliente_id))
    ));
drop policy if exists ot_update on ordenes_trabajo;
create policy ot_update on ordenes_trabajo for update to authenticated
  using (fn_ve_todo() or (fn_rol() = 'tecnico' and (tecnico_id = auth.uid() or tecnico_id is null)));
drop policy if exists ot_insert on ordenes_trabajo;
create policy ot_insert on ordenes_trabajo for insert to authenticated
  with check (fn_ve_todo() or fn_rol() in ('tecnico','comercial','distribuidor'));

drop policy if exists cotiz_all on cotizaciones;
create policy cotiz_all on cotizaciones for all to authenticated
  using (exists (select 1 from oportunidades o where o.id = oportunidad_id
    and (fn_ve_todo() or o.comercial_id = auth.uid() or o.comercial_id is null)))
  with check (true);
drop policy if exists cotizv_all on cotizacion_versiones;
create policy cotizv_all on cotizacion_versiones for all to authenticated
  using (exists (select 1 from cotizaciones c join oportunidades o on o.id = c.oportunidad_id
    where c.id = cotizacion_id and (fn_ve_todo() or o.comercial_id = auth.uid() or o.comercial_id is null)))
  with check (true);
drop policy if exists cotizi_all on cotizacion_items;
create policy cotizi_all on cotizacion_items for all to authenticated
  using (exists (select 1 from cotizacion_versiones v
    join cotizaciones c on c.id = v.cotizacion_id
    join oportunidades o on o.id = c.oportunidad_id
    where v.id = version_id and (fn_ve_todo() or o.comercial_id = auth.uid() or o.comercial_id is null)))
  with check (true);

drop policy if exists documentos_select on documentos;
create policy documentos_select on documentos for select to authenticated
  using (
    fn_ve_todo()
    or (entidad = 'cliente' and fn_puede_ver_cliente(entidad_id))
    or (entidad = 'equipo' and exists (
          select 1 from equipos e where e.id = entidad_id and fn_puede_ver_cliente(e.cliente_id)))
    or (entidad = 'orden' and exists (
          select 1 from ordenes_trabajo o where o.id = entidad_id
            and (o.tecnico_id = auth.uid() or fn_puede_ver_cliente(o.cliente_id))))
    or (entidad = 'oportunidad' and exists (
          select 1 from oportunidades op where op.id = entidad_id and op.comercial_id = auth.uid()))
    or entidad = 'repuesto');

drop policy if exists "storage_select_gestor" on storage.objects;
create policy "storage_select_gestor" on storage.objects for select to authenticated
  using (bucket_id in ('servicio','documentos','cotizaciones') and fn_ve_todo());

drop policy if exists feria_select on feria_leads;
create policy feria_select on feria_leads for select to authenticated
  using (fn_ve_todo() or fn_rol() = 'marketing' or asignado_a is null or asignado_a = auth.uid());
drop policy if exists feria_insert on feria_leads;
create policy feria_insert on feria_leads for insert to authenticated
  with check (fn_ve_todo() or fn_rol() in ('comercial','marketing'));
drop policy if exists feria_update on feria_leads;
create policy feria_update on feria_leads for update to authenticated
  using (fn_ve_todo() or asignado_a is null or asignado_a = auth.uid());

drop policy if exists tareas_all on tareas;
create policy tareas_all on tareas for all to authenticated
  using (fn_ve_todo() or usuario_id = auth.uid() or usuario_id is null
    or fn_puede_ver_cliente(cliente_id))
  with check (fn_puede_ver_cliente(cliente_id));

-- Stock: el calendario de ingresos lo carga dirección; la recepción ("Llegó")
-- la marca el técnico en el depósito o la administración.
drop policy if exists ingresos_write on ingresos_stock;
create policy ingresos_write on ingresos_stock for all to authenticated
  using (fn_es_gestor()) with check (fn_es_gestor());
drop policy if exists ingresos_recibir on ingresos_stock;
create policy ingresos_recibir on ingresos_stock for update to authenticated
  using (fn_rol() in ('tecnico','administrativa','servicio'))
  with check (fn_rol() in ('tecnico','administrativa','servicio'));

-- Facturar: dirección, dirección de administración y administrativa
create or replace function fn_protege_facturacion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.nro_factura is distinct from old.nro_factura)
     and coalesce(fn_rol(), '') not in ('direccion','admin','administrativa') then
    raise exception 'Solo administración puede cargar el número de factura';
  end if;
  return new;
end $$;
