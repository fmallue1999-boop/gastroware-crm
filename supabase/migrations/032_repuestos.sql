-- 032: Repuestos (v1.5).
-- Una solicitud de repuesto es una operación comercial del apartado
-- repuestos (oportunidades.linea = 'repuestos') con sus datos propios:
-- equipo, modelo, serie, qué pieza, código o foto, cantidad, validación
-- técnica, disponibilidad, plazo y precio. Puede venir de un caso o de un
-- service sin volver a cargar cliente ni equipo. Al ganarla sigue el circuito
-- de la venta (facturar, cobrar, preparar, entregar).
-- Solo agrega una tabla; no toca datos. Idempotente.

create table if not exists solicitudes_repuesto (
  oportunidad_id uuid primary key references oportunidades(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  -- El equipo (si está cargado) o el modelo escrito
  equipo_id uuid references equipos(id) on delete set null,
  modelo_texto text,
  numero_serie text,
  -- La pieza: del catálogo de repuestos o descripta
  repuesto_id uuid references repuestos(id) on delete set null,
  descripcion text not null check (char_length(btrim(descripcion)) between 1 and 500),
  codigo text,
  foto_path text,
  cantidad numeric not null default 1 check (cantidad > 0),
  -- Validación técnica: no_requiere (ya está identificada) · pendiente · validada · no_se_pudo
  validacion text not null default 'pendiente'
    check (validacion in ('no_requiere','pendiente','validada','no_se_pudo')),
  validador_id uuid references usuarios(id),
  validado_por uuid references usuarios(id),
  validado_at timestamptz,
  validacion_nota text,
  -- Disponibilidad y precio (cuando se cotiza)
  disponibilidad text check (disponibilidad in ('en_stock','a_pedir','sin_disponibilidad')),
  plazo_dias int check (plazo_dias is null or plazo_dias between 0 and 365),
  precio_unitario numeric check (precio_unitario is null or precio_unitario >= 0),
  moneda text not null default 'ARS' check (moneda in ('ARS','USD')),
  -- De dónde vino
  caso_id uuid references casos(id) on delete set null,
  ot_id uuid references ordenes_trabajo(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists solic_rep_validador_idx on solicitudes_repuesto (validador_id, validacion);
create index if not exists solic_rep_cliente_idx on solicitudes_repuesto (cliente_id);

create or replace function fn_solicitud_touch() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists tg_solicitud_touch on solicitudes_repuesto;
create trigger tg_solicitud_touch before update on solicitudes_repuesto
  for each row execute function fn_solicitud_touch();

-- Quién validó, cotizó o cambió cada solicitud
drop trigger if exists tg_audit_solicitudes_repuesto on solicitudes_repuesto;
create trigger tg_audit_solicitudes_repuesto after insert or update or delete on solicitudes_repuesto
  for each row execute function fn_audit();

-- Permisos: quien ve la operación ve la solicitud; quien tiene que validarla
-- (técnico o responsable de servicio) la ve y la valida aunque no vea ventas.
alter table solicitudes_repuesto enable row level security;
drop policy if exists solic_rep_select on solicitudes_repuesto;
create policy solic_rep_select on solicitudes_repuesto for select to authenticated
  using (validador_id = auth.uid() or exists (select 1 from oportunidades o where o.id = oportunidad_id));
drop policy if exists solic_rep_insert on solicitudes_repuesto;
create policy solic_rep_insert on solicitudes_repuesto for insert to authenticated
  with check (exists (select 1 from oportunidades o where o.id = oportunidad_id));
drop policy if exists solic_rep_update on solicitudes_repuesto;
create policy solic_rep_update on solicitudes_repuesto for update to authenticated
  using (validador_id = auth.uid() or fn_ve_todo() or exists (select 1 from oportunidades o where o.id = oportunidad_id))
  with check (validador_id = auth.uid() or fn_ve_todo() or exists (select 1 from oportunidades o where o.id = oportunidad_id));
