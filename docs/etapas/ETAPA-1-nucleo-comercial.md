# Etapa 1 — Núcleo comercial simple

> Especificación para ejecutar en Claude Code sobre `gastroware-crm`, después de terminar la Etapa 0.
> Contexto: este documento, `docs/PLAN-OS.md` y `ETAPA-0`. Rama `etapa-1`. Un commit por punto.
> Reemplaza la versión anterior de esta etapa. Cambio de fondo: **no hay motor de tareas para ventas**. Cada interés tiene una sola próxima fecha, y los pendientes se calculan a partir de eso. Nada se acumula, nada se agenda solo.
> Antes de escribir código, leer `AGENTS.md`, `lib/constants.ts`, `lib/stock.ts`, `lib/actions.ts`, `app/(app)/clientes/page.tsx`, `app/(app)/clientes/[id]/page.tsx`, `app/(app)/oportunidades/[id]/page.tsx`, `app/(app)/stock/page.tsx`, `app/(app)/movimientos/page.tsx` y los componentes `InteresNuevoForm`, `InteresControl`, `EtapaControl`, `AnotarContacto`, `SeguimientoItem`, `TareaItem`, `PosponerPanel`, `CotizacionForm`, `VentaPaso`, `StockAdmin`.

## Lo que pidió la dirección (criterios de aceptación en sus palabras)

1. Al abrir: todos los contactos, cómo contactarlos, y toda la información de cada uno.
2. Lo que está pendiente tiene que entenderse de un vistazo. Hoy no se entiende.
3. Se carga el **interés** primero (qué quiere comprar) y después a quién pertenece. No se cargan todas las consultas, solo los interesados reales.
4. Seguimiento muy simple: una fecha para volver a contactar, si hace falta. Sin recordatorios automáticos.
5. Si no hay stock, el interés va a lista de espera. Todos los vendedores ven el stock disponible y lo que va a ingresar, con fecha.
6. Todo lo que se hizo y se habló con cada cliente queda registrado como movimientos.
7. Vendido → preparar → facturar → entregado.
8. El técnico carga un service si lo hizo, con o sin agenda.
9. Se usa desde el teléfono y desde la computadora, por gente con poca afinidad con la tecnología.

Buena parte de esto ya existe desde el commit `900d9a8` (7 sep). Esta etapa **no lo rehace**: lo simplifica donde está confuso, completa lo que falta y unifica el modelo.

---

## 1.1 El modelo: un interés, una próxima fecha

### Cambio de base (migración `026_interes_simple.sql`)

```sql
-- Próximo contacto vive en el interés, no en una tabla de tareas.
alter table oportunidades
  add column if not exists proximo_contacto date,
  add column if not exists proximo_nota text,
  add column if not exists ultimo_movimiento_at timestamptz not null default now();

create index if not exists opps_proximo_idx on oportunidades (comercial_id, proximo_contacto)
  where etapa in ('nueva','cotizada','seguimiento','espera');

-- Migrar las tareas manuales pendientes de ventas al interés (la más próxima por oportunidad).
update oportunidades o set
  proximo_contacto = t.vence_el,
  proximo_nota = t.titulo
from (
  select distinct on (oportunidad_id) oportunidad_id, vence_el, titulo
  from tareas
  where completada_at is null and not cancelada and oportunidad_id is not null
    and tipo in ('seguimiento','otro')
  order by oportunidad_id, vence_el
) t
where o.id = t.oportunidad_id and o.etapa in ('nueva','cotizada','seguimiento','espera');

-- Las tareas migradas se cancelan (se conserva el historial).
update tareas set cancelada = true
where completada_at is null and not cancelada and oportunidad_id is not null
  and tipo in ('seguimiento','otro');

-- Trigger: cualquier actividad sobre un interés actualiza ultimo_movimiento_at.
create or replace function fn_toca_interes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.oportunidad_id is not null then
    update oportunidades set ultimo_movimiento_at = now() where id = new.oportunidad_id;
  end if;
  return new;
end $$;
drop trigger if exists trg_toca_interes on actividades;
create trigger trg_toca_interes after insert on actividades
  for each row execute function fn_toca_interes();
```

La tabla `tareas` queda para servicio técnico, recompras y (Etapa 4) cobranzas. **Ninguna acción del módulo comercial inserta en `tareas`.** Buscar y eliminar en `lib/actions.ts` toda creación de tareas desde `crearInteres`, `anotarContacto`, `cambiarEtapa`, `registrarCotizacion`, `avanzarPedido`, `cargarServiceHecho`.

### Reglas

- Un interés abierto puede tener **una** próxima fecha o ninguna. Cambiarla reemplaza la anterior.
- Anotar un movimiento ("¿Qué pasó?") siempre ofrece los chips **Mañana / 3 días / 1 semana / 2 semanas / 1 mes / Sin fecha**. Ninguno preseleccionado. Un toque y listo.
- "Sin fecha" es válido y visible: el interés aparece en gris en "Sin fecha" (ver 1.3), no en rojo. No es un error, es información.
- Las **únicas** cosas que el sistema hace solo:
  1. Cuando administración marca un ingreso de stock como recibido, los intereses en **lista de espera** de ese producto pasan a `proximo_contacto = hoy` con `proximo_nota = "Llegó stock"`. Nada más.
  2. Las recurrencias de consumibles siguen creando tareas de recompra (ya existen), pero se muestran en un bloque aparte, plegado, y solo si hay (ver 1.3).
- No hay cadencias, no hay reactivación automática, no hay "cómo anda" automático, no hay avisos de vigencia. Si la dirección los quiere más adelante, se agregan como chips sugeridos, nunca como tareas silenciosas.

---

## 1.2 Vocabulario y estados

| Se dice | Reemplaza a | Dónde vive |
|---|---|---|
| Contacto | cliente / lead / prospecto | `clientes` |
| Interés | oportunidad / consulta | `oportunidades` (etapas abiertas) |
| Venta | pedido | `oportunidades` en `ganada` + `pedido_estado` |
| Movimiento | actividad / nota / seguimiento | `actividades` |

Etapas del interés, visibles como chips en la ficha (reemplazan a `ETAPAS` en `lib/constants.ts`; la base ya las soporta):

| Etapa | Cuándo |
|---|---|
| Interesado | recién cargado (`nueva`) |
| Cotizado | tiene al menos una cotización (`cotizada`) |
| En seguimiento | hubo contacto después de cotizar (`seguimiento`) — se pone sola al anotar un movimiento sobre un interés cotizado |
| Lista de espera | quiere comprar y no hay stock (`espera`) |
| Vendido | `ganada` → entra al circuito de venta |
| No se dio | `perdida`, con motivo |

Nivel de interés (ya existe como `temperatura`): **Muy interesado / Interesado / Solo preguntó**. Se muestra como puntito de color al lado del interés en todas las listas.

Estado del contacto (chip en la ficha y en la lista): **Interesado** (nunca compró) / **Cliente** (tiene al menos una venta o un equipo).

---

## 1.3 Qué aparece al abrir la app

### Vendedor y dirección: `/` = Contactos, con Pendientes arriba

Una sola pantalla, `app/(app)/page.tsx` (hoy redirige a `/clientes`; `/clientes` pasa a ser esta misma página). Tres zonas, de arriba a abajo:

**Zona 1 · Buscador y botón principal.** Buscador grande ("Buscar por nombre, teléfono, empresa o serie") y el botón **+ Interés** (en celular, el botón central del BottomNav; en PC, arriba a la derecha). No hay botón "Nuevo contacto" en ningún lado visible (queda dentro del flujo de + Interés y en Más).

**Zona 2 · Pendientes.** Bloques calculados desde `oportunidades`, filtrados por `comercial_id = yo` (dirección y admin ven un selector "Míos / De todos / Por vendedor" que se recuerda). Cada bloque muestra el conteo en el título y no aparece si está vacío:

| Bloque | Regla | Orden |
|---|---|---|
| **Atrasados** (rojo) | `proximo_contacto < hoy` | más atrasado primero |
| **Hoy** | `proximo_contacto = hoy` | Muy interesado primero |
| **Llegó stock** (verde) | `etapa = 'espera'` y `proximo_nota = 'Llegó stock'` | — |
| **Próximos 7 días** (plegado) | `proximo_contacto` entre mañana y hoy+7 | por fecha |
| **Sin fecha** (gris, plegado) | interés abierto sin `proximo_contacto`, con `ultimo_movimiento_at` hace más de 7 días | más viejo primero |
| **Recompras** (plegado, solo si hay) | tareas `tipo = 'recompra'` pendientes | por fecha |

Cada fila, igual en todos los bloques: **nombre del contacto · qué le interesa (con puntito de nivel) · nota del próximo contacto** · botones **WhatsApp**, **Llamar**, **Anotar**. "Anotar" abre el mismo panel "¿Qué pasó?" de la ficha, sin salir de la pantalla, y al guardar la fila se va del bloque (porque cambió la fecha) o queda (si eligió "Sin fecha" pasa a Sin fecha).

Si los bloques Atrasados, Hoy y Llegó stock están vacíos: una línea "Al día." y nada más. La zona 2 nunca muestra más de 3 bloques abiertos a la vez.

**Zona 3 · Contactos.** La lista actual (`clientes/page.tsx`), con chips **Recientes / Interesados / Clientes / Lista de espera / Todos**. Cada fila: nombre, empresa, chip Interesado/Cliente, qué le interesa (último interés abierto con puntito), último movimiento ("hace 3 días: le mandé la cotización"), próxima fecha si tiene, botones WhatsApp y Llamar. Recientes = últimos 60 con movimiento, **míos** por defecto para vendedores.

### Técnico: `/` = Services

Misma estructura, otro contenido:
- Botón principal **Cargar service hecho** (ya existe; se mantiene como está: cliente por texto, equipo opcional, qué se hizo, horas/repuestos/foto opcionales).
- **Hoy**: OTs asignadas a mí con `fecha_programada = hoy` (si hay agenda; si no, el bloque no aparece).
- **Pendientes de cerrar**: OTs mías en `en_proceso` o `cerrada_tecnico` sin firma o sin fotos.
- **Próximos** plegado.
- Lista de **mis últimos services** con cliente, equipo y estado.

### Administración: `/` = igual que dirección + bandeja

Igual que dirección, y arriba de Pendientes un bloque **Ventas para facturar** (`pedido_estado = 'facturar'`) y **Services para revisar** (`cerrada_tecnico`), con conteo y link a `/pedidos` y `/servicio`. (El resto del inicio de administración es Etapa 4.)

---

## 1.4 + Interés: primero qué, después quién

`InteresNuevoForm` ya funciona así. Ajustes para que sea el único camino de entrada:

**Pantalla 1 · ¿Qué le interesa?** Lista de productos activos agrupados por categoría, con buscador arriba y "Otro (escribir)" al final. Al lado de cada producto, el texto de stock de `lib/stock.ts`: "Hay 3" / "Sin stock, llegan 5 el 20 sep" / "Sin stock, sin ingreso previsto". Debajo, el nivel: **Muy interesado / Interesado / Solo preguntó** (obligatorio, sin default).

**Pantalla 2 · ¿Quién?** Un solo campo: "Nombre, empresa o teléfono". Mientras escribe, busca en `clientes` (nombre, empresa, teléfono normalizado, email) y muestra coincidencias con chip Interesado/Cliente y su ciudad. Tocar una = asignar. Si no hay coincidencia: aparecen nombre, teléfono (obligatorio uno de los dos: teléfono o email), empresa y rubro (opcionales, plegados: "Más datos"). Al guardar se crea el contacto con `comercial_id = yo`.

**Pantalla 3 · ¿Algo más?** (opcional, se puede saltear con "Guardar"): nota libre ("consultó por WhatsApp, quiere para diciembre"), origen (chips: WhatsApp / Llamada / Web / Feria / Recomendado / Visita), y **¿Cuándo volver a contactar?** con los chips de 1.1 (ninguno preseleccionado). Si el producto no tiene stock, aparece un chip destacado **Poner en lista de espera** que setea `etapa = 'espera'`.

Al guardar: va a la ficha del contacto con el interés abierto y un aviso corto "Interés cargado" (2 segundos). Se registra el movimiento "Nuevo interés: {producto}" con quién lo cargó.

Compartir desde WhatsApp (share target) sigue entrando por acá, con el teléfono detectado y ya buscado en pantalla 2.

---

## 1.5 La ficha del contacto: toda la información en una pantalla

`app/(app)/clientes/[id]/page.tsx`. Orden fijo, de arriba a abajo, en celular y en PC (en PC, dos columnas: izquierda 1-3, derecha 4-6):

1. **Cabecera**: nombre, empresa, chip Interesado/Cliente, ciudad, vendedor responsable (editable por gestores). Botones grandes: **WhatsApp · Llamar · Email**. Teléfonos y emails adicionales plegados.
2. **¿Qué pasó?**: caja de texto + chips de próxima fecha + "Guardar". Si el contacto tiene más de un interés abierto, un selector "Sobre: {interés}" (preseleccionado el más reciente). Guardar crea el movimiento y actualiza `proximo_contacto`/`proximo_nota` del interés elegido.
3. **Le interesa**: cada interés abierto como tarjeta: producto, puntito de nivel, etapa (chip), próxima fecha y nota, "hace N días sin movimiento" si > 7. Botones por tarjeta: **Cotizar · Me compró · Lista de espera · No se dio · Más** (Más despliega: cambiar nivel, cambiar producto, guiones, diagnóstico Zumex, calculadora, IA, material; todo lo que hoy vive en `/oportunidades/[id]`, movido acá como paneles plegados). Al final, **+ Otro interés**.
4. **Ventas**: cada venta con su paso actual (Vendido / Preparar / Facturar / Entregado) y el botón del paso siguiente (mismo `VentaPaso`). Al facturar pide factura y serie ahí mismo.
5. **Equipos y services**: equipos con serie, garantía (vigente/vencida) y último service; botón "Cargar service" para técnicos y gestores.
6. **Movimientos**: todo el historial, más reciente arriba, cada línea con fecha, quién, y texto ("Cotización N° 12 enviada", "Anotó: no atendió", "Nuevo interés: JL15", "Pasó a lista de espera", "Service OT-41 cerrado"). Es la misma tabla `actividades`; verificar que **toda** acción del sistema escriba ahí (crear interés, cambiar etapa, cotizar, anotar, pasar de paso la venta, cargar service, cambiar nivel, reasignar). Si alguna no lo hace, agregarlo.
7. **Datos** (plegado al fondo): fiscales, sucursales, notas internas, cotizaciones y archivos.

`/oportunidades/[id]` redirige a `/clientes/[cliente_id]?interes=[id]` (abre esa tarjeta expandida) y su contenido se elimina. `/buscar` y `/hoy` se eliminan.

---

## 1.6 Stock: lo que hay, lo que llega, quién espera

`app/(app)/stock/page.tsx` ya existe. Ajustes:

- Visible para **todos** los roles en el nav (celular: dentro de Más; PC: en el Sidebar principal). Solo gestores editan.
- Por producto, tres columnas claras: **Hay** (número grande), **Llega** ("5 el 20 sep", o "sin ingreso previsto"), **Esperan** (N, con los nombres al tocar y botón WhatsApp por cada uno).
- Botón de gestor **"Llegó"** en cada ingreso previsto: marca `recibido_at`, suma al stock y dispara la única automatización (1.1): los intereses en espera de ese producto pasan a `proximo_contacto = hoy`, nota "Llegó stock", y aparecen en el bloque verde del inicio de cada vendedor. Se registra el movimiento "Llegó stock de {producto}" en cada contacto en espera.
- Al vender (`pedido_estado` pasa a `entregado`) se descuenta 1 del stock del producto de forma atómica (RPC `fn_ajustar_stock(producto_id, delta)`). Al pasar de `entregado` hacia atrás, se suma. Es el único descuento automático; los ajustes manuales siguen siendo de gestores.
- En **+ Interés** (1.4) y en la tarjeta de interés (1.5) se muestra siempre el texto de stock del producto.

Queda documentado en `PLAN-OS.md` que en la Etapa 4 el stock pasa a leerse del Excel de ZEUS y esta pantalla deja de editarse a mano.

---

## 1.7 Movimientos (feed del equipo)

`app/(app)/movimientos/page.tsx` ya existe. Ajustes:

- Filtro **Míos / De todos / Por vendedor / Por técnico** (gestores) y **por tipo** (interés, cotización, venta, service, nota).
- Cada línea linkea al contacto; en PC, panel lateral con la ficha resumida al pasar.
- Es la respuesta a "ver todo lo que hicimos": no se construye nada más para eso.

---

## 1.8 Navegación

**Celular (BottomNav)**, por rol:
- Vendedor / dirección / admin: **Inicio · Contactos · [+ Interés] · Ventas · Más**. (Inicio y Contactos son la misma página con scroll; "Contactos" salta a la zona 3.)
- Técnico: **Inicio · Services · [Cargar service] · Equipos · Más**.

**PC (Sidebar)**: Inicio, Contactos, Ventas, Stock, Services, Equipos, Movimientos, Reportes (gestores), Admin (gestores), Más herramientas (HOTELGA, Financiación, Calculadora, Biblioteca, Marketing, Importar).

Todo lo que no está en esta lista sale del nav. Nada se borra de la base.

---

## 1.9 Textos y ergonomía

- Tamaño mínimo de texto 15 px en celular; botones de acción de 44 px de alto; los tres botones de contacto (WhatsApp, Llamar, Anotar) siempre en el mismo orden y lugar en todas las filas.
- Cero jerga: "Interés", "Contacto", "Venta", "Service", "Movimiento", "Lista de espera". Nunca "oportunidad", "lead", "pipeline", "tarea", "etapa" en la interfaz. Buscar con grep en `app/` y `components/` y reemplazar.
- Confirmaciones cortas y visibles después de cada acción ("Guardado", "Pasó a lista de espera", "Venta registrada · garantía hasta {fecha}"). Nunca un refresh mudo.
- `loading.tsx` y `error.tsx` en `app/(app)/` (si no se hicieron en Etapa 0).

---

## 1.10 Orden de trabajo y tests

1. Partir `lib/actions.ts` por módulo (`contactos`, `intereses`, `ventas`, `servicio`, `marketing`, `admin`, `stock`) con `index.ts` que re-exporta. Sin cambios de lógica. Commit propio.
2. Migración 026 y eliminación de la creación de tareas comerciales.
3. Ficha del contacto (1.5) — es el centro; todo lo demás apunta acá.
4. + Interés (1.4).
5. Inicio con Pendientes (1.3).
6. Stock y "Llegó" (1.6).
7. Movimientos y navegación (1.7, 1.8).
8. Textos (1.9).

Tests:
- `tests/unit/pendientes.test.ts`: función pura `clasificarPendientes(intereses, hoy)` que devuelve los bloques de 1.3 (atrasado / hoy / llegó stock / próximos / sin fecha).
- `tests/unit/stock.test.ts`: `textoStock` y `fn_ajustar_stock` (vía RPC en staging).
- `tests/e2e/interes.spec.ts`: login comercial → + Interés (producto sin stock) → contacto nuevo → Lista de espera → gestor marca "Llegó" → el interés aparece en "Llegó stock" del vendedor.

---

## Definición de terminado

- [ ] Al abrir la app, un vendedor ve arriba Atrasados / Hoy / Llegó stock (solo los que tienen algo) y abajo sus contactos con WhatsApp y Llamar. Nada más.
- [ ] Un interés abierto nunca tiene más de una próxima fecha; la tabla `tareas` no recibe filas nuevas desde ninguna acción comercial (verificar con consulta SQL después de un día de uso).
- [ ] Cargar un interés por una licuadora para alguien que no está en la base lleva tres pantallas y menos de 30 segundos; el contacto queda creado y asignado.
- [ ] Un interés sin stock puede pasar a lista de espera desde el alta y desde la ficha; cuando un gestor marca "Llegó", aparece en verde en el inicio del vendedor.
- [ ] Todos los roles ven Stock con Hay / Llega / Esperan.
- [ ] En la ficha de cualquier contacto se ve en una sola pantalla: cómo contactarlo, qué le interesa, sus ventas y su paso, sus equipos y services, y todos los movimientos con fecha y quién.
- [ ] El técnico carga un service hecho sin tener agenda y queda en "Services para revisar" de administración.
- [ ] No queda ningún texto "oportunidad", "lead", "pipeline", "tarea" ni "etapa" en la interfaz.
- [ ] Una semana de uso del equipo completo sin que nadie pregunte "qué es esto" sobre la pantalla de inicio.
