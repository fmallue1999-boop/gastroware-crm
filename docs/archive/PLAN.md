# Plan técnico — CRM GastroWare / Zumex

> Cockpit de ventas mobile-first para GastroWare Argentina. Foco: seguimiento comercial,
> venta guiada de GX22/GX18 y Zumex, y cartera de clientes con recompra de consumibles.
> Basado en `Analisis_CRM_GastroWare_GX22_Zumex.docx` + flujo definido por Franco (jul 2026).

---

## 1. Visión y principios

**Qué es:** una herramienta para vender primero, sistema de registro después. El registro
es un subproducto de vender: cargo el lead porque eso me da la plantilla, el recordatorio
y la calculadora.

**Los dos motores:**
1. **Motor de venta:** consulta → cliente → diagnóstico → cotización → seguimiento D+2/5/10/20 → cierre.
2. **Motor de cartera:** cliente ganado → equipos instalados → recurrencias de consumibles
   (ej. pastillas Rational cada ~45 días) → recordatorio automático → recompra.

**Principios de diseño:**
- Prueba del pulgar: toda acción frecuente debe poder hacerse desde el celular, en menos
  de 30 segundos, entre dos chats de WhatsApp.
- Nada obligatorio que no sirva para vender. La ficha acepta datos incompletos.
- Regla de oro: ninguna oportunidad abierta sin próxima acción; ninguna perdida sin motivo.
- El precio nunca sale "suelto": advertencia/bloqueo si se cotiza sin diagnóstico mínimo.

---

## 2. Stack y arquitectura

| Capa | Elección | Por qué |
|---|---|---|
| Frontend + API | Next.js 15 (App Router, TypeScript) | Mismo stack que zumex.com.ar; deploy conocido |
| UI | Tailwind CSS, mobile-first, PWA instalable | El vendedor lo usa desde el celular |
| Base de datos | Supabase (Postgres) | Gratis al inicio, SQL real, crece bien |
| Auth | Supabase Auth (email + password) | 2–4 usuarios, roles admin/vendedor |
| Archivos | Supabase Storage | PDFs de cotizaciones, fotos, materiales |
| Jobs | Vercel Cron (diario) | Generar tareas de recurrencia y reactivación |
| Deploy | Vercel | Igual que el sitio de Zumex |

Costo inicial: $0 (planes free de Vercel y Supabase alcanzan de sobra para este volumen).

---

## 3. Modelo de datos

Entidad central: **el cliente** (no el lead). Un cliente tiene N oportunidades a lo largo
del tiempo, N equipos instalados y N recurrencias.

```sql
-- Usuarios del sistema
create table usuarios (
  id uuid primary key references auth.users,
  nombre text not null,
  rol text not null check (rol in ('admin','vendedor')) default 'vendedor',
  activo boolean default true
);

-- Clientes (prospectos y clientes activos, misma tabla)
create table clientes (
  id uuid primary key default gen_random_uuid(),
  nombre_comercial text not null,
  razon_social text,
  rubro text not null,                    -- lista cerrada, ver sección 6
  ciudad text,
  provincia text,
  telefono text,                          -- normalizado, clave de deduplicación
  email text,
  instagram_web text,
  estado text not null default 'prospecto'
    check (estado in ('prospecto','cliente_activo','inactivo')),
  potencial text check (potencial in ('alto','medio','bajo')),
  vendedor_id uuid references usuarios(id),
  notas text,
  created_at timestamptz default now()
);
create index on clientes (telefono);
create index on clientes (rubro, estado);

-- Personas de contacto (opcional; el cliente chico vive con los campos de arriba)
create table contactos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  nombre text not null,
  cargo text,
  telefono text,
  es_decisor boolean default false
);

-- Catálogo de productos (incluye consumibles)
create table productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,                   -- 'GX22', 'Zumex Speed Pro', 'Pastillas Rational'
  marca text,                             -- 'GastroWare', 'Zumex', 'Rational'
  categoria text not null,               -- 'licuadora','exprimidora','horno','consumible','otro'
  es_consumible boolean default false,
  frecuencia_recompra_dias int,           -- solo consumibles (ej. 45)
  consumible_de uuid references productos(id),  -- pastillas → horno Rational
  precio_referencia numeric,
  moneda text default 'ARS',
  activo boolean default true
);

-- Oportunidades (una consulta/negocio activo)
create table oportunidades (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id),
  producto_id uuid references productos(id),
  vendedor_id uuid references usuarios(id),
  etapa text not null default 'nueva' check (etapa in
    ('nueva','diagnostico','cotizada','seguimiento','negociacion','ganada','perdida')),
  temperatura text check (temperatura in ('caliente','tibio','frio')),
  origen text not null,                   -- lista cerrada, ver sección 6
  monto_estimado numeric,
  moneda text default 'ARS',
  diagnostico jsonb default '{}',         -- campos por producto, ver sección 4.3
  objecion_principal text,                -- lista cerrada
  motivo_perdida text,                    -- obligatorio si etapa = 'perdida'
  fecha_cierre_estimada date,
  mensaje_inicial text,
  created_at timestamptz default now(),
  closed_at timestamptz
);
create index on oportunidades (etapa, vendedor_id);

-- Cotizaciones (propias o subidas por un vendedor externo)
create table cotizaciones (
  id uuid primary key default gen_random_uuid(),
  oportunidad_id uuid not null references oportunidades(id) on delete cascade,
  monto numeric,
  moneda text default 'ARS',
  archivo_url text,                       -- PDF o foto en Storage
  validez_dias int,
  forma_pago text,
  enviada_at timestamptz default now(),
  notas text
);

-- Tareas (seguimientos, recompras, reactivaciones, postventa)
create table tareas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id),
  oportunidad_id uuid references oportunidades(id) on delete cascade,
  vendedor_id uuid references usuarios(id),
  tipo text not null check (tipo in
    ('seguimiento','reactivacion','recompra','postventa','otro')),
  titulo text not null,                   -- 'Seguimiento D+5: enviar video y comparativa'
  plantilla_id uuid references plantillas(id),
  vence_el date not null,
  auto boolean default false,             -- generada por el sistema
  completada_at timestamptz,
  cancelada boolean default false
);
create index on tareas (vendedor_id, vence_el) where completada_at is null and not cancelada;

-- Equipos instalados (lo que el cliente ya compró — motor de cartera)
create table equipos_instalados (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id),
  producto_id uuid not null references productos(id),
  cantidad int default 1,
  fecha_compra date,
  oportunidad_id uuid references oportunidades(id),
  notas text
);

-- Recurrencias de consumibles
create table recurrencias (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id),
  producto_id uuid not null references productos(id),  -- el consumible
  frecuencia_dias int not null,
  ultima_compra date,
  proxima_alerta date not null,
  activa boolean default true
);

-- Timeline de actividades por cliente
create table actividades (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id),
  oportunidad_id uuid references oportunidades(id),
  tipo text not null,                     -- 'nota','whatsapp','llamada','visita','cambio_etapa','cotizacion'
  contenido text,
  created_by uuid references usuarios(id),
  created_at timestamptz default now()
);

-- Plantillas de mensajes
create table plantillas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,                   -- 'Seguimiento D+2', 'Objeción precio GX22'
  uso text not null,                      -- 'd2','d5','d10','d20','objecion:<tipo>','diagnostico','precio'
  producto_id uuid references productos(id),  -- null = genérica
  contenido text not null                 -- con variables {nombre}, {producto}, {monto}
);

-- Biblioteca de materiales comerciales
create table materiales (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text not null,                     -- 'ficha','video','comparativa','caso','calculadora','institucional','guia'
  producto_id uuid references productos(id),
  url text,                               -- link externo o Storage
  prioridad text default 'alta'
);
```

---

## 4. Reglas de negocio

### 4.1 Deduplicación
Al crear cliente, buscar por teléfono normalizado (solo dígitos, sin 0/15). Si existe,
abrir la ficha existente con su historial en lugar de crear.

### 4.2 Cadencia automática de seguimiento
Al pasar una oportunidad a `cotizada`, crear 4 tareas automáticas:
- D+2: "Preguntar si quiere financiación o comparar alternativas" (plantilla d2)
- D+5: "Enviar video / caso / comparativa" (plantilla d5)
- D+10: "Preguntar el freno: valor, momento o comparación" (plantilla d10)
- D+20: "Última reactivación y pasar a nurturing" (plantilla d20)

Las tareas pendientes de la cadencia se cancelan automáticamente al pasar a
`negociacion`, `ganada` o `perdida`. Se pueden posponer o cancelar a mano
(si el cliente respondió, la secuencia se pausa).

### 4.3 Diagnóstico mínimo antes de cotizar (advertencia, no bloqueo duro en v1)
- **GX22/GX18** (`diagnostico` JSONB): `uso_principal`, `usos_por_dia`, `equipo_actual`,
  `problema_actual`. Advertir al cotizar si faltan `uso_principal` o `usos_por_dia`.
- **Zumex**: `punto_de_venta`, `vasos_dia`, `precio_vaso`, `costo_naranja_vaso`,
  `espacio`, `recupero_meses` (calculado). Advertir al cotizar si no hay cuenta de recupero.

### 4.4 Cierre
- `ganada` → crear `equipos_instalados`, tareas de postventa (check-in a 7 y 30 días),
  y si el producto tiene consumible asociado (`consumible_de`), ofrecer crear la recurrencia.
  Cliente pasa a `estado = cliente_activo`.
- `perdida` → `motivo_perdida` obligatorio. Si el motivo es "no prioridad" o "lo ve más
  adelante", crear tarea de reactivación a +45 días automáticamente.

### 4.5 Recurrencias (cron diario)
Job diario: por cada recurrencia activa con `proxima_alerta <= hoy`, crear tarea tipo
`recompra` ("Ofrecer pastillas Rational a {cliente} — última compra hace {n} días").
Al registrar la recompra, actualizar `ultima_compra` y recalcular `proxima_alerta`.

### 4.6 Regla de oro (guardia de UI)
Toda oportunidad abierta debe tener al menos una tarea pendiente. Si el vendedor completa
la última tarea sin crear otra, la UI le exige elegir: próxima acción (con fecha) o cerrar
la oportunidad (ganada/perdida con motivo).

### 4.7 Calculadora Zumex
Inputs: vasos/día (3 escenarios), precio por vaso, costo naranja por vaso, otros costos
variables, días operativos/mes, valor del equipo. Outputs: margen bruto mensual y meses
de recupero por escenario. Genera una vista compartible (link o imagen) con marca
GastroWare para mandar al cliente. El resultado se guarda en `diagnostico.recupero_meses`.

---

## 5. Pantallas y rutas

| Ruta | Pantalla | Contenido clave |
|---|---|---|
| `/hoy` | **Hoy** (home) | Tareas vencidas + de hoy, ordenadas por temperatura; cada una con plantilla lista para copiar |
| `/alta` | Alta rápida | Teléfono (busca duplicado) → nombre → producto → rubro → origen → temperatura. 30 segundos |
| `/pipeline` | Kanban | Columnas por etapa, filtro por producto y vendedor; tarjeta: cliente, producto, monto, próxima acción |
| `/clientes` | Cartera | Lista/filtros por rubro, ciudad, estado, equipo instalado; buscador por nombre/teléfono |
| `/clientes/[id]` | Ficha de cliente | Datos, equipos instalados, recurrencias, oportunidades, timeline, herramientas para mandar |
| `/oportunidades/[id]` | Ficha de oportunidad | Etapa, diagnóstico, cotizaciones (PDF), objeción, tareas, materiales sugeridos |
| `/calculadora` | Calculadora Zumex | Standalone; genera resultado compartible; embebida también en la oportunidad |
| `/biblioteca` | Biblioteca | Materiales por producto y tipo, botón copiar link |
| `/reportes` | Reportes (v1 simple) | Embudo por producto, conversión por canal, motivos de pérdida, seguimientos vencidos por vendedor |
| `/config` | Configuración (admin) | Productos, plantillas, materiales, usuarios, listas |

Navegación mobile: barra inferior con Hoy · Pipeline · **+** (alta) · Clientes · Más.

---

## 6. Listas cerradas (seeds iniciales)

- **Rubros:** cafetería, cadena de cafeterías, restaurante, hotel, heladería,
  estación de servicio, supermercado, panadería, bar, catering, otro.
- **Orígenes:** WhatsApp, Instagram, web, Mercado Libre, referido, vendedor, visita, otro.
- **Objeciones:** precio, marca/confianza, financiación, garantía, espacio, limpieza/operación,
  no es prioridad, está comparando, desaparece/no responde.
- **Motivos de pérdida:** precio, compró competencia, no era el momento, sin respuesta,
  financiación, espacio/operación, otro.
- **Temperatura:** caliente / tibio / frío (manual en v1, con la guía de puntos del análisis como referencia).
- **Productos iniciales:** GX22, GX18, Zumex (modelos según catálogo), Horno Rational,
  Pastillas de limpieza Rational (consumible, 45 días, consumible_de = Horno Rational).

---

## 7. Fases de construcción

| Fase | Alcance | Estimación |
|---|---|---|
| **1. Base** | Proyecto Next.js + Supabase, auth y roles, esquema completo, alta rápida con dedup, lista y ficha de clientes | Semana 1 |
| **2. Motor de venta** | Oportunidades, pipeline kanban, subir cotización (PDF/foto), tareas, pantalla Hoy, cadencia D+2/5/10/20, regla de oro | Semana 2 |
| **3. Venta guiada** | Diagnóstico por producto con advertencias, plantillas con variables y botón copiar, biblioteca, calculadora Zumex compartible | Semana 3 |
| **4. Cartera y cierre** | Equipos instalados, recurrencias + cron diario, flujo ganada/perdida completo, reportes básicos, carga de datos reales y ajustes | Semana 4 |

Al final de la fase 2 la herramienta ya es usable en el día a día (registrar, cotizar,
seguir). Las fases 3 y 4 suman la venta guiada y la cartera.

**Fuera de alcance v1:** WhatsApp Business API (se copia/pega), generación automática de
PDF de propuesta, scoring automático, IA de respuestas, inventario/stock, facturación.

---

## 8. KPIs que la v1 debe poder responder

- ¿Cuántos leads entraron esta semana y por qué canal?
- ¿Qué % de cotizados recibió los 4 seguimientos? (meta: >90%)
- ¿Por qué se pierden las ventas? (motivo registrado en >95% de las perdidas)
- ¿Cuánto hay en el pipeline por etapa y producto?
- ¿Qué recompras de consumibles vencen este mes?

---

## 9. Decisiones pendientes (para confirmar con Franco antes o durante la fase 1)

1. Modelos exactos de Zumex a cargar en catálogo y precios de referencia.
2. ¿Los vendedores externos tienen usuario propio o solo se les asigna nombre?
3. Textos definitivos de las plantillas (el análisis trae borradores muy buenos, sección 10 y 11).
4. Dominio/subdominio para la app (ej. `crm.gastroware.com.ar`) — puede esperar; arranca en `*.vercel.app`.
